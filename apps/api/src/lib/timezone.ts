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
 */
export function getTenantTomorrow(timezone: string): string {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const tomorrow = new Date(todayStr);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0];
}

/**
 * Get a date N months from now as YYYY-MM-DD.
 */
export function getMaxBookingDate(timezone: string, monthsAhead: number = 3): string {
  const todayStr = getTenantToday(timezone);
  const d = new Date(todayStr);
  d.setMonth(d.getMonth() + monthsAhead);
  return d.toISOString().split("T")[0];
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) for a date string YYYY-MM-DD.
 */
export function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00Z"); // Noon UTC to avoid timezone shift
  return d.getUTCDay();
}
