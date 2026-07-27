import type { ReportGranularity } from "@hvac-saas/types";

/** "by day" / "by week" / "by month" — the bucket size the API actually used. */
export function granularityLabel(g: ReportGranularity): string {
  return g === "day" ? "by day" : g === "week" ? "by week" : "by month";
}

/** Axis/legend noun for a bucket, e.g. "Jobs per week". */
export function bucketNoun(g: ReportGranularity): string {
  return g === "day" ? "day" : g === "week" ? "week" : "month";
}
