/**
 * Preconditions every mutating quote handler shares, plus the one status
 * machine the domain is allowed to move through.
 *
 * Third instance of this module — `job-guards.ts` (July), `invoice-guards.ts`
 * (2026-07-29) and now this. The two findings it closes are the same two those
 * closed, which is the whole point of §4 of the report:
 *
 * - **QUO-23** — no handler in `routes/quotes/index.ts` read `archivedAt`, so an
 *   archived quote could still be edited, given line items, and *sent to the
 *   customer*. Archiving is the product's "make this go away" action.
 * - **QUO-01** — `bulk-status-update` was one `UPDATE` with no transition check.
 *   Because `sent` is not merely a status — `/send` is what mints the access
 *   token, renders the PDF and emails the customer — flipping a draft to `sent`
 *   in bulk produced a quote with no token and no PDF that `/send`, `PATCH` and
 *   `DELETE` all then refused, because all three require `draft`. Unusable and
 *   undeletable.
 */

import {
  getDb,
  quotes,
  customers,
  equipment,
  and,
  eq,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
] as const;

export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export function isQuoteStatus(value: string): value is QuoteStatus {
  return (QUOTE_STATUSES as readonly string[]).includes(value);
}

export function label(status: QuoteStatus): string {
  return status;
}

/**
 * Legal transitions, keyed on the current status.
 *
 * `draft → sent` is deliberately **absent**. It is not a status change; it is
 * `POST /quotes/:id/send`, which generates the PDF, uploads it, mints the access
 * token and emails the customer. Nothing else may produce a `sent` quote,
 * because a `sent` quote without those side effects is broken (QUO-01).
 *
 * `expired` is reachable only from `sent`, and only by the expiry sweep.
 */
const TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  draft: [],
  sent: ["accepted", "declined", "expired"],
  accepted: [],
  declined: [],
  expired: [],
};

export function canTransitionQuote(from: QuoteStatus, to: QuoteStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionRefusal(
  from: QuoteStatus,
  to: QuoteStatus,
): string {
  if (to === "sent") {
    return "A quote becomes 'sent' only by sending it — use Send so the customer gets a PDF and a link";
  }
  return `Cannot move a ${label(from)} quote to ${label(to)}`;
}

export interface GuardedQuote {
  id: string;
  tenantId: string;
  customerId: string;
  quoteNumber: string;
  status: QuoteStatus;
  issuedDate: string;
  expiryDate: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  totalAmount: string;
  notes: string | null;
  equipmentId: string | null;
  convertedToJobId: string | null;
  accessToken: string | null;
  pdfStoragePath: string | null;
  customerScheduledDate: string | null;
  customerScheduledTime: string | null;
  archivedAt: Date | null;
}

export type QuoteGuard =
  | { ok: true; quote: GuardedQuote }
  | { ok: false; status: 404 | 400; message: string };

const GUARD_COLUMNS = {
  id: quotes.id,
  tenantId: quotes.tenantId,
  customerId: quotes.customerId,
  quoteNumber: quotes.quoteNumber,
  status: quotes.status,
  issuedDate: quotes.issuedDate,
  expiryDate: quotes.expiryDate,
  subtotal: quotes.subtotal,
  taxRate: quotes.taxRate,
  taxAmount: quotes.taxAmount,
  discountAmount: quotes.discountAmount,
  totalAmount: quotes.totalAmount,
  notes: quotes.notes,
  equipmentId: quotes.equipmentId,
  convertedToJobId: quotes.convertedToJobId,
  accessToken: quotes.accessToken,
  pdfStoragePath: quotes.pdfStoragePath,
  customerScheduledDate: quotes.customerScheduledDate,
  customerScheduledTime: quotes.customerScheduledTime,
  archivedAt: quotes.archivedAt,
};

/**
 * Load a quote for mutation: it must exist, belong to this tenant, and not be
 * archived.
 *
 *   const guard = await loadEditableQuote(db, tenantId, id);
 *   if (!guard.ok) return reply.status(guard.status).send({ message: guard.message });
 */
export async function loadEditableQuote(
  db: Db,
  tenantId: string,
  quoteId: string,
): Promise<QuoteGuard> {
  const [quote] = await db
    .select(GUARD_COLUMNS)
    .from(quotes)
    .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, quoteId)));

  const gate = assertEditable(quote as GuardedQuote | undefined);
  return gate ?? { ok: true, quote: quote as GuardedQuote };
}

/** The refusal, or null when the quote may be modified. */
export function assertEditable(
  quote: { archivedAt: Date | null } | undefined,
): { ok: false; status: 404 | 400; message: string } | null {
  if (!quote) return { ok: false, status: 404, message: "Quote not found" };
  if (quote.archivedAt) {
    return {
      ok: false,
      status: 400,
      message: "Cannot modify an archived quote. Restore it first.",
    };
  }
  return null;
}

/**
 * Only draft quotes may be structurally edited — line items, tax rate,
 * discount, customer, dates. One message instead of the six copies the route
 * file had.
 */
export function assertDraft(
  quote: { status: QuoteStatus },
  action: string,
): { ok: false; status: 400; message: string } | null {
  if (quote.status === "draft") return null;
  return {
    ok: false,
    status: 400,
    message: `Only draft quotes can be ${action}`,
  };
}

/**
 * Tenant-ownership for the foreign keys a request supplies.
 *
 * `POST /quotes` validated `customerId` and wrote `equipmentId` straight from
 * the body; `PATCH` checked neither (QUO-22). Equipment belongs to a customer,
 * so a mis-set id put another customer's serial number on the PDF that gets
 * emailed out.
 */
export async function ownsCustomer(
  db: Db,
  tenantId: string,
  id: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));
  return Boolean(row);
}

/**
 * Equipment must belong to the tenant *and* to the customer the quote is for.
 * Returns a refusal rather than a boolean so the caller cannot forget the
 * second half of the check.
 */
export async function loadQuotableEquipment(
  db: Db,
  tenantId: string,
  equipmentId: string,
  customerId: string | null,
): Promise<
  { ok: true } | { ok: false; status: 400; message: string }
> {
  const [row] = await db
    .select({ id: equipment.id, customerId: equipment.customerId })
    .from(equipment)
    .where(and(eq(equipment.tenantId, tenantId), eq(equipment.id, equipmentId)));

  if (!row) return { ok: false, status: 400, message: "Equipment not found" };
  if (customerId && row.customerId && row.customerId !== customerId) {
    return {
      ok: false,
      status: 400,
      message: "That equipment belongs to a different customer",
    };
  }
  return { ok: true };
}
