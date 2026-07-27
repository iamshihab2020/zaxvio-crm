/**
 * The one place that answers "is the business open then, and is that slot free?".
 *
 * Before this file there were three different answers to that question:
 *
 *   - the public portal blocked a slot only if another *booking* held it, so a day
 *     full of jobs booked over the phone still showed nine slots for sale (BOOK-21);
 *   - the internal calendar shaded working hours from the weekly schedule alone and
 *     ignored date overrides, so a contractor who closed 25 December saw the portal
 *     refuse bookings while their own calendar showed a normal working day (BOOK-10);
 *   - `PATCH /bookings/:id` validated nothing at all, so staff could reschedule into
 *     a slot the portal refuses to sell — and the portal would then keep offering
 *     that slot to the next customer (BOOK-09).
 *
 * Portal slots, calendar shading and dashboard rescheduling now all resolve through
 * here, so they cannot drift apart again.
 */
import {
  availabilitySchedules,
  scheduleOverrides,
  bookings,
  jobs,
  calendarEvents,
  eq,
  and,
  gte,
  lte,
  inArray,
  isNull,
  ne,
  sql,
  type getDb,
} from "@hvac-saas/database";
import { getDayOfWeek } from "../lib/timezone.js";

export type DbClient = ReturnType<typeof getDb>;

