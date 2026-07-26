/**
 * Read the `status` query param, returning it only when it is one of `allowed`.
 *
 * Used by list pages so dashboard drill-through links (`/invoices?status=overdue`)
 * land pre-filtered. The allow-list matters: filter state feeds straight into an
 * API query param, and a hand-edited URL should not be able to put an arbitrary
 * string there.
 *
 * Returns `""` (no filter) on the server and for unknown values.
 */
export function readUrlStatus(allowed: readonly string[]): string {
  if (typeof window === "undefined") return "";
  const value = new URLSearchParams(window.location.search).get("status");
  return value && allowed.includes(value) ? value : "";
}

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
] as const;

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
] as const;
