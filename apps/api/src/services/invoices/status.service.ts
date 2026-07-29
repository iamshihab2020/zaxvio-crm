/**
 * Invoice status — the one place that decides what an invoice's status is
 * allowed to become, and what it *must* become once the money changes.
 *
 * Background (report §3.1, INV-01/02/03/06). There was no state machine
 * anywhere. `PATCH /invoices/:id/status` and `POST /invoices/bulk-status-update`
 * wrote **any** of the six enum values with no rules: `void → draft` un-voided a
 * cancelled invoice, and `draft → paid` recorded money as received with zero
 * payment rows while `amountPaid` and `balanceDue` were left untouched.
 * `POST /:id/payments` guarded only `status === "void"`, so a draft the customer
 * had never seen accepted a payment, flipped to `paid`, fired a notification and
 * emailed a receipt for a document that was never sent. And deleting a payment
 * had no guard at all — it set `sent` whenever `amountPaid <= 0`, which
 * resurrected voided invoices back into the dunning cron.
 *
 * Jobs got a transition table in April and a lifecycle-validated
 * `job-stages.service.ts` in July. This is that, for the money table.
 *
 * The split this file enforces:
 *   - `draft | sent | partially_paid | paid | void` are **stored** and derived
 *     from the payment rows. Nothing else may write them.
 *   - `overdue` is **derived from `due_date` at read time** (see
 *     {@link overdueCondition}) because the stored value only flips when the
 *     cron runs. The cron may still stamp it for its own bookkeeping, but no
 *     reader trusts it.
 */

import { sql, and, isNull, notInArray, type SQL } from "@hvac-saas/database";
import { invoices } from "@hvac-saas/database";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export const INVOICE_STATUSES: readonly InvoiceStatus[] = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(value);
}

/**
 * Legal manual transitions. Deliberately narrow: the statuses that describe
 * money (`partially_paid`, `paid`) are *derived*, never chosen, so they are not
 * reachable by hand — recording or deleting a payment is the only way in.
 *
 * `paid` and `void` are terminal. Un-paying is deleting the payment; un-voiding
 * is not a thing, because the invoice number has already been issued and the
 * customer may hold a PDF that says VOID.
 */
const TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["sent", "void"],
  sent: ["overdue", "void"],
  partially_paid: ["overdue", "void"],
  overdue: ["sent", "void"],
  paid: [],
  void: [],
};

/** Statuses that may receive a payment: the invoice is out and money is owed. */
export const PAYABLE_STATUSES: readonly InvoiceStatus[] = [
  "sent",
  "partially_paid",
  "overdue",
] as const;

/**
 * Statuses the overdue predicate and the dunning cron consider "still owed".
 * `partially_paid` belongs here: a customer who paid half and then stopped was
 * counted as overdue everywhere in the UI but never chased, because the cron
 * restricted itself to `('sent','overdue')` (INV-06).
 */
export const UNPAID_STATUSES: readonly InvoiceStatus[] = [
  "sent",
  "partially_paid",
  "overdue",
] as const;

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionMessage(
  from: InvoiceStatus,
  to: InvoiceStatus,
): string {
  if (to === "paid" || to === "partially_paid") {
    return `"${label(to)}" is set by recording a payment, not by changing the status directly`;
  }
  if (from === "paid") {
    return "A paid invoice cannot change status. Delete the payment to reverse it.";
  }
  if (from === "void") {
    return "A void invoice is final and cannot change status.";
  }
  return `Cannot move an invoice from ${label(from)} to ${label(to)}`;
}

export function label(status: InvoiceStatus): string {
  return status === "partially_paid" ? "partially paid" : status;
}

/**
 * The status the money says this invoice is in.
 *
 * This is the fix for INV-02: `recalculateInvoiceTotals` recomputed `subtotal`,
 * `taxAmount`, `totalAmount` and `balanceDue` but never `status`, so an invoice
 * that took a payment and was then edited upward read **Paid** on the list, in
 * the stat cards and on the PDF while money was still owed.
 *
 * `draft` and `void` are never derived away — a draft has no payments (the
 * payable guard sees to that) and a void invoice's status is the whole point.
 */
