/**
 * Quote business logic. Route handlers validate, call one of these, and respond
 * ([[api-rules]] §1).
 *
 * `routes/quotes/index.ts` was 1447 lines with the totals maths, the expiry
 * sweep, PDF orchestration and email dispatch all inline, and `services/`
 * contained no quotes file at all (QUO-30). This is the same extraction the
 * invoices audit did for `services/invoices/`.
 */

import {
  getDb,
  quotes,
  quoteLineItems,
  quoteActivities,
  and,
  or,
  eq,
  isNull,
  sql,
  type SQL,
} from "@hvac-saas/database";
import { round2 } from "../invoices/status.service.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Recalculate a quote's stored money from its line items.
 *
 * Two defects fixed here (QUO-11):
 *
 * 1. It summed `quantity * unit_price` **raw**, while every UI surface renders
 *    `quote_line_items.total` — a GENERATED `numeric(10,2)` column Postgres
 *    rounds *per row*. Sum-of-rounded ≠ rounded-sum: two lines of `1.5 × 10.33`
 *    render as $15.50 each above a subtotal of $30.99. Summing the stored
 *    `total` makes the subtotal equal the numbers the customer is looking at.
 * 2. Tax and total were computed from unrounded floats and only `.toFixed(2)`'d
 *    at write time. `round2` at each step is what `invoices.service.ts` does,
 *    and these two documents convert into one another.
 */
