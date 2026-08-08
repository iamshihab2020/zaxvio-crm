import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  archiveWorkflow,
  createWorkflow,
  getBuilderContext,
  getWorkflow,
  getWorkflowQuota,
  getWorkflowRun,
  getWorkflowRuns,
  getWorkflows,
  getWorkflowVersions,
  publishWorkflow,
  runWorkflow,
  saveWorkflowGraph,
  setWorkflowActive,
  updateWorkflow,
  validateWorkflow,
  type CreateWorkflowInput,
  type SaveGraphInput,
  type UpdateWorkflowInput,
  type WorkflowListParams,
} from "@/actions/workflows";

/**
 * Automations — the client data layer.
 *
 * Every mutation is here rather than in a page ([[strict-rules]] §11). The
 * concrete reason, measured: `useInvoice` and six quote hooks had **zero
 * callers** because their pages each rolled their own `useMutation`, so hover
 * prefetch filled a cache nothing read and sheet mutations invalidated nothing.
 *
 * Note every `mutationFn` is an **arrow function wrapping** the server action,
 * never the action itself. Passing it directly breaks React's server-action
 * serialization — TanStack Query mutates the object's prototype and the call
 * fails with "Only plain objects can be passed to Server Actions".
 */

// ── Queries ──────────────────────────────────────────────────

export interface WorkflowRunsParams {
  page?: number;
  limit?: number;
  status?: string;
  customerId?: string;
}

/**
 * Run history for one automation.
 *
 * `refetchInterval` is conditional on there being something to watch. A run
 * that is `running` or `waiting` changes without anyone touching the page —
 * that is the whole nature of a durable pause — so the list has to move on its
 * own or it lies about a run that finished thirty seconds ago. Once nothing is
 * in flight the polling stops, because a page of finished runs will not change
 * until somebody starts another one, and a permanent 10-second poll on an idle
 * tab is a cost with no reader.
 */
export function useWorkflowRuns(id: string, params: WorkflowRunsParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflows.runs(id, params),
    queryFn: () => getWorkflowRuns(id, params),
    enabled: !!id && enabled,
    placeholderData: (prev) => prev,
    // Short: the point of opening this page is to see what just happened.
    staleTime: 5_000,
    refetchInterval: (query) => {
      const stats = query.state.data?.data?.stats;
      if (!stats) return false;
      return stats.running + stats.waiting > 0 ? 10_000 : false;
    },
  });
}

/**
 * One run and its steps.
 *
 * Same conditional poll, decided by this run's own status rather than the
 * list's — an open run mid-wait is exactly the thing somebody sits and watches.
 */
export function useWorkflowRun(id: string, runId: string | null) {
  return useQuery({
    queryKey: queryKeys.workflows.run(id, runId ?? ""),
    queryFn: () => getWorkflowRun(id, runId!),
    enabled: !!id && !!runId,
    staleTime: 5_000,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.run.status;
      return status === "running" || status === "waiting" ? 10_000 : false;
    },
  });
}

export function useWorkflows(params: WorkflowListParams, seed?: object) {
  return useQuery({
    ...seed,
    queryKey: queryKeys.workflows.list(params),
    queryFn: () => getWorkflows(params),
    placeholderData: (prev) => prev,
    // An automation list changes when someone edits one, which is rare and
    // always by an action taken in this app — so invalidation carries it, and a
    // short staleTime would only add refetches nobody asked for.
    staleTime: 60_000,
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: queryKeys.workflows.detail(id),
    queryFn: () => getWorkflow(id),
    enabled: !!id,
    // The builder holds the graph in its own store once loaded, and a refetch
    // underneath an open editor would fight the user's edits. Refetching is
    // driven by explicit invalidation after save/publish.
    staleTime: Infinity,
  });
}

export function useWorkflowValidation(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflows.validation(id),
    queryFn: () => validateWorkflow(id),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

export function useWorkflowVersions(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.workflows.versions(id),
    queryFn: () => getWorkflowVersions(id),
    enabled: !!id && enabled,
    staleTime: 60_000,
  });
}

/**
 * Reference data for the config panel's pickers.
 *
 * `staleTime: Infinity` — pipelines and team members do not change while
 * somebody is drawing an automation, and a refetch mid-edit would swap the
 * options out from under an open dropdown.
 */
export function useBuilderContext(id: string) {
  return useQuery({
    queryKey: queryKeys.workflows.builderContext(id),
    queryFn: () => getBuilderContext(id),
    enabled: !!id,
    staleTime: Infinity,
  });
}

export function useWorkflowQuota() {
  return useQuery({
    queryKey: queryKeys.workflows.quota(),
    queryFn: () => getWorkflowQuota(),
    staleTime: 60_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Create.
 *
 * **No success toast.** Creating an automation navigates straight into the
 * builder, and the builder appearing is the confirmation — a toast on top of a
 * full page transition is noise announcing something the user is already
 * looking at. Failures still speak up.
 */
export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWorkflowInput) => createWorkflow(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: () => toast.error("Failed to create automation"),
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) =>
      updateWorkflow(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Automation updated");
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
      qc.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
    },
    onError: () => toast.error("Failed to update automation"),
  });
}

