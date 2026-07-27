/**
 * Booking business rules shared by the single and bulk endpoints.
 *
 * These lived in two places with two different answers: `POST /bookings/bulk-status-update`
 * had a real state machine, while `PATCH /bookings/:id` only asked "is it already
 * terminal?". So `pending -> completed` succeeded one at a time and was rejected in
 * bulk, and `confirmed -> pending` succeeded singly and was rejected in bulk. The
 * asymmetry had been inverted rather than removed (BOOK-22).
 */
import type { BookingStatus } from "../lib/schemas/bookings.js";

/**
 * Legal status transitions. `completed` and `cancelled` are terminal — a booking
 * that is done or called off does not go back to pending.
 */
export const VALID_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled", "completed"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export function canTransitionBooking(
  from: BookingStatus,
  to: BookingStatus,
): boolean {
  if (from === to) return true; // idempotent no-op
  return VALID_BOOKING_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionError(from: BookingStatus, to: BookingStatus): string {
  if (VALID_BOOKING_TRANSITIONS[from]?.length === 0) {
    return `This booking is ${from} and can no longer be changed.`;
  }
  return `Cannot change a ${from} booking to ${to}.`;
}

/** Statuses that still hold a slot on the calendar. */
export const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed"] as const;
