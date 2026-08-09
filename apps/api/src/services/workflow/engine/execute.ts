/**
 * The run lifecycle.
 *
 * Every transition **out of `running`** is a compare-and-set —
 * `UPDATE … WHERE id = ? AND status = 'running'`. That is invariant 1 of the
 * engine and it is not decorative: a delay pause and a concurrent goal exit can
 * both believe they own the row, and without the guard the later write silently
 * overwrites the earlier one, leaving a run that is both `waiting` and
 * `completed` depending on which column you read.
 *
 * Terminal handling is one branch per error class, and the classes are the
 * point:
 *
 * | Thrown | Result |
 * |---|---|
 * | *(nothing)* | `completed` |
 * | `DelayPause` | `waiting` + `resume_at` + `waiting_context` |
 * | `GoalWait` | `waiting`, `resume_at` NULL |
 * | `WorkflowStopped` | whatever the author chose |
 * | `SubjectGone` | **`cancelled`** — a deleted job is not a bug |
 * | `WorkflowTimeout` | `failed`, partial outputs preserved |
 * | anything else | `failed`, **re-thrown** so a parent sub-automation can catch |
 *
 * A failure notification fires for crashes, timeouts and error stops — **never
 * for `cancelled`**. A cancel is expected behaviour, and notifying on one
 * trains people to ignore the notification.
 */

import {
  tenants,
  workflowExecutions,
  workflowVersions,
  workflows,
  and,
  eq,
  isNull,
  getDb,
} from "@hvac-saas/database";
import {
  EXECUTION_LIMITS,
  DEFAULT_TIMEZONE,
  type ExecutionContext,
  type SubjectType,
} from "@hvac-saas/workflow-nodes";
import type { WorkflowGraph } from "@hvac-saas/types";
import { loadExecutionContext, serialiseContext } from "./context.js";
import { deactivateListeners, registerGoals } from "../goals/index.js";
import { traverse } from "./traverser.js";
import { assertWithinQuota } from "./quotas.js";
import {
  DelayPause,
  GoalWait,
  QuotaExceeded,
  SubjectGone,
  WorkflowLimitExceeded,
  WorkflowStopped,
  WorkflowTimeout,
  withTimeout,
} from "./errors.js";
import type { ExecutorDb } from "./executors/index.js";
import type { Diagnostic } from "./interpolate.js";

/**
 * Mirrors `workflow_execution_source` exactly, in the same order.
 *
 * Not a convenience alias: the value is written straight into an enum column,
 * so a member this type has and the enum does not is a `22P02` at run time and
 * a member the enum has and this does not is a source nothing can record.
 * (`sub` and `replay` are P7 and P8; they are here because the column has them.)
 */
export type ExecutionSource =
  | "event"
  | "manual"
  | "test"
  | "webhook"
  | "schedule"
  | "sub"
  | "replay";

export interface ExecuteParams {
  /** **Never from a payload** (D-16). The caller resolves it from the session. */
  tenantId: string;
  workflowId: string;
  /** Omitted → the workflow's active version. */
  versionId?: string;
  /**
   * `SubjectType`, not `string`. Typing it loosely was worth exactly one `as
   * never` at the insert and one at the context load — and [[strict-rules]] §4
   * exists because a cast compiles whether or not the value is really a member
   * of the enum. ARC-10 got this repo to zero `as never`; it stays there.
   */
  subject: { type: SubjectType; id: string } | null;
  event?: { type: string; payload: Record<string, unknown> };
  source: ExecutionSource;
  actorUserId?: string | null;
  idempotencyKey?: string;
  /** Sub-automation recursion guard. P7; the parameter lands now. */
  depth?: number;
}

export interface ExecutionResult {
  executionId: string | null;
  status: "completed" | "failed" | "cancelled" | "waiting" | "refused" | "duplicate";
  reason: string;
  nodesExecuted: number;
  diagnostics: Diagnostic[];
}

