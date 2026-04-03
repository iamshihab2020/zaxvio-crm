import type { getDb } from "@hvac-saas/database";

export type DbClient = ReturnType<typeof getDb>;

export interface DateRangeParams {
  tenantId: string;
  rangeFrom: string; // YYYY-MM-DD
  rangeTo: string; // YYYY-MM-DD
  prevFrom: string; // YYYY-MM-DD
  prevTo: string; // YYYY-MM-DD
}

/**
 * Compute date range params from request query + tenantId.
 */
export function buildDateRangeParams(
  tenantId: string,
  from: string | undefined,
  to: string | undefined,
): DateRangeParams {
  const now = new Date();
  const rangeFrom = from ?? formatDateISO(startOfMonthDate(now));
  const rangeTo = to ?? formatDateISO(now);

  const fromDate = new Date(rangeFrom);
  const toDate = new Date(rangeTo);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 86400000); // day before rangeFrom
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return {
    tenantId,
    rangeFrom,
    rangeTo,
    prevFrom: formatDateISO(prevFrom),
    prevTo: formatDateISO(prevTo),
  };
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function startOfMonthDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