export function deriveStatus(params: {
  current: InvoiceStatus;
  totalAmount: number;
  amountPaid: number;
}): InvoiceStatus {
  const { current, totalAmount, amountPaid } = params;

  if (current === "void") return "void";
  if (amountPaid <= 0) {
    // No money on the invoice. A draft stays a draft; anything else has been
    // sent at some point, so `sent` is the honest floor. `overdue` is not stored
    // here — it is derived from due_date by every reader.
    return current === "draft" ? "draft" : "sent";
  }
  // A payment exists, so the document went out even if the status still says
  // draft (rows written before the payable guard existed).
  if (amountPaid >= totalAmount && totalAmount > 0) return "paid";
  return "partially_paid";
}

/**
 * How a payment of `amount` splits between the balance and a credit.
 *
 * Overpayment used to be destroyed: `balanceDue` was clamped with
 * `Math.max(0, …)` and the excess had no representation anywhere — no credit,
 * no refund record, no audit trail (DF-INV-01, open since 2026-04-12). The
 * excess lands in `invoices.credit_amount` now, so the books balance and the
 * contractor can see they owe the customer $50.
 */
export function splitPayment(params: {
  totalAmount: number;
  amountPaid: number;
}): { balanceDue: number; creditAmount: number } {
  const outstanding = params.totalAmount - params.amountPaid;
  return outstanding >= 0
    ? { balanceDue: round2(outstanding), creditAmount: 0 }
    : { balanceDue: 0, creditAmount: round2(-outstanding) };
}

/** Two-decimal rounding that does not accumulate float error across calls. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * The one definition of "overdue", as a SQL condition.
 *
 * There used to be three. The list (`routes/invoices/index.ts:149`) and the
 * stats endpoint (`:253`) agreed — both derived it from `due_date` in the
 * tenant's timezone — but `processOverdueInvoiceReminders` used
 * `now().toISOString().split("T")[0]`, i.e. **server UTC**, and restricted
 * itself to `status IN ('sent','overdue')`. So for a tenant west of UTC the
 * reminder fired up to a day before the app agreed the invoice was late, and a
 * `partially_paid` invoice was never chased at all (INV-06).
 *
 * `timezone` must be a tenant's IANA zone. Passed as a bound parameter, never
 * interpolated.
 */
export function overdueCondition(timezone: string): SQL {
  return and(
    notInArray(invoices.status, ["paid", "void"]),
    sql`${invoices.dueDate} IS NOT NULL`,
    sql`${invoices.dueDate} < (now() AT TIME ZONE ${timezone})::date`,
  )!;
}

/** `overdueCondition` plus the archived filter every read path applies. */
export function activeOverdueCondition(timezone: string): SQL {
  return and(isNull(invoices.archivedAt), overdueCondition(timezone))!;
}

/**
 * Due date derived from the tenant's payment terms.
 *
 * `/settings/invoices` collects `invoicePaymentTerms` ("Net 30") and the PDF
 * prints `Terms: Net 30` — but `POST /invoices` only stored a `dueDate` the
 * caller supplied, and `POST /invoices/from-job/:jobId` never set one at all.
 * So every invoice raised from a job (the primary flow) had no due date: never
 * overdue, never in an aging bucket, never dunned, and the PDF printed payment
 * terms above a blank due date. The setting was decorative (INV-08).
 *
 * Recognises the conventional forms a contractor actually types. Anything else
 * — "Payment on completion", "50% up front" — yields null, which is the honest
 * answer: those terms have no computable date.
 */
export function dueDateFromTerms(
  issuedDate: string,
  terms: string | null | undefined,
): string | null {
  if (!terms) return null;
  const normalised = terms.trim().toLowerCase();

  // "Due on receipt" / "Payable upon receipt" — due the day it is issued.
  if (/\b(on|upon)\s+receipt\b/.test(normalised)) return issuedDate;

  // "Net 30", "net30", "NET 15 days".
  const net = normalised.match(/\bnet[\s-]*(\d{1,3})\b/);
  if (net) return addDays(issuedDate, Number(net[1]));

  // Bare "30 days".
  const days = normalised.match(/^(\d{1,3})\s*days?$/);
  if (days) return addDays(issuedDate, Number(days[1]));

  return null;
}

/** Add whole days to a YYYY-MM-DD date without touching local time. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().split("T")[0]!;
}
