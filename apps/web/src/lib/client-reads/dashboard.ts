/**
 * Browser reads for the dashboard: the TanStack Query side of
 * `@/actions/dashboard`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type { DashboardStats, DashboardPipelineItem } from "@hvac-saas/types";
import type * as actions from "@/actions/dashboard";
import { buildQuery, readJson } from "@/lib/api-client";

const FALLBACK = "Request failed";

/** The action's private `apiGet`: its message carries the status when the API sent none. */
async function apiGet<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  const r = await readJson(path, FALLBACK);
  if (r.ok) return { data: r.json.data as T, error: null };
  if (r.status === 0) {
    return {
      data: null,
      error: r.error === "Network error" ? r.error : "The dashboard took too long to respond.",
    };
  }
  return { data: null, error: r.error === FALLBACK ? `${FALLBACK} (${r.status})` : r.error };
}

export async function getDashboardStats(
  params?: Parameters<typeof actions.getDashboardStats>[0],
): Promise<{ data: DashboardStats | null; error: string | null }> {
  const qs = buildQuery({
    from: params?.from,
    to: params?.to,
    granularity: params?.granularity,
  });
  return apiGet<DashboardStats>(`/dashboard/stats${qs}`);
}

export async function getDashboardPipeline(
  pipelineId?: string | null,
): Promise<{ data: DashboardPipelineItem[] | null; error: string | null }> {
  const qs = pipelineId ? `?pipelineId=${encodeURIComponent(pipelineId)}` : "";
  return apiGet<DashboardPipelineItem[]>(`/dashboard/pipeline${qs}`);
}
