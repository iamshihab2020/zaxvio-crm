/**
 * Browser reads for reports: the TanStack Query side of `@/actions/reports`.
 * Same signature, query keys, error text and return shape as the server action,
 * including its section check; see lib/api-client.ts for why.
 */
import type { ReportSectionResponse } from "@hvac-saas/types";
import type * as actions from "@/actions/reports";
import { buildQuery, readJson } from "@/lib/api-client";

const FALLBACK = "Failed to fetch report data";

export async function getReportStats(
  params: Parameters<typeof actions.getReportStats>[0],
): Promise<actions.ReportStatsResult> {
  const qs = buildQuery({
    section: params.section,
    from: params.from,
    to: params.to,
    granularity: params.granularity,
  });
  const r = await readJson(`/reports/stats${qs}`, FALLBACK);
  if (!r.ok) {
    return { data: null, error: r.error === FALLBACK ? `${FALLBACK} (${r.status})` : r.error };
  }

  const json = r.json as { data?: ReportSectionResponse };
  if (!json.data) {
    return { data: null, error: "The report response was empty" };
  }

  // If the API ever echoes a different section than was asked for, the payload
  // would not match the tab about to render it; fail here, not in a chart.
  if (json.data.section !== params.section) {
    return {
      data: null,
      error: `Expected the ${params.section} report but received ${json.data.section}`,
    };
  }

  return { data: json.data, error: null };
}
