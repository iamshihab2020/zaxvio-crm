/**
 * Lets the booking status page know it was reached by submitting the form, as
 * opposed to a link in the confirmation email or a reload.
 *
 * Both pages are client components in one JS context, so a module variable
 * carries the booking id across the `router.push` and is gone after a hard
 * load. The status page reads it once while rendering, never during
 * hydration (a hard load starts with `null`), so the server HTML and the first
 * client render always agree. Comparing ids rather than consuming a flag keeps
 * the read pure: React may call a state initializer twice in development.
 */
let submittedBookingId: string | null = null;

export function markBookingSubmitted(bookingId: string): void {
  submittedBookingId = bookingId;
}

export function wasJustSubmitted(bookingId: string): boolean {
  return submittedBookingId === bookingId;
}