export async function recalculateQuoteTotals(
  db: Db,
  quoteId: string,
  tenantId: string,
): Promise<void> {
  const [sums] = await db
    .select({
      // The rounded per-row total, not the raw product — see above.
      subtotal: sql<string>`COALESCE(SUM(${quoteLineItems.total}), 0)`,
    })
    .from(quoteLineItems)
    .where(
      and(
        eq(quoteLineItems.quoteId, quoteId),
        eq(quoteLineItems.tenantId, tenantId),
      ),
    );

  const [quote] = await db
    .select({
      taxRate: quotes.taxRate,
      discountAmount: quotes.discountAmount,
    })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found while recalculating`);
  }

  const subtotal = round2(parseFloat(sums?.subtotal ?? "0"));
  const taxRate = parseFloat(quote.taxRate ?? "0");
  const discountAmount = parseFloat(quote.discountAmount ?? "0");
  const taxAmount = round2(subtotal * taxRate);
  // A discount larger than the bill is a data-entry error, not a refund — the
  // quote floors at zero rather than printing a negative total on a PDF.
  const totalAmount = Math.max(0, round2(subtotal + taxAmount - discountAmount));

  await db
    .update(quotes)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
}

/**
 * The one definition of "this quote has lapsed", as a SQL condition.
 *
 * Was `new Date().toISOString().split("T")[0]` — the **UTC** date — in both
 * `routes/quotes` and `routes/public/quote.ts`. Verified at `2026-08-02 02:00
 * UTC`: UTC says `08-02` while `America/Chicago` says `08-01`, so a quote valid
 * until today was already expired through the tenant's entire evening, which is
 * exactly when a homeowner sits down with an estimate (QUO-09).
 *
 * `timezone` is a bound parameter, never interpolated.
 */
export function expiredCondition(timezone: string): SQL {
  return and(
    eq(quotes.status, "sent"),
    sql`${quotes.expiryDate} IS NOT NULL`,
    sql`${quotes.expiryDate} < (now() AT TIME ZONE ${timezone})::date`,
  )!;
}

/**
 * Flip lapsed quotes to `expired` for one tenant.
 *
 * This used to run at the top of `GET /quotes` **and** `GET /:id`, so every list
 * render and every detail open issued an UPDATE against the tenant's whole quote
 * table — a write on a read path, the same thing the jobs audit removed from
 * `GET /pipeline-stages`. It now runs from the cron sweep only; reads derive the
 * display status instead (see `displayStatus`).
 */
export async function expireLapsedQuotes(
  db: Db,
  tenantId: string,
  timezone: string,
): Promise<number> {
  // The flip and its events in one transaction. The `UPDATE` is itself the
  // claim — a second sweep running concurrently matches nothing, because the
  // rows it would have taken are no longer `sent` — and the producer carries a
  // `dedupKey` besides, so a quote can be announced expired exactly once even
  // if the two halves ever came apart.
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(quotes)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(eq(quotes.tenantId, tenantId), expiredCondition(timezone)))
      .returning({ id: quotes.id });

    if (rows.length > 0) {
      // Imported lazily: `quote-events.service.ts` reaches the whole producer
      // tree, and this module is pulled in by every quote read path.
      const { emitQuoteExpiredEvents } = await import("./quote-events.service.js");
      await emitQuoteExpiredEvents(tx, {
        tenantId,
        quoteIds: rows.map((r) => r.id),
      });
    }

    return rows.length;
  });
}

/**
 * What a read path should *show* for a quote, without writing.
 *
 * A `sent` quote past its expiry reads as `expired` the moment it lapses, even
 * if the cron has not run yet, so the list, the stats cards and the customer
 * portal cannot disagree with each other about the same row.
 */
export function displayStatus(
  quote: { status: string; expiryDate: string | null },
  today: string,
): string {
  if (quote.status !== "sent" || !quote.expiryDate) return quote.status;
  return quote.expiryDate < today ? "expired" : quote.status;
}

/** Same rule as {@link displayStatus}, as SQL, for counting. */
export function displayStatusSql(timezone: string): SQL<string> {
  return sql<string>`CASE
    WHEN ${quotes.status} = 'sent'
     AND ${quotes.expiryDate} IS NOT NULL
     AND ${quotes.expiryDate} < (now() AT TIME ZONE ${timezone})::date
    THEN 'expired'
    ELSE ${quotes.status}::text
  END`;
}

/**
 * `?status=` as an explicit condition rather than a comparison against the
 * `CASE` expression above.
 *
 * Same result, but built from Drizzle column references the query builder
 * qualifies itself, and each branch is a plain predicate the planner can use
 * `idx_quotes_status_expiry` for. The list joins `customers` and `equipment`,
 * and a hand-written template in that position is exactly the shape that bit
 * the jobs audit (§8) when Drizzle rendered an embedded column unqualified.
 */
export function statusCondition(status: string, timezone: string): SQL {
  const today = sql`(now() AT TIME ZONE ${timezone})::date`;

  if (status === "expired") {
    // Stored as expired, or lapsed and not yet swept.
    return or(
      eq(quotes.status, "expired"),
      and(
        eq(quotes.status, "sent"),
        sql`${quotes.expiryDate} IS NOT NULL`,
        sql`${quotes.expiryDate} < ${today}`,
      ),
    )!;
  }

  if (status === "sent") {
    // Sent, but not one that has already lapsed.
    return and(
      eq(quotes.status, "sent"),
      or(
        sql`${quotes.expiryDate} IS NULL`,
        sql`${quotes.expiryDate} >= ${today}`,
      ),
    )!;
  }

  return eq(quotes.status, status as "draft" | "accepted" | "declined");
}

export async function logQuoteActivity(
  db: Db,
  params: {
    tenantId: string;
    quoteId: string;
    type: string;
    description: string;
    performedBy?: string | null;
    metadata?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(quoteActivities).values({
    tenantId: params.tenantId,
    quoteId: params.quoteId,
    type: params.type,
    description: params.description,
    performedBy: params.performedBy ?? null,
    metadata: params.metadata ?? null,
  });
}

/** Status counts for the KPI cards, in one query. */
export async function getQuoteStats(
  db: Db,
  tenantId: string,
  timezone: string,
): Promise<{
  draft: number;
  sent: number;
  accepted: number;
  declined: number;
  expired: number;
}> {
  const display = displayStatusSql(timezone);

  const [row] = await db
    .select({
      draft: sql<number>`COUNT(*) FILTER (WHERE ${display} = 'draft')`,
      sent: sql<number>`COUNT(*) FILTER (WHERE ${display} = 'sent')`,
      accepted: sql<number>`COUNT(*) FILTER (WHERE ${display} = 'accepted')`,
      declined: sql<number>`COUNT(*) FILTER (WHERE ${display} = 'declined')`,
      expired: sql<number>`COUNT(*) FILTER (WHERE ${display} = 'expired')`,
    })
    .from(quotes)
    // The list filters archived rows out; the cards did not, so clicking
    // "Sent: 3" could produce a list of two (QUO-08, verified).
    .where(and(eq(quotes.tenantId, tenantId), isNull(quotes.archivedAt)));

  return {
    draft: Number(row?.draft ?? 0),
    sent: Number(row?.sent ?? 0),
    accepted: Number(row?.accepted ?? 0),
    declined: Number(row?.declined ?? 0),
    expired: Number(row?.expired ?? 0),
  };
}

/**
 * Quotes lapsing within `days`, for the expiry-warning sweep.
 * Kept next to `expiredCondition` so the two cannot drift.
 */
export function expiringSoonCondition(timezone: string, days: number): SQL {
  return and(
    eq(quotes.status, "sent"),
    isNull(quotes.archivedAt),
    sql`${quotes.expiryDate} IS NOT NULL`,
    sql`${quotes.expiryDate} >= (now() AT TIME ZONE ${timezone})::date`,
    sql`${quotes.expiryDate} <= ((now() AT TIME ZONE ${timezone})::date + ${days} * INTERVAL '1 day')`,
  )!;
}
