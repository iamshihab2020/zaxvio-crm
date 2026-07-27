/**
 * "Now" and "today" resolved against the tenant's timezone.
 *
 * The calendar builds every event as `new Date(\`${date}T${time}\`)` — no offset,
 * so the Date's *local* fields carry the appointment's wall-clock time. That is
 * the right way to render it: a job at 09:00 should read 09:00 on any screen.
 *
 * What was wrong is everything compared against it. `isToday()`, the
 * scroll-to-current-time offset, the initial view date and the "today" button
 * all used the browser's clock, so a laptop in the wrong zone — or a contractor
 * working away from home — got a calendar that disagreed with the dashboard
 * agenda about which day it is (BOOK-25).
 *
 * These helpers return Dates in the same wall-clock space the events live in, so
 * `getHours()` / `getDay()` / `isToday()` compare like with like.
 */

/**
 * The tenant's current wall-clock time, expressed as a Date whose *local* fields
 * match it. Not a real instant — deliberately. Use it only for comparing against
 * calendar events built the same way, never for storage or arithmetic on
 * timestamps.
 */
export function tenantNow(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    // `hour12: false` yields "24" for midnight in some ICU builds.
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
}

/** The tenant's today as YYYY-MM-DD. */
export function tenantToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Whether `date` (in wall-clock space) falls on the tenant's today. */
export function isTenantToday(date: Date, timeZone: string): boolean {
  const now = tenantNow(timeZone);
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
