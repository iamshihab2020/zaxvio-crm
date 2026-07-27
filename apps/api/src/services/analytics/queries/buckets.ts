import { sql } from "@hvac-saas/database";
import type { TrendGranularity } from "../types.js";

/**
 * Shared `generate_series` bucketing for every trend query.
 *
 * Before this existed each trend hardcoded month buckets, so "Last 7 days" on
 * /reports rendered a single bar. Granularity now comes from the request (or is
 * inferred from the span) and every trend goes through the same series, so a
 * range is bucketed identically on /dashboard and /reports.
 *
 * The interval and `date_trunc` unit are fixed `sql` literals selected by a
 * closed enum — no request value is ever concatenated into SQL text. The
 * `to_char` format strings are bind parameters.
 */

/** `date_trunc` unit literals. Not user input — keys come from a Zod enum. */
const TRUNC = {
  day: sql`'day'`,
  week: sql`'week'`,
  month: sql`'month'`,
} as const;

/** Step interval literals, matching TRUNC. */
const STEP = {
  day: sql`INTERVAL '1 day'`,
  week: sql`INTERVAL '1 week'`,
  month: sql`INTERVAL '1 month'`,
} as const;

/** Stable sort/identity key per bucket. */
const KEY_FORMAT: Record<TrendGranularity, string> = {
  day: "YYYY-MM-DD",
  week: "YYYY-MM-DD",
  month: "YYYY-MM",
};

/** Human label rendered on the chart axis. */
const LABEL_FORMAT: Record<TrendGranularity, string> = {
  day: "Mon DD",
  week: '"W"IW YYYY',
  month: "Mon YYYY",
};

export interface BucketSeries {
  /** `generate_series(...) AS m(bucket)` — drop straight into `FROM`. */
  series: ReturnType<typeof sql>;
  /** One bucket width, for `m.bucket + ${step}` upper bounds. */
  step: ReturnType<typeof sql>;
  /** `to_char(m.bucket, …)` producing the sort key. */
  key: ReturnType<typeof sql>;
  /** `to_char(m.bucket, …)` producing the axis label. */
  label: ReturnType<typeof sql>;
}

/** Build the bucket series for a granularity over `[from, to]`. */
export function bucketSeries(
  granularity: TrendGranularity,
  from: string,
  to: string,
): BucketSeries {
  return {
    series: sql`generate_series(
      date_trunc(${TRUNC[granularity]}, ${from}::date),
      date_trunc(${TRUNC[granularity]}, ${to}::date),
      ${STEP[granularity]}
    ) AS m(bucket)`,
    step: STEP[granularity],
    key: sql`to_char(m.bucket, ${KEY_FORMAT[granularity]})`,
    label: sql`to_char(m.bucket, ${LABEL_FORMAT[granularity]})`,
  };
}
