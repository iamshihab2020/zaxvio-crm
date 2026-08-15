/**
 * `trigger.booking.rescheduled`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every record in the tenant,
 * then throwing almost all of them away.
 *
 * By the time this executes the decision is already made, so it only has to hand
 * the next step something to reference.
 *
 * Only the **new** slot is on the output. The old one is on the event payload,
 * not on the restored context — `restoreContext` re-reads the booking row, and
 * the row no longer holds where it used to be.
 */

import type { Executor } from "./types.js";

const triggerBookingRescheduled: Executor = async ({ ctx }) => ({
  output: {
    bookingId: ctx.booking?.id ?? null,
    date: ctx.booking?.date ?? null,
    startTime: ctx.booking?.startTime ?? null,
    endTime: ctx.booking?.endTime ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerBookingRescheduled;
