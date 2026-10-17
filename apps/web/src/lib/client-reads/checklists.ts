/**
 * Browser reads for checklist templates: the TanStack Query side of
 * `@/actions/checklists`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/checklists";
import { pickQuery, readJson } from "@/lib/api-client";

const CHECKLIST_LIST_KEYS = ["serviceType", "showInactive"] as const;

export async function getChecklistTemplates(
  params?: Parameters<typeof actions.getChecklistTemplates>[0],
) {
  const r = await readJson(
    `/checklists${pickQuery(params, CHECKLIST_LIST_KEYS)}`,
    "Failed to fetch checklists",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getChecklistTemplate(id: string) {
  const r = await readJson(`/checklists/${id}`, "Checklist template not found");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
