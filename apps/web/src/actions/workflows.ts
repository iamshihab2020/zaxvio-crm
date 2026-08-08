"use server";

import type { WorkflowGraph } from "@hvac-saas/types";
import type { GraphValidation } from "@hvac-saas/workflow-nodes";
import {
  apiGet,
  apiList,
  apiSend,
  apiVoid,
  buildQuery,
  type ApiResult,
} from "@/lib/api-fetch";
import type { PaginationData } from "@/lib/pagination";

/**
 * Automations — the server-action layer.
 *
 * Written on `api-fetch` from the first line ([[decisions|ADR-002]] /
 * [[architecture|ARC-02]]). The 19 unmigrated action files are what ARC-02 is
 * still paying down; adding a twentieth hand-rolled `fetch` block would be
 * adding to the debt while the fix is sitting in the same directory.
 *
 * Every type argument is load-bearing. A bare `apiSend` resolves `T` to
 * `unknown`, which narrows to `{}` after a truthy check — that is exactly how
 * `actions/tags.ts` shipped a file where `res.data.id` would not compile.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Reading
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A workflow **as it arrives in the browser** — the wire shape, not the row.
 *
 * `Workflow` is Drizzle-inferred and types every timestamp as a `Date`. Nothing
 * that crosses a server action is a `Date`: the boundary is JSON, so they are
 * strings by the time any component sees them. Typing these actions with the
 * row type would type-check the whole page against a shape it never receives —
 * and then every date helper, all of which take strings, needs a cast to
 * compile. One honest declaration here removes every one of those casts.
 */
export interface WorkflowListItem {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  /** NULL until the first publish — which is what makes an automation a draft. */
  activeVersionId: string | null;
  folderId: string | null;
  timezoneMode: string;
  timezone: string | null;
  templateKey: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;

  // ── From the active version, null while the automation is a draft ─────────
  /** Displayed as "v3". */
  version: number | null;
  nodeCount: number | null;
  /** Event ids the published graph listens for — resolved to names for display. */
  triggerTypes: string[] | null;
}

/**
 * A `type`, not an `interface`, and that is load-bearing.
 *
 * These params are passed to `queryKeys.workflows.list()`, which takes a
 * `Record<string, unknown>`. An **interface** gets no implicit index signature
 * in TypeScript, so it is not assignable to that record and every call site
 * needs a cast; a type alias is. The repo has already paid for this once —
 * `ScheduleEventProps` carried a hand-written `[key: string]: unknown` to work
 * around it, which made the library's own props unassignable to it.
 */
export type WorkflowListParams = {
  page?: number;
  limit?: number;
  search?: string;
  /** Sent as the string `"true"`/`"false"` — the API rejects `z.coerce.boolean()`
   *  semantics on purpose, because `Boolean("false")` is `true`. */
  showArchived?: boolean;
  isActive?: boolean;
  folderId?: string;
};

export async function getWorkflows(params: WorkflowListParams = {}) {
  const qs = buildQuery({
    page: params.page,
    limit: params.limit,
    search: params.search,
    // Explicit strings rather than letting a boolean stringify implicitly, so
    // the value the API parses is the value written here.
    showArchived: params.showArchived === undefined ? undefined : String(params.showArchived),
    isActive: params.isActive === undefined ? undefined : String(params.isActive),
    folderId: params.folderId,
  });

  const res = await apiList<WorkflowListItem[]>(`/workflows${qs}`, {
    fallback: "Failed to load automations",
  });

  return {
    ...res,
    pagination: res.pagination as PaginationData | undefined,
  };
}

/** The record, its draft graph, and the toolbar state the builder renders. */
export interface WorkflowDetail {
  workflow: WorkflowListItem;
  /** The one shape that IS safe to reuse — a graph holds no timestamps. */
  graph: WorkflowGraph;
  activeVersion: {
    id: string;
    version: number;
    publishedAt: string;
    note: string | null;
  } | null;
  /** Draft differs from what is published — drives "N unpublished changes". */
  isDirty: boolean;
}

export async function getWorkflow(id: string): Promise<ApiResult<WorkflowDetail>> {
  return apiGet<WorkflowDetail>(`/workflows/${id}`, {
    fallback: "Failed to load automation",
  });
}

export interface WorkflowVersionSummary {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: string | null;
  note: string | null;
  nodeCount: number;
  triggerTypes: string[];
  /** The version `active_version_id` points at — not necessarily the highest. */
  isActive: boolean;
}

export async function getWorkflowVersions(id: string) {
  return apiGet<WorkflowVersionSummary[]>(`/workflows/${id}/versions`, {
    fallback: "Failed to load version history",
  });
}

export type WorkflowValidation = GraphValidation & { canPublish: boolean };

export async function validateWorkflow(id: string) {
  return apiGet<WorkflowValidation>(`/workflows/${id}/validate`, {
    fallback: "Failed to check this automation",
  });
}