export async function execute(params: ExecuteParams): Promise<ExecutionResult> {
  const db: ExecutorDb = getDb();
  const { tenantId } = params;

  // 1 · Quotas, before anything is written. Refuses loudly.
  try {
    await assertWithinQuota(db, tenantId);
  } catch (err) {
    if (err instanceof QuotaExceeded) {
      // "Refuses loudly" was only true for a manual run, where the route hands
      // this message straight back to the person who pressed the button.
      //
      // An event-triggered run has nobody watching, and this refusal happens
      // **before any execution row is written** — so it left no trace anywhere
      // the tenant could look. Not in the run history, not in the bell, not in
      // a toast. Their automations would simply stop, silently, and the only
      // symptom would be customers not being chased.
      if (params.source !== "manual") {
        await notifyQuotaRefused(db, tenantId, err);
      }
      return refused(err.message);
    }
    throw err;
  }

  // 2 · Depth guard.
  if ((params.depth ?? 0) > EXECUTION_LIMITS.MAX_NESTING_DEPTH) {
    return refused(
      `Automations can only call each other ${EXECUTION_LIMITS.MAX_NESTING_DEPTH} levels deep. This one went further, which usually means two automations are triggering each other.`,
    );
  }

  // 3 · The version. A soft-deleted or archived automation refuses to run **even
  //     for a direct invocation** — event triggers already filter these out,
  //     direct ones do not, and "I archived it and it still ran" is not a
  //     defensible answer.
  const loaded = await loadVersion(db, tenantId, params.workflowId, params.versionId);
  if (!loaded) {
    return refused(
      "This automation has no published version, or it has been archived. Drawing an automation isn't the same as publishing it — open it and press Publish.",
    );
  }

  const graph = loaded.graph;
  const triggerNode = findTriggerNode(graph, params.event?.type ?? null);
  if (!triggerNode) {
    return refused(
      "This automation has no starting step, so there was nowhere to begin. Add a trigger.",
    );
  }

  // 4 · The execution row. A 23505 on either unique index is **not an error**.
  const activeDedupKey =
    params.subject && (params.source === "event" || params.source === "schedule")
      ? `${params.workflowId}:${params.subject.type}:${params.subject.id}`
      : null;

  let executionId: string;
  try {
    const [row] = await db
      .insert(workflowExecutions)
      .values({
        tenantId,
        workflowId: params.workflowId,
        workflowVersionId: loaded.versionId,
        subjectType: params.subject?.type ?? null,
        subjectId: params.subject?.id ?? null,
        status: "running",
        source: params.source,
        triggerNodeId: triggerNode.id,
        triggerEvent: params.event?.type ?? null,
        idempotencyKey: params.idempotencyKey ?? null,
        activeDedupKey,
      })
      .returning({ id: workflowExecutions.id });
    executionId = row.id;
  } catch (err) {
    // `idempotency_key` → this event was already handled. `active_dedup_key` →
    // this subject is already mid-run, and the correct response is to refresh
    // that run's context rather than start a second one (D-03). Both are the
    // structural guarantee replacing a query-then-insert race.
    if (isUniqueViolation(err)) {
      return {
        executionId: null,
        status: "duplicate",
        reason: "This automation is already running for this record.",
        nodesExecuted: 0,
        diagnostics: [],
      };
    }
    throw err;
  }

  // 5 · Context. `SubjectGone` here cancels rather than fails.
  let ctx: ExecutionContext;
  try {
    ctx = await loadExecutionContext(db, {
      tenantId,
      workflowId: params.workflowId,
      workflowName: loaded.workflowName,
      versionId: loaded.versionId,
      executionId,
      timezone: loaded.timezone,
      subject: params.subject,
      trigger: {
        event: params.event?.type ?? null,
        payload: params.event?.payload ?? {},
      },
    });
  } catch (err) {
    if (err instanceof SubjectGone) {
      await settle(db, executionId, "cancelled", err.message, err.message, undefined, ctx.tenantId);
      return {
        executionId,
        status: "cancelled",
        reason: err.message,
        nodesExecuted: 0,
        diagnostics: [],
      };
    }
    await settle(db, executionId, "failed", String(err), "This automation couldn't start.");
    throw err;
  }

  // 6 · The customer, recorded on the run itself. Powers "which automations
  //     have touched this customer" without a join per subject type.
  if (ctx.customer) {
    await db
      .update(workflowExecutions)
      .set({ customerId: ctx.customer.id })
      .where(eq(workflowExecutions.id, executionId));
  }

  // 7 · Goal listeners, BEFORE traversal.
  //
  //     The ordering is the feature. A goal has to be watching while the chase
  //     runs — "stop the moment they accept" is worthless if the watch only
  //     starts once the chain reaches the goal node, which is after the last
  //     email. Registering here means the run can be ended from the outside at
  //     any point, including while it sits in a three-day delay.
  await registerGoals(db, ctx, graph);

  // 8 · Traverse, under the wall clock.
  try {
    const result = await withTimeout(
      traverse({ db, ctx, graph, startNodeIds: [triggerNode.id] }),
      EXECUTION_LIMITS.MAX_EXECUTION_MS,
    );

    await settle(db, executionId, "completed", null, null, result.nodesExecuted, ctx.tenantId);
    return {
      executionId,
      status: "completed",
      reason: "Finished",
      nodesExecuted: result.nodesExecuted,
      diagnostics: result.diagnostics,
    };
  } catch (err) {
    return handleTerminal(db, executionId, ctx, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Terminal handling
// ─────────────────────────────────────────────────────────────────────────────

export async function handleTerminal(
  db: ExecutorDb,
  executionId: string,
  ctx: ExecutionContext,
  err: unknown,
): Promise<ExecutionResult> {
  if (err instanceof DelayPause) {
    const { context, truncated } = serialiseContext(ctx, EXECUTION_LIMITS.MAX_CONTEXT_BYTES);
    await pause(db, executionId, {
      resumeAt: err.resumeAt,
      currentNodeId: err.nodeId,
      context,
      truncated,
    });
    return {
      executionId,
      status: "waiting",
      reason: `Waiting until ${err.resumeAt.toISOString()}`,
      nodesExecuted: 0,
      diagnostics: [],
    };
  }

  if (err instanceof GoalWait) {
    const { context, truncated } = serialiseContext(ctx, EXECUTION_LIMITS.MAX_CONTEXT_BYTES);
    await pause(db, executionId, {
      // NULL. Only a matching event ends a goal wait — the resume worker must
      // never pick one up on a clock.
      resumeAt: null,
      currentNodeId: err.nodeId,
      context,
      truncated,
    });
    return {
      executionId,
      status: "waiting",
      reason: err.message,
      nodesExecuted: 0,
      diagnostics: [],
    };
  }

  if (err instanceof WorkflowStopped) {
    await settle(db, executionId, err.stopType, null, err.reason, undefined, ctx.tenantId);
    return {
      executionId,
      status: err.stopType,
      reason: err.reason,
      nodesExecuted: 0,
      diagnostics: [],
    };
  }

  if (err instanceof SubjectGone) {
    await settle(db, executionId, "cancelled", err.message, err.message, undefined, ctx.tenantId);
    return { executionId, status: "cancelled", reason: err.message, nodesExecuted: 0, diagnostics: [] };
  }

  if (err instanceof WorkflowTimeout || err instanceof WorkflowLimitExceeded) {
    await settle(db, executionId, "failed", err.message, err.message, undefined, ctx.tenantId);
    await notifyFailure(ctx, err.message);
    return { executionId, status: "failed", reason: err.message, nodesExecuted: 0, diagnostics: [] };
  }

  const message = err instanceof Error ? err.message : String(err);
  const hint =
    (err as { hint?: string }).hint ??
    "This automation stopped because a step failed. Open the run to see which one.";
  await settle(db, executionId, "failed", message, hint, undefined, ctx.tenantId);
  await notifyFailure(ctx, hint);

  // Re-thrown on purpose (invariant 5): a parent sub-automation has to be able
  // to catch it, and swallowing here would make a nested failure invisible.
  throw err;
}

/**
 * Compare-and-set. `WHERE status = 'running'` is the whole guarantee.
 */
async function settle(
  db: ExecutorDb,
  executionId: string,
  status: "completed" | "failed" | "cancelled",
  errorMessage: string | null,
  errorHint: string | null,
  nodesExecuted?: number,
  tenantId?: string,
): Promise<void> {
  await db
    .update(workflowExecutions)
    .set({
      status,
      completedAt: new Date(),
      errorMessage,
      errorHint,
      ...(nodesExecuted !== undefined ? { nodesExecuted } : {}),
    })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.status, "running"),
      ),
    );

  // Every terminal transition stands the run's goal watches down. A listener
  // that outlives its run is a watch that can never usefully fire, and it would
  // still be read on every dispatched event — the partial index is only small
  // because inactive rows drop out of it.
  //
  // Unconditional rather than guarded on "does this run have goals": one
  // indexed UPDATE that usually matches nothing is cheaper than remembering to
  // call it, and forgetting is what leaves the watch behind.
  if (tenantId) await deactivateListeners(db, tenantId, executionId);
}

