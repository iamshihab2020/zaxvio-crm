/**
 * Picking a paused run back up.
 *
 * The mirror of `execute()`, and deliberately in its own file: `execute` starts
 * a run from a trigger and resume continues one from the middle, and the two
 * differ in every step except the traversal itself. Folding resume into
 * `execute` as a branch would mean a function where half the setup is skipped
 * on a flag.
 *
 * Three things it must get right, all of which are the reason a pause is a
 * database row rather than a timer:
 *
 *  1. **The version is pinned.** A run resumes on the snapshot it started on,
 *     never the current draft or the latest publish. Somebody publishing v2
 *     while a run sleeps inside v1 must not drop it into a graph whose next
 *     node may no longer exist.
 *  2. **Claiming is a compare-and-set.** Two workers, or one worker overlapping
 *     itself after a slow tick, must not both resume the same run — the second
 *     would re-send whatever the first is sending.
 *  3. **It restarts at the paused node's SUCCESSORS**, not the paused node, so
 *     a wait does not wait again. `reExecuteCurrentNode` exists for the gates
 *     that genuinely need to re-evaluate, and is opt-in.
 */

import {
  workflowExecutions,
  workflows,
  workflowVersions,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import { EXECUTION_LIMITS } from "@hvac-saas/workflow-nodes";
import type { WorkflowGraph } from "@hvac-saas/types";
import { restoreContext } from "./context.js";
import { traverse } from "./traverser.js";
import { runWithCausation } from "../events/causation.js";
import { SubjectGone, withTimeout } from "./errors.js";
import { handleTerminal, resolveTimezone as _tz } from "./execute.js";
import type { ExecutorDb } from "./executors/index.js";

type Db = ReturnType<typeof getDb>;

export type ResumeResult =
  | { status: "resumed"; nodesExecuted: number }
  | { status: "skipped"; reason: string };

/**
 * Resume one run.
 *
 * Returns rather than throws for the ordinary cases — a run somebody cancelled
 * while it slept, a version that vanished — because the caller is a worker
 * processing a batch and one dead row must not stop the others.
 */
export async function resumeExecution(
  db: Db,
  executionId: string,
): Promise<ResumeResult> {
  // 1 · Claim. `WHERE status = 'waiting'` is the whole guarantee: whoever
  //     flips the row to `running` owns it, and the loser's UPDATE matches
  //     nothing rather than racing on a read.
  const claimed = await db
    .update(workflowExecutions)
    .set({ status: "running" })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.status, "waiting"),
      ),
    )
    .returning({
      id: workflowExecutions.id,
      tenantId: workflowExecutions.tenantId,
      workflowId: workflowExecutions.workflowId,
      versionId: workflowExecutions.workflowVersionId,
      subjectType: workflowExecutions.subjectType,
      subjectId: workflowExecutions.subjectId,
      currentNodeId: workflowExecutions.currentNodeId,
      waitingContext: workflowExecutions.waitingContext,
      triggerEvent: workflowExecutions.triggerEvent,
      nodesExecuted: workflowExecutions.nodesExecuted,
      causationDepth: workflowExecutions.causationDepth,
    });

  const run = claimed[0];
  if (!run) {
    return { status: "skipped", reason: "Already claimed, cancelled or finished" };
  }

  // 2 · The pinned version — by id, never "the active one".
  const [version] = await db
    .select({ graph: workflowVersions.graph })
    .from(workflowVersions)
    .where(eq(workflowVersions.id, run.versionId));

  const [workflow] = await db
    .select({
      name: workflows.name,
      timezoneMode: workflows.timezoneMode,
      timezone: workflows.timezone,
      archivedAt: workflows.archivedAt,
    })
    .from(workflows)
    .where(eq(workflows.id, run.workflowId));

  if (!version || !workflow) {
    await settleResumed(
      db,
      run.id,
      "cancelled",
      "The automation or its version no longer exists.",
    );
    return { status: "skipped", reason: "Version or workflow gone" };
  }

  // An automation archived while a run slept inside it does not wake up. "I
  // archived it and it still emailed my customer three days later" is not a
  // defensible answer.
  if (workflow.archivedAt) {
    await settleResumed(
      db,
      run.id,
      "cancelled",
      "This automation was archived while the run was waiting, so it stopped.",
    );
    return { status: "skipped", reason: "Workflow archived while waiting" };
  }

  const graph = version.graph as WorkflowGraph;
  const timezone = await _tz(
    db as ExecutorDb,
    run.tenantId,
    workflow.timezoneMode,
    workflow.timezone,
  );

  // 3 · Rebuild the context. `restoreContext` re-reads the subject rather than
  //     trusting the snapshot: the job may have been completed, renamed or
  //     deleted during the wait, and an automation acting on three-day-old data
  //     is worse than one that stops.
  let ctx;
  try {
    ctx = await restoreContext(
      db as ExecutorDb,
      (run.waitingContext ?? {}) as Record<string, unknown>,
      {
        tenantId: run.tenantId,
        workflowId: run.workflowId,
        workflowName: workflow.name,
        versionId: run.versionId,
        executionId: run.id,
        timezone,
        subject:
          run.subjectType && run.subjectId
            ? { type: run.subjectType, id: run.subjectId }
            : null,
        trigger: { event: run.triggerEvent, payload: {} },
      },
    );
  } catch (err) {
    // No context yet, so the shared finaliser has nothing to work with. A
    // vanished subject cancels rather than fails: a job deleted during a
    // three-day wait is expected, and a failure notification for one teaches
    // people to ignore failure notifications.
    const gone = err instanceof SubjectGone;
    await settleResumed(
      db,
      run.id,
      gone ? "cancelled" : "failed",
      gone
        ? err.message
        : "This automation couldn't pick up where it left off. Its record may have changed while it was waiting.",
    );
    return {
      status: "skipped",
      reason: gone ? "Subject gone" : "Context could not be restored",
    };
  }

  // 4 · Restart at the paused node's successors. The wait itself has happened;
  //     running it again would wait again, which is how a three-day delay
  //     becomes a six-day one.
  const startNodeIds = successorsOf(graph, run.currentNodeId);
  if (startNodeIds.length === 0) {
    await settleResumed(db, run.id, "completed", null);
    return { status: "resumed", nodesExecuted: 0 };
  }

  try {
    const result = await withTimeout(
      runWithCausation(run.causationDepth + 1, () =>
        traverse({
          db: db as ExecutorDb,
          ctx,
          graph,
          startNodeIds,
          // Continues the log ordering rather than restarting at 1, so a replay
          // reads as one run instead of two overlapping ones.
          startSequence: run.nodesExecuted,
        }),
      ),
      EXECUTION_LIMITS.MAX_EXECUTION_MS,
    );

    await settleResumed(
      db,
      run.id,
      "completed",
      null,
      run.nodesExecuted + result.nodesExecuted,
    );
    return { status: "resumed", nodesExecuted: result.nodesExecuted };
  } catch (err) {
    // The **shared** finaliser, not a copy. A resumed run can reach another
    // `delay.wait`, and it has to pause exactly as a first-pass run does —
    // same serialisation, same compare-and-set, same cap. A second
    // implementation here would drift the moment either changed.
    //
    // It rethrows unknown errors on purpose (so a parent sub-automation can
    // catch them); a worker draining a batch must not die on one bad run, so
    // that is caught and reported as a skip.
    try {
      const outcome = await handleTerminal(db as ExecutorDb, run.id, ctx, err);
      return outcome.status === "waiting"
        ? { status: "resumed", nodesExecuted: 0 }
        : { status: "skipped", reason: outcome.reason ?? outcome.status };
    } catch {
      return { status: "skipped", reason: "Step failed" };
    }
  }
}

/** Everything downstream of the node the run paused on. */
function successorsOf(graph: WorkflowGraph, nodeId: string | null): string[] {
  if (!nodeId) return [];
  return graph.edges
    .filter((edge) => edge.sourceNodeId === nodeId)
    .map((edge) => edge.targetNodeId);
}

/** Compare-and-set on `running`, matching `execute`'s own settle. */
async function settleResumed(
  db: Db,
  executionId: string,
  status: "completed" | "cancelled" | "failed",
  errorHint: string | null,
  nodesExecuted?: number,
): Promise<void> {
  await db
    .update(workflowExecutions)
    .set({
      status,
      completedAt: new Date(),
      errorHint,
      ...(nodesExecuted !== undefined ? { nodesExecuted } : {}),
    })
    .where(
      and(
        eq(workflowExecutions.id, executionId),
        eq(workflowExecutions.status, "running"),
      ),
    );
}
