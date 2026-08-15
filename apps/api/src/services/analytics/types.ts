import type { getDb } from "@hvac-saas/database";
import { todayInTimezone } from "../../lib/timezone.js";

/**
 * The database handle every analytics and costing query accepts.
 *
 * `Omit<…, "$client">` rather than the bare `ReturnType<typeof getDb>`. A
 * Drizzle transaction has every query method but no `$client`, so the bare form
 * makes anything typed with it **uncallable from inside a transaction** — and it
 * fails at the *call site*, so the fix looks like "move this statement out of
 * the transaction" rather than "widen this type".
 *
 * This is the **fourth** recurrence of that one mistake: `job-stages.service.ts`
 * (QUO-02), `recalculateJobTotals`, `availability.service.ts` — which ships its
 * own `DbClient` already in this form, so the repo had two types of the same
 * name disagreeing on exactly this point — and now here, where it made
 * `getJobCostSummary` impossible to call under `withRollback`.
 *
 * Strictly a widening: nothing in this codebase reads `.$client`. Every one of
 * its 50-odd occurrences is an `Omit` exactly like this one, which is the real
 * tell that the bare form was never the intended type anywhere.
 */
export type DbClient = Omit<ReturnType<typeof getDb>, "$client">;

/** Bucket size for every `generate_series` trend. */
export type TrendGranularity = "day" | "week" | "month";

export interface DateRangeParams {
  tenantId: string;
  /** IANA timezone of the tenant. Every "today" boundary is resolved against this. */
  timezone: string;
  rangeFrom: string; // YYYY-MM-DD
  rangeTo: string; // YYYY-MM-DD
  /** Previous window of equal *day span*, ending the day before `rangeFrom`. */
  prevFrom: string; // YYYY-MM-DD
  prevTo: string; // YYYY-MM-DD
  /**
   * Previous window of equal *bucket count*: the whole range shifted back by
   * exactly as many buckets as it spans. Unlike `prevFrom`/`prevTo` this is
   * guaranteed to produce the same number of `generate_series` rows as the
   * current range, which is what makes a point-for-point comparison line
   * possible (see `bucketCount`).
   */
  compareFrom: string; // YYYY-MM-DD
  compareTo: string; // YYYY-MM-DD
  /** Bucket size used by every trend query built from these params. */
  granularity: TrendGranularity;
}

/**
 * Today's calendar date in the given IANA timezone, as YYYY-MM-DD.
 *
 * Re-exported from `lib/timezone.ts` rather than reimplemented: this file and
 * that one used to carry two independent versions of the same calculation
 * (BOOK-30).
 */
export { todayInTimezone };

/** Shift a YYYY-MM-DD date string by whole days, staying on the calendar grid. */
export function addDays(isoDate: string, days: number): string {
  // Anchor at UTC noon so DST transitions can never shift the calendar day.
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/** Shift a YYYY-MM-DD date string by whole months and snap to the 1st. */
export function startOfMonthsAgo(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().split("T")[0];
}

/** Whole days between two YYYY-MM-DD dates (never negative). */
export function daysBetween(from: string, to: string): number {
  const ms =
    Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/**
 * Pick a bucket size that yields a readable number of points for the span.
 * Mirrors `granularityForSpan` on the dashboard client so both surfaces bucket
 * the same range identically.
 */
export function pickGranularity(from: string, to: string): TrendGranularity {
  const days = daysBetween(from, to);
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

/** JS equivalent of Postgres `date_trunc(unit, d)` for a YYYY-MM-DD string. */
function truncToBucket(isoDate: string, g: TrendGranularity): string {
  if (g === "day") return isoDate;
  if (g === "month") return `${isoDate.slice(0, 7)}-01`;
  // date_trunc('week') snaps to ISO Monday.
  const d = new Date(`${isoDate}T12:00:00Z`);
  const backToMonday = (d.getUTCDay() + 6) % 7; // Mon->0 … Sun->6
  d.setUTCDate(d.getUTCDate() - backToMonday);
  return d.toISOString().split("T")[0];
}

/**
 * How many rows `generate_series(date_trunc(g, from), date_trunc(g, to), 1 g)`
 * returns. Computed here rather than in SQL so the comparison window can be
 * sized before either query runs.
 */
export function bucketCount(
  from: string,
  to: string,
  g: TrendGranularity,
): number {
  const a = truncToBucket(from, g);
  const b = truncToBucket(to, g);
  if (g === "month") {
    const [ay, am] = a.split("-").map(Number);
    const [by, bm] = b.split("-").map(Number);
    return Math.max(1, (by - ay) * 12 + (bm - am) + 1);
  }
  const days = daysBetween(a, b);
  return Math.max(1, Math.floor(days / (g === "week" ? 7 : 1)) + 1);
}

/** Shift a YYYY-MM-DD date back by `n` whole buckets. */
function shiftBackBuckets(
  isoDate: string,
  g: TrendGranularity,
  n: number,
): string {
  if (g !== "month") return addDays(isoDate, -n * (g === "week" ? 7 : 1));
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dayOfMonth = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  // Clamp: Mar 31 shifted back one month is Feb 28/29, not Mar 3.
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(dayOfMonth, lastDay));
  return d.toISOString().split("T")[0];
}

/**
 * Compute date range params from request query + tenant context.
 * Defaults to month-to-date in the tenant's timezone.
 */
export function buildDateRangeParams(
  tenantId: string,
  from: string | undefined,
  to: string | undefined,
  timezone: string,
  granularity?: TrendGranularity,
): DateRangeParams {
  const today = todayInTimezone(timezone);
  const rangeFrom = from ?? `${today.slice(0, 7)}-01`;
  const rangeTo = to ?? today;

  // Previous period: same length, ending the day before rangeFrom.
  const spanDays = daysBetween(rangeFrom, rangeTo);
  const prevTo = addDays(rangeFrom, -1);
  const prevFrom = addDays(prevTo, -spanDays);

  // Comparison period: the same range shifted back by its own bucket count.
  // Shifting *both* endpoints by whole buckets preserves the bucket count
  // exactly, so the two trend series can be paired index-for-index.
  const bucket = granularity ?? pickGranularity(rangeFrom, rangeTo);
  const buckets = bucketCount(rangeFrom, rangeTo, bucket);
  const compareFrom = shiftBackBuckets(rangeFrom, bucket, buckets);
  const compareTo = shiftBackBuckets(rangeTo, bucket, buckets);

  return {
    tenantId,
    timezone,
    rangeFrom,
    rangeTo,
    prevFrom,
    prevTo,
    compareFrom,
    compareTo,
    granularity: bucket,
  };
}

/** "hvac_repair" / "hvac-repair" -> "Hvac Repair". Shared by every analytics label. */
export function titleCase(input: string | null | undefined): string {
  if (!input) return "Other";
  return input.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