async function pause(
  db: ExecutorDb,
  executionId: string,
  fields: {
    resumeAt: Date | null;
    currentNodeId: string;
    context: Record<string, unknown>;
    truncated: boolean;
  },
): Promise<void> {
  await db
    .update(workflowExecutions)
    .set({
      status: "waiting",
      resumeAt: fields.resumeAt,
      currentNodeId: fields.currentNodeId,
      waitingContext: fields.context,
      contextTruncated: fields.truncated,
    })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.status, "running"),
      ),
    );
}

/**
 * Tell the tenant their automations have stopped because of a limit.
 *
 * Tenant-level rather than named after one workflow, because the limit is
 * tenant-wide: every automation is affected, and naming whichever one happened
 * to be refused first would send somebody to debug a workflow that is fine.
 *
 * **Throttled to one per limit per UTC day.** A tenant over their daily cap
 * refuses every event for the rest of the day, and a notification per refusal
 * would turn one problem into a thousand — the same reasoning as the failure
 * notification's per-run key. UTC rather than the tenant's day on purpose: it
 * costs one query to resolve their zone, and for a throttle the boundary being
 * a few hours off is not worth it.
 *
 * `deliverNotification`, **awaited** — not the fire-and-forget
 * `dispatchNotification` the failure path uses. That one is right there because
 * a failing notification must not turn one failure into two, and it is already
 * on the error path. This is not: it is the *only* signal the tenant will get,
 * and dropping it on the floor because the worker moved on would put us back
 * where this started. Its own try/catch is internal, so it cannot throw here.
 */
