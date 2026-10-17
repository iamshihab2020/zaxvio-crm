/**
 * Browser reads for pipelines: the TanStack Query side of `@/actions/pipelines`.
 * Mirrors the server action exactly; see lib/api-client.ts for why reads moved
 * off server actions.
 */
import { readJson } from "@/lib/api-client";

export async function getPipelines() {
  const r = await readJson("/pipelines", "Failed to fetch pipelines");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
