/**
 * Timezone helpers for date calculations in tenant context.
 */

/**
 * Get "today" as YYYY-MM-DD in the tenant's timezone.
 */
export function getTenantToday(timezone: string): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
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
