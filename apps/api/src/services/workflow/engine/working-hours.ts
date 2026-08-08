/**
 * Pushing a resume time into working hours.
 *
 * A three-day wait that comes due at 02:40 and then emails a customer is a real
 * problem, and the two obvious fixes are both wrong:
 *
 *  - **Blocking the send** — which is what the system this was ported from does
 *    (`{ success: false, status: "blocked_quiet_hours" }`) — means the customer
 *    never hears from you at all. A follow-up that silently does not happen is
 *    worse than one that arrives an hour early.
 *  - **Hardcoding 9pm–8am**, as that system also does, is wrong for everyone
 *    whose day is not that. An emergency plumber's night *is* their working
 *    hours.
 *
 * So this **defers**: the wait ends at the next moment the business is open.
 * Nothing is dropped, and nothing about quiet hours is decided globally.
 *
 * It reuses the tenant's real availability — the same weekly schedule and date
 * overrides the booking portal and the calendar read, already configured in
 * Settings → Scheduling. There is no second definition of "when are we open",
 * so a tenant who closes Fridays gets that for bookings and follow-ups alike,
 * and a public holiday entered once is honoured by both. That is the same
 * reasoning `availability.service.ts` was written under (BOOK-10, BOOK-21): the
 * bug was never the answer, it was having three of them.
 */

import {
  getAvailabilityWindows,
  type AvailabilityWindow,
} from "../../availability.service.js";
import { zonedDate, zonedToUtc } from "./zoned-time.js";
import type { ExecutorDb } from "./executors/types.js";

/**
 * How far ahead to look for an open day.
 *
 * A tenant with no availability at all, or one closed for a fortnight, must not
 * send this searching forever. Past the horizon it gives up and resumes at the
 * time originally computed — late is recoverable, never is not.
 */
const HORIZON_DAYS = 14;

export interface WorkingMoment {
  /** When the run should actually resume. */
  at: Date;
  /** Whether that differs from what was asked for. */
  deferred: boolean;
  /**
   * Why, in the language the replay page shows a tenant — or null when nothing
   * moved. Never a code.
   */
  reason: string | null;
}

/**
 * The first moment at or after `instant` that falls inside working hours.
 *
 * Returns `instant` untouched when it already does, when the tenant has no
 * availability configured at all, or when nothing opens inside the horizon.
 */
export async function nextWorkingMoment(
  db: ExecutorDb,
  tenantId: string,
  timezone: string,
  instant: Date,
): Promise<WorkingMoment> {
  const unchanged: WorkingMoment = { at: instant, deferred: false, reason: null };

  // Stepped as calendar dates, not as +24h. Adding a real day to a local time
  // near midnight does not always advance the local date — on the fall-back day
  // it lands on the same date twice — so the sequence would silently repeat one
  // day and lose the last. `getAvailabilityWindows` iterates its own range this
  // way for the same reason.
  const firstDay = zonedDate(instant, timezone);
  const windows = await getAvailabilityWindows(
    db,
    tenantId,
    firstDay,
    shiftDate(firstDay, HORIZON_DAYS),
  );

  // No schedule at all is not "closed forever" — it is a tenant who has never
  // filled that page in, and refusing to ever resume their automations would be
  // a strange way to tell them so.
  if (windows.size === 0) return unchanged;

  for (let offset = 0; offset <= HORIZON_DAYS; offset += 1) {
    const day = shiftDate(firstDay, offset);
    const open = windows.get(day);
    if (!open) continue; // closed that day

    const opensAt = zonedToUtc(day, open.startTime, timezone);
    const closesAt = zonedToUtc(day, open.endTime, timezone);
    if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
      continue;
    }

    // Already inside the window. Note this is checked before the "next opening"
    // branch, so a wait that comes due mid-morning is not pushed anywhere.
    if (instant >= opensAt && instant < closesAt) return unchanged;

    if (opensAt > instant) {
      return {
        at: opensAt,
        deferred: true,
        reason: `Waited until ${describe(day, open, timezone)} because the automation came due outside your working hours.`,
      };
    }

    // Past closing on this day — fall through and try the next open one.
  }

  return unchanged;
}

/** YYYY-MM-DD plus n calendar days. Pure string arithmetic — no zone involved. */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  // Noon UTC so a `Date` built from this can never be nudged across a day
  // boundary; month ends and leap years are then handled by `Date` itself.
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 12));
  return shifted.toISOString().slice(0, 10);
}

/** "Monday, Aug 11 at 9:00 AM" in the tenant's zone, for the run log. */
function describe(
  day: string,
  open: AvailabilityWindow,
  timezone: string,
): string {
  const at = zonedToUtc(day, open.startTime, timezone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}
