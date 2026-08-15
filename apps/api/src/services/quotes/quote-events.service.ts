/**
 * Workflow events for a quote.
 *
 * The quotes audit ([[quotes|§8.2]]) measured what happens when a pattern is
 * applied in place rather than swept: **0 of 19** in-place fixes from earlier
 * audits had reached this page. So the emitters live here, once, and the four
 * routes that respond to a quote — the internal accept, the internal decline,
 * the public accept, the public decline — all call the same one.
 *
 * Two ordering rules are load-bearing:
 *
 * - `quote.sent` is emitted at the **end** of the send path, after the access
 *   token and the PDF exist. QUO-01 found `draft → sent` reachable without
 *   either, producing a quote the portal cannot open and that `/send`, `PATCH`
 *   and `DELETE` then all refuse. An automation firing there would email a link
 *   to a 404.
 * - `quote.accepted` / `quote.declined` are emitted **inside** the
 *   `SELECT … FOR UPDATE` that claims the response (QUO-03). An accept racing a
 *   decline must produce exactly one event, matching the one outcome recorded.
 */

import {
  customers,
  quotes,
  quoteLineItems,
  and,
  count,
  eq,
  inArray,
  type getDb,
} from "@hvac-saas/database";
import {
  quoteAccepted,
  quoteCreated,
  quoteDeclined,
  quoteExpired,
  quoteSent,
  quoteViewed,
  type CustomerArgs,
  type QuoteArgs,
} from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface QuoteEventContext {
  quote: QuoteArgs & { createdAt: Date };
  customer: CustomerArgs;
}

/**
 * Read quotes with their customers.
 *
 * `innerJoin` with a tenant predicate on **both** sides. `quotes.customer_id` is
 * `NOT NULL`, so the join drops nothing, and the second predicate is the fix
 * pattern from the 2026-08-06 ownership audit rather than a belt-and-braces
 * flourish — three domains had read joins with no tenant filter, and two of them
 * leaked customer contact details.
 */
export async function loadQuoteEventContext(
  db: Db,
  tenantId: string,
  quoteIds: string[],
): Promise<Map<string, QuoteEventContext>> {
  const out = new Map<string, QuoteEventContext>();
  if (quoteIds.length === 0) return out;

  const rows = await db
    .select({
      id: quotes.id,
      quoteNumber: quotes.quoteNumber,
      status: quotes.status,
      totalAmount: quotes.totalAmount,
      subtotal: quotes.subtotal,
      issuedDate: quotes.issuedDate,
      expiryDate: quotes.expiryDate,
      createdAt: quotes.createdAt,
      customerId: customers.id,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
    })
    .from(quotes)
    .innerJoin(
      customers,
      and(eq(quotes.customerId, customers.id), eq(customers.tenantId, tenantId)),
    )
    .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, quoteIds)));

  for (const row of rows) {
    out.set(row.id, {
      quote: {
        id: row.id,
        quoteNumber: row.quoteNumber,
        status: row.status,
        totalAmount: row.totalAmount,
        subtotal: row.subtotal,
        issuedDate: row.issuedDate,
        expiryDate: row.expiryDate,
        createdAt: row.createdAt,
      },
      customer: {
        id: row.customerId,
        firstName: row.customerFirstName,
        lastName: row.customerLastName,
        email: row.customerEmail,
        phone: row.customerPhone,
      },
    });
  }

  return out;
}

export interface EmitQuoteArgs {
  tenantId: string;
  actorUserId: string | null;
  quoteId: string;
}

export async function emitQuoteCreatedEvent(
  db: Db,
  args: EmitQuoteArgs,
): Promise<void> {
  const context = (
    await loadQuoteEventContext(db, args.tenantId, [args.quoteId])
  ).get(args.quoteId);
  if (!context) return;

  const [items] = await db
    .select({ n: count() })
    .from(quoteLineItems)
    .where(
      and(
        eq(quoteLineItems.tenantId, args.tenantId),
        eq(quoteLineItems.quoteId, args.quoteId),
      ),
    );

  await quoteCreated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    quote: context.quote,
    customer: context.customer,
    // `POST /quotes` has never accepted a `lineItems` array — items are added
    // afterwards, one call each — so this is almost always 0 on create. It is
    // carried anyway because a workflow gating on "a quote worth sending" needs
    // to distinguish an empty shell from a real one, and 0 says so plainly.
    lineItemCount: Number(items?.n ?? 0),
  });
}