export interface AvailabilityWindow {
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

/** Normalise a Postgres `time` ("08:00:00") or an HH:MM string to HH:MM. */
function toHhMm(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

/** Minutes since midnight for an HH:MM string. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// ── Windows ──────────────────────────────────────────────────────────────────

/**
 * Working window for one date. A date override always wins over the weekly
 * schedule — including an override that closes the day, which returns `null`
 * rather than falling through to the recurring hours.
 */
export async function getAvailabilityWindow(
  db: DbClient,
  tenantId: string,
  dateStr: string,
): Promise<AvailabilityWindow | null> {
  const map = await getAvailabilityWindows(db, tenantId, dateStr, dateStr);
  return map.get(dateStr) ?? null;
}

/**
 * Working windows for every open date in a range, keyed by YYYY-MM-DD. Closed
 * dates are absent from the map rather than present-and-null, so `map.has(d)`
 * is a complete answer to "are they open".
 *
 * Two queries for a whole month, rather than two per day — the month view asks
 * for ~42 dates at once.
 */
export async function getAvailabilityWindows(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
): Promise<Map<string, AvailabilityWindow>> {
  const [weekly, overrides] = await Promise.all([
    db
      .select()
      .from(availabilitySchedules)
      .where(
        and(
          eq(availabilitySchedules.tenantId, tenantId),
          eq(availabilitySchedules.isActive, true),
        ),
      ),
    db
      .select()
      .from(scheduleOverrides)
      .where(
        and(
          eq(scheduleOverrides.tenantId, tenantId),
          gte(scheduleOverrides.overrideDate, from),
          lte(scheduleOverrides.overrideDate, to),
        ),
      ),
  ]);

  const byDayOfWeek = new Map<number, AvailabilityWindow>();
  for (const row of weekly) {
    const startTime = toHhMm(row.startTime);
    const endTime = toHhMm(row.endTime);
    if (startTime && endTime) byDayOfWeek.set(row.dayOfWeek, { startTime, endTime });
  }

  const overrideByDate = new Map(overrides.map((o) => [o.overrideDate, o]));

  const result = new Map<string, AvailabilityWindow>();
  // Anchor at UTC noon so a DST transition can never skip or repeat a calendar day.
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);

  while (cursor <= end) {
    const dateStr = cursor.toISOString().split("T")[0];
    const override = overrideByDate.get(dateStr);

    if (override) {
      const startTime = toHhMm(override.startTime);
      const endTime = toHhMm(override.endTime);
      if (override.isAvailable && startTime && endTime) {
        result.set(dateStr, { startTime, endTime });
      }
      // An unavailable override closes the day — never fall through to weekly.
    } else {
      const window = byDayOfWeek.get(cursor.getUTCDay());
      if (window) result.set(dateStr, window);
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

// ── Slots ────────────────────────────────────────────────────────────────────

/**
 * Whole-hour slot *start times* inside a window: "08:00"–"17:00" → 08:00 … 16:00.
 *
 * A start with minutes rounds up ("08:30" → first slot 09:00). A slot is offered
 * when it begins strictly before closing time — the contractor who set 17:30 is
 * saying they will take a 17:00 job.
 *
 * The old code did `const [endH] = endTime.split(":")`, discarding the end
 * minutes entirely, so 09:00–17:30 and 09:00–17:00 produced identical slot lists
 * and the extra half hour bought nothing (BOOK-23).
 */
export function generateTimeSlots(startTime: string, endTime: string): string[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  const slots: string[] = [];
  // First whole hour at or after the window opens.
  let cursor = Math.ceil(start / 60) * 60;
  while (cursor < end) {
    slots.push(`${String(cursor / 60).padStart(2, "0")}:00`);
    cursor += 60;
  }
  return slots;
}

/** A half-open [start, end) interval in minutes since midnight. */
interface Interval {
  start: number;
  end: number;
}

/** Default length assumed for an entry that has a start but no end. */
const DEFAULT_DURATION_MIN = 60;

function toInterval(
  start: string | null | undefined,
  end: string | null | undefined,
): Interval | null {
  const s = toHhMm(start);
  if (!s) return null;
  const e = toHhMm(end);
  const startMin = toMinutes(s);
  const endMin = e ? toMinutes(e) : startMin + DEFAULT_DURATION_MIN;
  return { start: startMin, end: Math.max(endMin, startMin + 1) };
}

/**
 * Everything that occupies part of a date, from all three sources the calendar
 * shows. Returned as intervals rather than slot names so a 90-minute job blocks
 * both hours it actually covers.
 */
export async function getOccupiedIntervals(
  db: DbClient,
  tenantId: string,
  dateStr: string,
  options: { excludeBookingId?: string } = {},
): Promise<Interval[]> {
  const bookingFilters = [
    eq(bookings.tenantId, tenantId),
    eq(bookings.bookingDate, dateStr),
    inArray(bookings.status, ["pending", "confirmed"] as const),
    isNull(bookings.archivedAt),
  ];
  if (options.excludeBookingId) {
    bookingFilters.push(ne(bookings.id, options.excludeBookingId));
  }

  const [bookingRows, jobRows, eventRows] = await Promise.all([
    db
      .select({ preferredTime: bookings.preferredTime })
      .from(bookings)
      .where(and(...bookingFilters)),
    db
      .select({
        scheduledStart: jobs.scheduledStart,
        scheduledEnd: jobs.scheduledEnd,
      })
      .from(jobs)
      .where(
        and(
          eq(jobs.tenantId, tenantId),
          eq(jobs.scheduledDate, dateStr),
          isNull(jobs.archivedAt),
        ),
      ),
    db
      .select({
        startTime: calendarEvents.startTime,
        endTime: calendarEvents.endTime,
      })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.tenantId, tenantId),
          eq(calendarEvents.eventDate, dateStr),
        ),
      ),
  ]);

  const intervals: Interval[] = [];
  for (const b of bookingRows) {
    const i = toInterval(b.preferredTime, null);
    if (i) intervals.push(i);
  }
  for (const j of jobRows) {
    const i = toInterval(j.scheduledStart, j.scheduledEnd);
    if (i) intervals.push(i);
  }
  for (const e of eventRows) {
    const i = toInterval(e.startTime, e.endTime);
    if (i) intervals.push(i);
  }
  return intervals;
}

/**
 * How many things overlap the hour starting at `slot`.
 *
 * Overlap, not equality: the old check compared an existing booking's
 * `preferred_time` to the slot string, so a job running 09:30–10:30 blocked
 * nothing at all.
 */
export function countOverlapping(intervals: Interval[], slot: string): number {
  const start = toMinutes(slot);
  const end = start + 60;
  return intervals.filter((i) => i.start < end && i.end > start).length;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
}

/**
 * The sellable slots for a date, with each marked free or taken.
 * `capacity` is how many appointments the business can run concurrently.
 */
export async function getSlotsForDate(
  db: DbClient,
  tenantId: string,
  dateStr: string,
  capacity: number,
  options: { excludeBookingId?: string } = {},
): Promise<SlotAvailability[]> {
  const window = await getAvailabilityWindow(db, tenantId, dateStr);
  if (!window) return [];

  const intervals = await getOccupiedIntervals(db, tenantId, dateStr, options);
  return generateTimeSlots(window.startTime, window.endTime).map((time) => ({
    time,
    available: countOverlapping(intervals, time) < capacity,
  }));
}

// ── The gate ─────────────────────────────────────────────────────────────────

export interface BookableCheck {
  tenantId: string;
  /** Tenant timezone — "at least 24h out" is meaningless without it. */
  timezone: string;
  dateStr: string;
  time: string;
  capacity: number;
  /** Earliest bookable date, YYYY-MM-DD. */
  minDate: string;
  /** Latest bookable date, YYYY-MM-DD. */
  maxDate: string;
  /** Ignore this booking when counting occupancy — it is the one being moved. */
  excludeBookingId?: string;
}

export type BookableResult = { ok: true } | { ok: false; message: string };

/**
 * Every rule the public portal enforces, in one callable place so the dashboard
 * enforces the same ones. Staff can bypass it deliberately (`force`), which is
 * different from it never having run.
 */
export async function checkSlotBookable(
  db: DbClient,
  check: BookableCheck,
): Promise<BookableResult> {
  if (check.dateStr < check.minDate) {
    return { ok: false, message: "Booking date must be at least 24 hours in the future." };
  }
  if (check.dateStr > check.maxDate) {
    return { ok: false, message: "Booking date must be within 3 months." };
  }

  const window = await getAvailabilityWindow(db, check.tenantId, check.dateStr);
  if (!window) {
    return { ok: false, message: "No availability on the selected date." };
  }

  if (!check.time.endsWith(":00")) {
    return { ok: false, message: "Booking time must be on the hour (e.g., 09:00, 10:00)." };
  }

  const slots = generateTimeSlots(window.startTime, window.endTime);
  if (!slots.includes(check.time)) {
    return { ok: false, message: "Selected time is outside available hours." };
  }

  const intervals = await getOccupiedIntervals(db, check.tenantId, check.dateStr, {
    excludeBookingId: check.excludeBookingId,
  });
  if (countOverlapping(intervals, check.time) >= check.capacity) {
    return {
      ok: false,
      message: "This time slot is no longer available. Please choose another.",
    };
  }

  return { ok: true };
}

/** Days of the week the tenant is ever open — drives the month calendar. */
export async function getOpenDatesInRange(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
): Promise<string[]> {
  const windows = await getAvailabilityWindows(db, tenantId, from, to);
  return [...windows.keys()].sort();
}

/**
 * Seed Mon–Fri 8-5 for a tenant that has no schedule rows yet.
 * Idempotent: the unique index on (tenant_id, day_of_week) plus
 * `onConflictDoNothing` makes a concurrent second call a no-op.
 */
export async function seedDefaultAvailability(db: DbClient, tenantId: string) {
  await db
    .insert(availabilitySchedules)
    .values(
      [0, 1, 2, 3, 4, 5, 6].map((day) => ({
        tenantId,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "17:00",
        isActive: day >= 1 && day <= 5,
      })),
    )
    .onConflictDoNothing();

  return db
    .select()
    .from(availabilitySchedules)
    .where(eq(availabilitySchedules.tenantId, tenantId))
    .orderBy(sql`${availabilitySchedules.dayOfWeek} asc`);
}

export { getDayOfWeek };