/**
 * Everything the config panel's pickers need, fetched once per automation.
 *
 * One request rather than one per picker: opening a node would otherwise fire a
 * server action for members, another for pipelines and another for stages —
 * sequentially, because each would be its own hook.
 */
export interface BuilderContext {
  members: { id: string; name: string; email: string; image: string | null }[];
  pipelines: { id: string; name: string }[];
  stages: { id: string; label: string; pipelineId: string; lifecycle: string }[];
}

export async function getBuilderContext(id: string) {
  return apiGet<BuilderContext>(`/workflows/${id}/builder-context`, {
    fallback: "Failed to load your pipelines and team",
  });
}

/** One `{{token}}` that did not resolve, with the field it was in. */
export interface PreviewDiagnostic {
  path: string;
  field: string;
  message: string;
  suggestions: string[];
}

export interface NodePreview {
  /** Every setting with its variables resolved. */
  parameters: Record<string, unknown>;
  diagnostics: PreviewDiagnostic[];
}

/**
 * "Test this step" — resolve one step's settings against a real record.
 *
 * **Resolves, does not run.** Half the catalogue is `at-most-once`; running
 * `email.send` to test it puts a real message in a customer's inbox. What
 * actually goes wrong with a step is its configuration, and that is entirely
 * visible without side effects.
 */
export async function previewWorkflowNode(
  id: string,
  nodeId: string,
  subject?: { type: string; id: string },
) {
  return apiSend<NodePreview>(
    `/workflows/${id}/nodes/${nodeId}/preview`,
    "POST",
    { subject },
    { fallback: "Couldn't work out what this step would do" },
  );
}

export interface QuotaUsage {
  concurrent: number;
  concurrentLimit: number;
  daily: number;
  dailyLimit: number;
}