export interface EmitQuoteSentArgs extends EmitQuoteArgs {
  /** Whether the portal will actually accept a response for this quote. */
  onlineAcceptanceEnabled: boolean;
}

export async function emitQuoteSentEvent(
  db: Db,
  args: EmitQuoteSentArgs,
): Promise<void> {
  const context = (
    await loadQuoteEventContext(db, args.tenantId, [args.quoteId])
  ).get(args.quoteId);
  if (!context) return;

  await quoteSent(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    quote: context.quote,
    customer: context.customer,
    onlineAcceptanceEnabled: args.onlineAcceptanceEnabled,
    sentAt: new Date(),
  });
}

/**
 * `quote.viewed`, raised by the public portal on the first open.
 *
 * Takes the transaction its caller is already in, so the event and the
 * `first_viewed_at` stamp commit together. An event that could commit without
 * the stamp would fire an automation for a view the database does not record;
 * a stamp that could commit without the event would leave a quote marked viewed
 * that no automation ever heard about.
 */
export async function emitQuoteViewedEvent(
  db: Db,
  args: EmitQuoteArgs & { viewedAt: Date },
): Promise<void> {
  const context = (
    await loadQuoteEventContext(db, args.tenantId, [args.quoteId])
  ).get(args.quoteId);
  if (!context) return;

  await quoteViewed(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    quote: context.quote,
    customer: context.customer,
    viewedAt: args.viewedAt,
  });
}

export interface EmitQuoteResponseArgs extends EmitQuoteArgs {
  response: "accepted" | "declined";
  /** Decline only. Null when the customer gave none. */
  reason?: string | null;
  /** Accept only, and only when post-acceptance scheduling is enabled. */
  requestedDate?: string | null;
  requestedTime?: string | null;
  /** Accept only. Null when auto-convert is off or has not run yet. */
  convertedToJobId?: string | null;
}

/**
 * One emitter for both outcomes, because both are written by the same claim.
 *
 * The context is read *after* the claim's `UPDATE`, so `payload.status` is the
 * terminal status rather than `sent` — a filter on "status is accepted" then
 * matches the event that announced it, which is the least surprising thing it
 * could do.
 */
export async function emitQuoteResponseEvent(
  db: Db,
  args: EmitQuoteResponseArgs,
): Promise<void> {
  const context = (
    await loadQuoteEventContext(db, args.tenantId, [args.quoteId])
  ).get(args.quoteId);
  if (!context) return;

  if (args.response === "accepted") {
    await quoteAccepted(db, {
      tenantId: args.tenantId,
      actorUserId: args.actorUserId,
      quote: context.quote,
      customer: context.customer,
      acceptedAt: new Date(),
      requestedDate: args.requestedDate ?? null,
      requestedTime: args.requestedTime ?? null,
      convertedToJobId: args.convertedToJobId ?? null,
    });
    return;
  }

  await quoteDeclined(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    quote: context.quote,
    customer: context.customer,
    reason: args.reason ?? null,
    declinedAt: new Date(),
  });
}

export interface EmitQuoteExpiredArgs {
  tenantId: string;
  quoteIds: string[];
}

/**
 * Emit `quote.expired` for a sweep's worth of quotes.
 *
 * `actorUserId` is null — expiry is time passing, not a person acting, and the
 * producer carries a `dedupKey` so the hourly sweep re-selecting the same row
 * cannot enqueue it twice.
 */
export async function emitQuoteExpiredEvents(
  db: Db,
  args: EmitQuoteExpiredArgs,
): Promise<void> {
  if (args.quoteIds.length === 0) return;

  const contexts = await loadQuoteEventContext(db, args.tenantId, args.quoteIds);
  const expiredAt = new Date();

  for (const quoteId of args.quoteIds) {
    const context = contexts.get(quoteId);
    if (!context) continue;
    await quoteExpired(db, {
      tenantId: args.tenantId,
      actorUserId: null,
      quote: context.quote,
      customer: context.customer,
      expiredAt,
    });
  }
}
