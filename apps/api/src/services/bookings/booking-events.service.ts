/**
 * Workflow events for a booking.
 *
 * Bookings are the only subject in the system that may have **no customer row**
 * — a portal visitor submits one before anyone in the CRM has touched them, and
 * `bookings.customer_id` stays null until a conversion links or creates one. So
 * this file reads contact details off the booking itself, exactly as the
 * confirmation email has always done, rather than joining `customers` and
 * dropping the events that matter most: the ones for a brand-new lead.
 *
 * Four callers write a booking's status — `PATCH /bookings/:id`,
 * `DELETE /bookings/:id`, `POST /bookings/bulk-status-update` and the conversion
 * — and `emitBookingStatusEvents` is deliberately the only way any of them emits.
 * BOOK-22 already found those paths disagreeing about which transitions were
 * legal; they now share a status machine, and this shares its events.
 */

import {
  bookings,
  and,
  eq,
  inArray,
  type getDb,
} from "@hvac-saas/database";
import {
  bookingCancelled,
  bookingConfirmed,
  bookingConverted,
  bookingCreated,
  bookingRescheduled,
  type BookingArgs,
} from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

/**
 * Read bookings into producer shape.
 *
 * Called **after** the write, so the payload carries the row as it now stands
 * rather than as the request found it. Tenant-scoped, like every read here.
 */
export async function loadBookingEventContext(
  db: Db,
  tenantId: string,
  bookingIds: string[],
): Promise<Map<string, BookingArgs & { description: string | null; createdAt: Date }>> {
  const out = new Map<
    string,
    BookingArgs & { description: string | null; createdAt: Date }
  >();
  if (bookingIds.length === 0) return out;

  const rows = await db
    .select({
      id: bookings.id,
      customerId: bookings.customerId,
      customerName: bookings.customerName,
      customerEmail: bookings.customerEmail,
      customerPhone: bookings.customerPhone,
      serviceType: bookings.serviceType,
      bookingDate: bookings.bookingDate,
      preferredTime: bookings.preferredTime,
      address: bookings.address,
      description: bookings.description,
      status: bookings.status,
      createdAt: bookings.createdAt,
    })
    .from(bookings)
    .where(and(eq(bookings.tenantId, tenantId), inArray(bookings.id, bookingIds)));

  for (const row of rows) {
    out.set(row.id, {
      id: row.id,
      customerId: row.customerId,
      customerName: row.customerName,
      customerEmail: row.customerEmail,
      customerPhone: row.customerPhone,
      serviceType: row.serviceType,
      bookingDate: row.bookingDate,
      preferredTime: row.preferredTime,
      address: row.address,
      status: row.status,
      description: row.description,
      createdAt: row.createdAt,
    });
  }

  return out;
}

export interface EmitBookingCreatedArgs {
  tenantId: string;
  /** Null for the public portal — a visitor is not a user. */
  actorUserId: string | null;
  bookingId: string;
  source: "portal" | "dashboard" | "api";
}

export async function emitBookingCreatedEvent(
  db: Db,
  args: EmitBookingCreatedArgs,
): Promise<void> {
  const booking = (
    await loadBookingEventContext(db, args.tenantId, [args.bookingId])
  ).get(args.bookingId);
  if (!booking) return;

  await bookingCreated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    booking,
    source: args.source,
  });
}

export interface BookingStatusTransition {
  bookingId: string;
  from: BookingStatus;
  to: BookingStatus;
}

export interface EmitBookingStatusArgs {
  tenantId: string;
  actorUserId: string | null;
  transitions: BookingStatusTransition[];
  /** Only meaningful for a cancellation; null when the caller gave no reason. */
  reason?: string | null;
}

/**
 * Emit `booking.confirmed` / `booking.cancelled` for real transitions only.
 *
 * "Real" means `from !== to`. Re-saving a confirmed booking must not send a
 * second confirmation, and `DELETE` on an already-cancelled booking is
 * explicitly idempotent in the route — the event has to match that promise or
 * a cancellation automation fires every time someone clicks Cancel twice.
 *
 * `completed` and `pending` have no event of their own by design: nothing in
 * the product treats a booking reaching those states as an occasion, and adding
 * an event with no trigger behind it would be taxonomy for its own sake.
 */
export async function emitBookingStatusEvents(
  db: Db,
  args: EmitBookingStatusArgs,
): Promise<void> {
  const real = args.transitions.filter((t) => t.from !== t.to);
  if (real.length === 0) return;

  const contexts = await loadBookingEventContext(
    db,
    args.tenantId,
    real.map((t) => t.bookingId),
  );

  for (const transition of real) {
    const booking = contexts.get(transition.bookingId);
    if (!booking) continue;

    if (transition.to === "confirmed") {
      await bookingConfirmed(db, {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId,
        booking,
        confirmedAt: new Date(),
      });
    }

    if (transition.to === "cancelled") {
      await bookingCancelled(db, {
        tenantId: args.tenantId,
        actorUserId: args.actorUserId,
        booking,
        reason: args.reason ?? null,
        cancelledAt: new Date(),
      });
    }
  }
}

export interface EmitBookingRescheduledArgs {
  tenantId: string;
  actorUserId: string | null;
  bookingId: string;
  /** The date and time as they were **before** the update. */
  fromDate: string;
  fromTime: string | null;
}

export async function emitBookingRescheduledEvent(
  db: Db,
  args: EmitBookingRescheduledArgs,
): Promise<void> {
  const booking = (
    await loadBookingEventContext(db, args.tenantId, [args.bookingId])
  ).get(args.bookingId);
  if (!booking) return;

  // A PATCH that names `bookingDate` with the same value it already had is not
  // a reschedule. The route decides *whether* to call this; the guard here is
  // for the case where it decided on the presence of a key rather than a change
  // of value, which is what it does today.
  const sameDate = args.fromDate === booking.bookingDate;
  const sameTime = (args.fromTime ?? null) === (booking.preferredTime ?? null);
  if (sameDate && sameTime) return;

  await bookingRescheduled(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    booking,
    fromDate: args.fromDate,
    fromTime: args.fromTime,
  });
}

export interface EmitBookingConvertedArgs {
  tenantId: string;
  actorUserId: string | null;
  bookingId: string;
  job: { id: string; jobNumber: string };
}

export async function emitBookingConvertedEvent(
  db: Db,
  args: EmitBookingConvertedArgs,
): Promise<void> {
  const booking = (
    await loadBookingEventContext(db, args.tenantId, [args.bookingId])
  ).get(args.bookingId);
  if (!booking) return;

  await bookingConverted(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    booking,
    job: args.job,
    convertedAt: new Date(),
  });
}
