/**
 * Browser reads for automations: the TanStack Query side of
 * `@/actions/workflows`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/workflows";
import { buildQuery, readJson, readListResult, readResult } from "@/lib/api-client";
import type { PaginationData } from "@/lib/pagination";

export async function getWorkflows(params: Parameters<typeof actions.getWorkflows>[0] = {}) {
  const qs = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    // Explicit strings, as in the action: the API rejects boolean coercion.
    showArchived: params.showArchived === undefined ? undefined : String(params.showArchived),
    isActive: params.isActive === undefined ? undefined : String(params.isActive),
    folderId: params.folderId,
  });

  const res = await readListResult<actions.WorkflowListItem[]>(
    `/workflows${qs}`,
    "Failed to load automations",
  );

  return {
    ...res,
    pagination: res.pagination as PaginationData | undefined,
  };
}

export async function getWorkflow(id: string) {
  return readResult<actions.WorkflowDetail>(`/workflows/${id}`, "Failed to load automation");
}

export async function getWorkflowVersions(id: string) {
  return readResult<actions.WorkflowVersionSummary[]>(
    `/workflows/${id}/versions`,
    "Failed to load version history",
  );
}

export async function validateWorkflow(id: string) {
  return readResult<actions.WorkflowValidation>(
    `/workflows/${id}/validate`,
    "Failed to check this automation",
  );
}

export async function getBuilderContext(id: string) {
  return readResult<actions.BuilderContext>(
    `/workflows/${id}/builder-context`,
    "Failed to load your pipelines and team",
  );
}

export async function searchWorkflowRecords(
  workflowId: string,
  params: Parameters<typeof actions.searchWorkflowRecords>[1],
) {
  const search = new URLSearchParams({ kind: params.kind });
  if (params.q) search.set("q", params.q);
  for (const id of params.ids ?? []) search.append("ids", id);

  return readResult<actions.RecordOption[]>(
    `/workflows/${workflowId}/records?${search.toString()}`,
    "Failed to search your records",
  );
}

export async function getWorkflowQuota() {
  return readResult<actions.QuotaUsage>("/workflows/quota", "Failed to load automation limits");
}

export async function getWorkflowRuns(
  id: string,
  params: Parameters<typeof actions.getWorkflowRuns>[1] = {},
) {
  return readResult<actions.WorkflowRunsPage>(
    `/workflows/${id}/runs${buildQuery(params)}`,
    "Failed to load run history",
  );
}

export async function getWorkflowRun(id: string, runId: string) {
  return readResult<{ run: actions.WorkflowRunDetail }>(
    `/workflows/${id}/runs/${runId}`,
    "Failed to load this run",
  );
}