async function notifyQuotaRefused(
  db: ExecutorDb,
  tenantId: string,
  err: QuotaExceeded,
): Promise<void> {
  const { deliverNotification } = await import("../../../lib/notifications.js");
  const today = new Date().toISOString().slice(0, 10);

  await deliverNotification(db, {
    tenantId,
    type: "workflow_alert",
    title: "Your automations have paused",
    description: `${err.message} They will start running again once you are back under the limit.`,
    actorId: null,
    dedupKey: `wf-quota:${err.quota}:${today}`,
  });
}

/**
 * Tell the team an automation broke, in language they can act on.
 *
 * Fire-and-forget deliberately: a failing notification must not turn one
 * failure into two, and this path is already the error path.
 */
async function notifyFailure(
  ctx: ExecutionContext,
  hint: string,
): Promise<void> {
  const { dispatchNotification } = await import("../../../lib/notifications.js");
  dispatchNotification({
    tenantId: ctx.tenantId,
    type: "workflow_alert",
    title: `"${ctx.workflowName}" stopped`,
    description: hint,
    entityType: ctx.subject?.type ?? undefined,
    entityId: ctx.subject?.id ?? undefined,
    actorId: null,
    // One per run. A retry storm must not become a notification storm.
    dedupKey: `wf-fail:${ctx.executionId}`,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading
// ─────────────────────────────────────────────────────────────────────────────

interface LoadedVersion {
  versionId: string;
  workflowName: string;
  timezone: string;
  graph: WorkflowGraph;
}

async function loadVersion(
  db: ExecutorDb,
  tenantId: string,
  workflowId: string,
  versionId: string | undefined,
): Promise<LoadedVersion | null> {
  const [workflow] = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      isActive: workflows.isActive,
      activeVersionId: workflows.activeVersionId,
      timezoneMode: workflows.timezoneMode,
      timezone: workflows.timezone,
    })
    .from(workflows)
    .where(
      and(
        eq(workflows.tenantId, tenantId),
        eq(workflows.id, workflowId),
        // Archived automations do not run. Checked here rather than only in the
        // trigger matcher, because a direct invocation skips the matcher.
        isNull(workflows.archivedAt),
      ),
    );

  if (!workflow) return null;

  const targetVersionId = versionId ?? workflow.activeVersionId;
  if (!targetVersionId) return null;

  const [version] = await db
    .select({ id: workflowVersions.id, graph: workflowVersions.graph })
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.tenantId, tenantId),
        eq(workflowVersions.id, targetVersionId),
      ),
    );

  if (!version) return null;

  return {
    versionId: version.id,
    workflowName: workflow.name,
    timezone: await resolveTimezone(db, tenantId, workflow.timezoneMode, workflow.timezone),
    graph: version.graph as WorkflowGraph,
  };
}

/**
 * `workflow.timezone` (when the mode is `custom`) → the tenant's → the default.
 *
 * **Never the server's.** This repo has paid for the alternative twice: the
 * E-05 completion email stamped the server's date (02:30 UTC is 1 August in
 * Chicago and 2 August in UTC), and the calendar rendered in browser time until
 * BOOK-30.
 */
export async function resolveTimezone(
  db: ExecutorDb,
  tenantId: string,
  mode: string,
  custom: string | null,
): Promise<string> {
  if (mode === "custom" && custom) return custom;
  const [row] = await db
    .select({ timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  return row?.timezone ?? DEFAULT_TIMEZONE;
}

/**
 * The node a run starts at.
 *
 * With an event, the trigger listening for it. Without one, the first trigger
 * in the graph — which is what a manual run means.
 */
function findTriggerNode(graph: WorkflowGraph, eventType: string | null) {
  const triggers = graph.nodes.filter((n) => n.nodeType.startsWith("trigger."));
  if (triggers.length === 0) return null;
  if (!eventType) return triggers[0];

  return (
    triggers.find((n) => {
      const events = n.nodeConfig.parameters?.triggerEvents;
      return Array.isArray(events) && events.includes(eventType);
    }) ?? triggers[0]
  );
}

function refused(reason: string): ExecutionResult {
  return {
    executionId: null,
    status: "refused",
    reason,
    nodesExecuted: 0,
    diagnostics: [],
  };
}

/** Postgres `23505`, whatever driver wrapper it arrives in. */
function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ("code" in err
      ? (err as { code?: string }).code === "23505"
      : String((err as Error).message ?? "").includes("23505"))
  );
}