export async function getWorkflowQuota() {
  return apiGet<QuotaUsage>("/workflows/quota", {
    fallback: "Failed to load automation limits",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Writing
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateWorkflowInput {
  name: string;
  description?: string | null;
  folderId?: string | null;
  timezoneMode?: "tenant" | "custom";
  timezone?: string | null;
  templateKey?: string | null;
}

export async function createWorkflow(data: CreateWorkflowInput) {
  return apiSend<WorkflowListItem>("/workflows", "POST", data, {
    fallback: "Failed to create automation",
  });
}

export type UpdateWorkflowInput = Partial<Omit<CreateWorkflowInput, "templateKey">>;

export async function updateWorkflow(id: string, data: UpdateWorkflowInput) {
  return apiSend<WorkflowListItem>(`/workflows/${id}`, "PATCH", data, {
    fallback: "Failed to update automation",
  });
}

/**
 * The on/off switch.
 *
 * Its own action because it is its own endpoint, and it fails in a way no other
 * field does: switching on an automation with nothing published returns a 400
 * whose message is the instruction ("Publish this automation before switching
 * it on"). That message must reach the toast — which is why the caller reads
 * `res.error` rather than assuming success.
 */
export async function setWorkflowActive(id: string, isActive: boolean) {
  return apiSend<WorkflowListItem>(`/workflows/${id}/active`, "POST", { isActive }, {
    fallback: isActive
      ? "Failed to switch this automation on"
      : "Failed to switch this automation off",
  });
}

/** Archives — the API does not hard-delete, because run history hangs off it. */
export async function archiveWorkflow(id: string) {
  return apiVoid(`/workflows/${id}`, "DELETE", undefined, {
    fallback: "Failed to archive automation",
  });
}

export interface SaveGraphInput {
  nodes: WorkflowGraph["nodes"];
  edges: WorkflowGraph["edges"];
  /** ISO string of the `updatedAt` the client last saw. */
  expectedUpdatedAt: string;
}

export interface SaveGraphResponse {
  updatedAt: string;
  graph: WorkflowGraph;
}

/**
 * Whole-graph save.
 *
 * A **409** here is not a generic failure — it means someone else saved while
 * this tab was editing, and nothing was written. `api-fetch` carries `status`
 * out of the transport precisely so this caller can tell that apart from a 500
 * (the INV-11 / QUO-07 collapse), and offer Reload instead of Retry.
 */
export async function saveWorkflowGraph(id: string, data: SaveGraphInput) {
  return apiSend<SaveGraphResponse>(`/workflows/${id}/graph`, "PUT", data, {
    fallback: "Failed to save",
  });
}

export interface PublishedVersion {
  id: string;
  version: number;
  publishedAt: string;
  triggerTypes: string[];
  nodeCount: number;
  note: string | null;
}

export type PublishOutcome =
  | { status: "published"; version: PublishedVersion; error: null }
  | { status: "invalid"; validation: WorkflowValidation; error: string }
  | { status: "failed"; error: string };

/**
 * Publish.
 *
 * Returns a **three-state** result rather than `{data, error}`, because a
 * refused publish is not a failure — it is the product working, and the user
 * needs the problem list rather than a toast.
 *
 * The awkward part is deliberate. `api-fetch` deliberately nulls `data` on any
 * non-2xx, which is right for the other 200-odd call sites and wrong for this
 * one endpoint, whose 422 body *is* the payload. Rather than widen the shared
 * seam for a single caller — the seam exists because 216 bespoke fetch blocks
 * generated the bug class the audits kept finding — the validation is re-read
 * from `GET /:id/validate`, which returns exactly the same thing by
 * construction: both call the same validator.
 *
 * The cost is one extra request on the *refused* path only. A successful
 * publish makes one call, which is the path that matters.
 */
export async function publishWorkflow(
  id: string,
  note?: string | null,
): Promise<PublishOutcome> {
  const res = await apiSend<PublishedVersion>(
    `/workflows/${id}/publish`,
    "POST",
    { note: note ?? null },
    { fallback: "Failed to publish" },
  );

  if (res.data) return { status: "published", version: res.data, error: null };

  if (res.status === 422) {
    const check = await validateWorkflow(id);

    // **Only trust the re-read if it actually found something.**
    //
    // The server refused, so there IS a problem; a list with nothing in it
    // means the two endpoints disagree, and showing "There are 0 things to fix"
    // is worse than useless — it tells the user their automation is fine while
    // refusing to publish it. Falling back to the server's own message keeps
    // the refusal readable even if the rules ever drift apart again.
    if (check.data && check.data.errors.length > 0) {
      return {
        status: "invalid",
        validation: check.data,
        error: res.error ?? "This automation cannot be published yet.",
      };
    }

    return {
      status: "failed",
      error: res.error ?? "This automation cannot be published yet.",
    };
  }

  return { status: "failed", error: res.error ?? "Failed to publish" };
}

export interface RunWorkflowInput {
  subject?: { type: string; id: string };
  versionId?: string;
}

export interface RunResult {
  executionId: string;
  status: string;
  reason: string | null;
  nodesExecuted: number;
  diagnostics: unknown[];
}

export async function runWorkflow(id: string, data: RunWorkflowInput = {}) {
  return apiSend<RunResult>(`/workflows/${id}/runs`, "POST", data, {
    fallback: "Failed to run this automation",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Runs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A run **as it arrives in the browser**.
 *
 * Timestamps are strings for the reason recorded at the top of this file: the
 * boundary is JSON. Declaring that once here is what keeps `formatDateOnly` and
 * every other date helper — all of which take strings — cast-free at the call
 * site.
 */
export interface WorkflowRunSummary {
  id: string;
  status: "running" | "waiting" | "completed" | "failed" | "cancelled";
  source: "event" | "manual" | "test" | "webhook" | "schedule" | "sub" | "replay";
  triggerEvent: string | null;
  startedAt: string;
  completedAt: string | null;
  resumeAt: string | null;
  errorHint: string | null;
  nodesExecuted: number;
  contextTruncated: boolean;
  subjectType: string | null;
  subjectId: string | null;
  customerId: string | null;
  customerName: string | null;
  versionNumber: number | null;
}

export interface WorkflowRunStep {
  id: string;
  nodeId: string;
  nodeType: string;
  nodeLabel: string | null;
  sequence: number;
  status: "running" | "completed" | "failed" | "waiting" | "skipped";
  skipReason: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  resolvedParams: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  errorHint: string | null;
  errorMessage: string | null;
}

export interface WorkflowRunDetail extends WorkflowRunSummary {
  workflowId: string;
  workflowName: string;
  versionId: string;
  triggerNodeId: string | null;
  currentNodeId: string | null;
  parentExecutionId: string | null;
  errorMessage: string | null;
  steps: WorkflowRunStep[];
}

export interface WorkflowRunStats {
  total: number;
  running: number;
  waiting: number;
  completed: number;
  failed: number;
  cancelled: number;
  lastRunAt: string | null;
}

export interface WorkflowRunsPage {
  runs: WorkflowRunSummary[];
  pagination: PaginationData;
  stats: WorkflowRunStats;
}

export async function getWorkflowRuns(
  id: string,
  params: { page?: number; limit?: number; status?: string; customerId?: string } = {},
): Promise<ApiResult<WorkflowRunsPage>> {
  return apiGet<WorkflowRunsPage>(
    `/workflows/${id}/runs${buildQuery(params)}`,
    { fallback: "Failed to load run history" },
  );
}

export async function getWorkflowRun(id: string, runId: string) {
  return apiGet<{ run: WorkflowRunDetail }>(`/workflows/${id}/runs/${runId}`, {
    fallback: "Failed to load this run",
  });
}

/**
 * Install a shipped template as a new draft automation.
 *
 * Sends the template **id**, never its graph — the browser imports the same
 * catalogue and could send the nodes, which is exactly why it must not. A graph
 * accepted from the client is a graph the client can change, and "install this
 * template" would quietly become "write me any automation you like".
 */
export async function createWorkflowFromTemplate(input: {
  templateId: string;
  name?: string;
}) {
  return apiSend<{ id: string }>("/workflows/from-template", "POST", input, {
    fallback: "Failed to create this automation",
  });
}
