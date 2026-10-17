/**
 * Browser reads for pipeline stages: the TanStack Query side of
 * `@/actions/pipeline-stages`. Mirrors the server action exactly; see
 * lib/api-client.ts for why reads moved off server actions.
 */
import { readJson } from "@/lib/api-client";

export async function getPipelineStages(pipelineId?: string) {
  const path = pipelineId
    ? `/pipeline-stages?pipelineId=${encodeURIComponent(pipelineId)}`
    : "/pipeline-stages";
  const r = await readJson(path, "Failed to fetch pipeline stages");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
