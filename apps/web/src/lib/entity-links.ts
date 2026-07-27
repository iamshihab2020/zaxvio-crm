/**
 * Deep links to an entity's detail view.
 *
 * List pages open their detail sheet from a query param, and the param name has
 * now been got wrong three separate times: the dashboard agenda emitted `?job=`
 * while the jobs page read `jobId`; the agenda emitted `?booking=` while the
 * bookings page read `bookingId`; and the schedule's hover card emitted both of
 * the wrong ones (BOOK-14). Each time the symptom was the same — the link
 * navigates, the sheet stays shut, and nothing indicates which record was meant.
 *
 * Every emitter goes through here so the name can only be wrong in one place.
 * The readers are `searchParams.get(...)` in the corresponding `*-page-client.tsx`.
 */

/** `/jobs?jobId=…` — read by `jobs-page-client.tsx`. */
export function jobLink(id: string): string {
  return `/jobs?jobId=${encodeURIComponent(id)}`;
}

/** `/bookings?bookingId=…` — read by `bookings-page-client.tsx`. */
export function bookingLink(id: string): string {
  return `/bookings?bookingId=${encodeURIComponent(id)}`;
}

/** `/invoices?invoiceId=…` — read by `invoices-page-client.tsx`. */
export function invoiceLink(id: string): string {
  return `/invoices?invoiceId=${encodeURIComponent(id)}`;
}

/** `/quotes?quoteId=…` — read by `quotes-page-client.tsx`. */
export function quoteLink(id: string): string {
  return `/quotes?quoteId=${encodeURIComponent(id)}`;
}

/** `/schedule?jobId=…` — the calendar's own job sheet. */
export function scheduleJobLink(id: string): string {
  return `/schedule?jobId=${encodeURIComponent(id)}`;
}
