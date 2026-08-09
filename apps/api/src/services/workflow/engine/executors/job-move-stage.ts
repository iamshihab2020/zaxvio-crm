/**
 * `job.moveStage` — move the job to a pipeline stage.
 *
 * **Calls `moveJobStage()` and writes no table itself**, which is what the
 * contract in `types.ts` has said since P3: *"An executor containing an `UPDATE`
 * has, by definition, a second opinion about a business rule."* This one had
 * one. It resolved the stage correctly and checked the transition table, and
 * then it skipped the archived gate, the **required-checklist completion gate**,
 * the `job_activities` row, the `job.stage_changed` / `job.completed` events,
 * the in-app notification and the E-05 completion email.
 *
 * The event is the one that mattered most: with no event raised, an automation
 * that moved a job could not trigger another automation, which is why
 * `trigger.job.stage_changed` shipped and was unreachable from an automation.
 *
 * All this node still owns is the **translation** — turning a service result
 * into the vocabulary a run log speaks. That split is deliberate: the same
 * outcome is a 400 to the route and a `skipped` here, and a service that picked
 * one would force the other caller to catch and re-word it.
 */

import { moveJobStage, type MoveJobStageFailure } from "../../../jobs/jobs.service.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

/**
 * Which failures are somebody's mistake, and which are just what happened.
 *
 * A missing or deleted stage is a **configuration** problem: the automation
 * cannot work until someone opens it and picks another, so it fails loudly and
 * the tenant gets a notification. Everything else is ordinary — the job was
 * already there, it has been deleted, it was archived, the tech has not ticked
 * the required checklist items yet, the board does not allow that move. Those
 * are recorded with a reason and the run carries on, because a failure alert for
 * an expected outcome teaches people to ignore failure alerts.
 */
const CONFIG_FAILURES: ReadonlySet<MoveJobStageFailure> = new Set(["no_such_stage"]);

const jobMoveStage: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.job) {
    return {
      skipped:
        "This automation isn't running on a job, so there was no job to move.",
    };
  }

  const stageId = typeof params.stageId === "string" ? params.stageId : null;

  if (!stageId) {
    throw new NodeFailure(
      "moveStage node has no stage",
      `The "${node.label}" step has no stage chosen, so there was nowhere to move the job to.`,
    );
  }

  // No `pipelineId` from the saved config. The service resolves against the
  // job's *own* pipeline, read from the row — a stage id copied between
  // automations could otherwise move a job onto a board it was never on, and no
  // product path changes a job's pipeline by moving its stage.
  const result = await moveJobStage(db, {
    tenantId: ctx.tenantId,
    jobId: ctx.job.id,
    stageId,
    actor: {
      kind: "workflow",
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
  });

  if (!result.ok) {
    if (CONFIG_FAILURES.has(result.reason)) {
      throw new NodeFailure(
        `moveStage failed: ${result.reason} (stage ${stageId}, tenant ${ctx.tenantId})`,
        "The stage this step moves jobs to no longer exists. Open the automation and pick a different one.",
      );
    }
    return { skipped: result.message };
  }

  return {
    output: {
      jobId: ctx.job.id,
      stageId: result.to.id,
      stageLabel: result.to.label,
      lifecycle: result.to.lifecycle,
      movedFrom: result.from,
    },
  };
};

export default jobMoveStage;
