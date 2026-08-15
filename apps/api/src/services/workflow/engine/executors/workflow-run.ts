/**
 * `workflow.run` — start another automation from inside this one.
 *
 * ## The recursion this creates, and why the guard is already right
 *
 * This is the node the depth guard in `execute()` was written for — the comment
 * on `ExecuteParams.depth` says *"Sub-automation recursion guard. P7; the
 * parameter lands now."* This is P7.
 *
 * The depth is **not** read from `params.depth` here. That parameter is only
 * passed by a direct call, and reading it was exactly why the guard sat
 * unreachable from P3 until the causation work: an event-triggered run starts
 * fresh at zero, so a loop mediated by events walked straight past it. The
 * ambient `currentCausationDepth()` is the one that survives both paths, because
 * a producer that forgets to thread a parameter defaults to 0 and silently
 * reopens the loop, while a producer that forgets to be inside an
 * `AsyncLocalStorage` scope is not a thing that can happen.
 *
 * ## Fire and forget, deliberately
 *
 * `execute()` is called and **not awaited to completion for its result** — it is
 * awaited, but its outcome does not gate this step. Two reasons, and the second
 * is the real one:
 *
 * 1. A child with a three-day Wait would hold the parent open for three days.
 * 2. The two runs do not share a fate in the data model. Each has its own
 *    execution row, its own node logs, its own retry and its own quota charge.
 *    A parent that failed because its child failed would report a failure whose
 *    cause is a different run the reader has to go and find — and would fail
 *    *again* on the parent's retry, re-running a child that had already sent its
 *    emails.
 *
 * So the child's id goes on the output and the parent moves on. The run history
 * is where you follow it, which is what the run history is for.
 */

import { EXECUTION_LIMITS } from "@hvac-saas/workflow-nodes";
import { assertWorkflow } from "../ownership.js";
import { currentCausationDepth } from "../../events/causation.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";
import { execute } from "../execute.js";

const workflowRun: Executor = async ({ db, ctx, params, node }) => {
  const workflowId = typeof params.workflowId === "string" ? params.workflowId : "";

  if (!workflowId) {
    throw new NodeFailure(
      `workflow.run has no automation chosen on ${node.id}`,
      `"${node.label}" does not say which automation to run. Open the step and pick one.`,
    );
  }

  // Refuses the most obvious loop before it costs an execution row. The picker
  // excludes the current automation, but a config can arrive from a template, a
  // duplicate, or a version restored from before a rename.
  if (workflowId === ctx.workflowId) {
    throw new NodeFailure(
      `workflow.run points at itself on ${node.id}`,
      `"${node.label}" is set to run this same automation, which would loop forever. Pick a different one.`,
    );
  }

  // Ownership at execution time, not only at save: a saved id is
  // client-supplied data, automations get duplicated between workspaces, and
  // there is no row-level security underneath.
  if (!(await assertWorkflow(db, ctx.tenantId, workflowId))) {
    throw new NodeFailure(
      `workflow.run target not in tenant on ${node.id}`,
      `"${node.label}" points at an automation that no longer exists. Open the step and pick another.`,
    );
  }

  const depth = currentCausationDepth();
  if (depth >= EXECUTION_LIMITS.MAX_NESTING_DEPTH) {
    // A `skipped`, not a `NodeFailure`. Hitting the ceiling is what the ceiling
    // is for, and the automation that finally trips it is rarely the one at
    // fault — emailing its owner a failure notification points at the wrong
    // step. The run log says what happened and where.
    return {
      skipped: `Automations can only call each other ${EXECUTION_LIMITS.MAX_NESTING_DEPTH} deep, and this is already ${depth} deep. Nothing was started.`,
    };
  }

  const result = await execute({
    tenantId: ctx.tenantId,
    workflowId,
    // The **same record**. A sub-automation is an extracted section of this
    // one, not a separate errand — running it against something else would make
    // "run the reminder sequence" mean something different every time.
    subject: ctx.subject,
    // "sub", which is the source the run history renders as a sub-run rather
    // than as something a person or an event started.
    source: "sub",
    actorUserId: null,
    depth: depth + 1,
  });

  return {
    output: {
      workflowId,
      executionId: result.executionId,
      status: result.status,
      // Carried so the run log can say "started, then refused for quota"
      // rather than just "started" — a child refused before writing anything
      // has no row of its own to read.
      reason: result.reason,
    },
  };
};

export default workflowRun;