/**
 * The on/off switch.
 *
 * The failure path matters more than the success path here: switching on an
 * automation that has never been published is refused with a message that *is*
 * the instruction. Surfacing `res.error` rather than a generic fallback is the
 * difference between "Failed to switch on" and "Publish this automation before
 * switching it on".
 */
export function useSetWorkflowActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      setWorkflowActive(id, isActive),
    onSuccess: (res, { id, isActive }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(isActive ? "Automation is on" : "Automation is off");
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
      qc.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
    },
    onError: () => toast.error("Failed to change this automation"),
  });
}

export function useArchiveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveWorkflow(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // "Archived", not "Deleted" — the API archives, and a toast that says
      // deleted about a row that still exists is a toast that teaches the user
      // something untrue about their data.
      toast.success("Automation archived");
      qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
    onError: () => toast.error("Failed to archive automation"),
  });
}

/**
 * Whole-graph save.
 *
 * **No toast on success.** Saving happens constantly in a builder, and a toast
 * per save is noise that trains the user to ignore toasts — including the 409.
 * The toolbar's saved state is the feedback; this hook only speaks up when
 * something went wrong.
 *
 * A 409 is called out separately because it is not a retryable failure: nothing
 * was written, and the answer is Reload rather than Save again.
 */
export function useSaveWorkflowGraph() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SaveGraphInput }) =>
      saveWorkflowGraph(id, data),
    onSuccess: (res, { id }) => {
      if (res.status === 409) {
        toast.error("Someone else edited this automation", {
          description: "Reload to see their changes. Nothing you did was saved.",
          duration: 10_000,
        });
        return;
      }
      if (res.error) {
        toast.error(res.error);
        return;
      }
      // Only the version list and the dirty flag can have changed; the builder
      // already holds the graph it just sent.
      qc.invalidateQueries({ queryKey: queryKeys.workflows.validation(id) });
    },
    onError: () => toast.error("Failed to save"),
  });
}

/**
 * Publish.
 *
 * Returns the three-state outcome untouched so the caller can open the
 * validation dialog on `invalid`. Deliberately **not** toasted as an error in
 * that case: a refused publish is the product working, and a toast that
 * disappears is the wrong home for a list of problems the user must act on.
 */
export function usePublishWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string | null }) =>
      publishWorkflow(id, note),
    onSuccess: (res, { id }) => {
      if (res.status === "published") {
        toast.success(`Published v${res.version.version}`);
        qc.invalidateQueries({ queryKey: queryKeys.workflows.all });
        qc.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
        return;
      }
      if (res.status === "failed") toast.error(res.error);
      // `invalid` is handled by the caller, which has somewhere to put a list.
    },
    onError: () => toast.error("Failed to publish"),
  });
}

/**
 * Preview one step's resolved settings.
 *
 * A mutation rather than a query: it is an action the user takes against a
 * record they choose, not state the panel should hold and refetch. It is also
 * deliberately **not cached** — the whole point is to see the effect of the
 * edit you just made.
 */
export function usePreviewNode() {
  return useMutation({
    mutationFn: ({
      id,
      nodeId,
      subject,
    }: {
      id: string;
      nodeId: string;
      subject?: { type: string; id: string };
    }) => previewWorkflowNode(id, nodeId, subject),
    onSuccess: (res) => {
      if (res.error) toast.error(res.error);
    },
    onError: () => toast.error("Couldn't work out what this step would do"),
  });
}

export function useRunWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, subject }: { id: string; subject?: { type: string; id: string } }) =>
      runWorkflow(id, subject ? { subject } : {}),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const status = res.data?.status;
      // `waiting` is not success and not failure — a step paused the run and it
      // will resume on its own. Saying "Finished" would be a lie the user acts on.
      if (status === "waiting") {
        toast.info("This automation is waiting", {
          description: "A step paused the run. It will carry on by itself.",
        });
      } else if (status === "failed") {
        toast.error(res.data?.reason ?? "The run failed");
      } else {
        toast.success(`Ran ${res.data?.nodesExecuted ?? 0} steps`);
      }
      qc.invalidateQueries({ queryKey: queryKeys.workflows.quota() });
      // The run that was just started is the one thing the history is now wrong
      // about. `detail(id)` is the prefix the run keys nest under, so this
      // clears the list, its stats and any open run in one call.
      qc.invalidateQueries({ queryKey: queryKeys.workflows.detail(id) });
    },
    onError: () => toast.error("Failed to run this automation"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchWorkflows(qc: QueryClient, params: WorkflowListParams) {
  return qc.prefetchQuery({
    queryKey: queryKeys.workflows.list(params),
    queryFn: () => getWorkflows(params),
  });
}
