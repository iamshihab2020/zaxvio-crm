/**
 * Timezone helpers for date calculations in tenant context.
 *
 * This is the single implementation. There used to be a second one in
 * `services/analytics/types.ts` built on `Intl.DateTimeFormat` while this file
 * used `toLocaleDateString`. They agreed on every input anyone tried, but
 * nothing kept them that way — and "today" being wrong by a day is exactly the
 * class of bug the dashboard pass spent a day removing (BOOK-30). Analytics now
 * re-exports `todayInTimezone` from here.
 */

/**
 * Today's calendar date in the given IANA timezone, as YYYY-MM-DD.
 *
 * `new Date().toISOString()` returns the UTC date, which rolls over at 6-7 PM for
 * a US Central tenant — "Jobs Today" would empty out during the evening. `en-CA`
 * formats as YYYY-MM-DD, so no manual assembly is needed.
 */
export function todayInTimezone(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Get "today" as YYYY-MM-DD in the tenant's timezone.
 * Alias of {@link todayInTimezone}, kept for the booking/availability call sites.
 */
export function getTenantToday(timezone: string): string {
  return todayInTimezone(timezone);
}

/**
 * Get "tomorrow" as YYYY-MM-DD in the tenant's timezone.
 * Uses UTC construction to avoid server-local timezone issues (DF-BK-19).
 */
export function getTenantTomorrow(timezone: string): string {
  const todayStr = getTenantToday(timezone);
  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  return tomorrow.toISOString().split("T")[0];
}

/**
 * Get a date N months from now as YYYY-MM-DD.
 * Uses UTC construction to avoid server-local timezone issues (DF-BK-19).
 */
export function getMaxBookingDate(timezone: string, monthsAhead: number = 3): string {
  const todayStr = getTenantToday(timezone);
  const [y, m, d] = todayStr.split("-").map(Number);
  const future = new Date(Date.UTC(y, m - 1 + monthsAhead, d));
  return future.toISOString().split("T")[0];
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) for a date string YYYY-MM-DD.
 */
export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z"); // Noon UTC to avoid timezone shift
  return d.getUTCDay();
}

/**
 * A human-readable date ("Aug 1, 2026") in the tenant's timezone.
 *
 * The job-completion email stamped `new Date().toLocaleDateString("en-US", …)`
 * with no `timeZone`, so a customer-facing email carried whatever date and
 * locale the *server* happened to be in — UTC on Neon, which for a US Central
 * tenant is tomorrow's date all evening.
 */
export function formatDateInTimezone(
  timezone: string,
  date: Date = new Date(),
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
