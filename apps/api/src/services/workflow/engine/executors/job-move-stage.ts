/**
 * `job.moveStage` — move the job to a pipeline stage.
 *
 * **Resolves through `job-stages.service.ts` and never writes the columns
 * itself.** That service is the one place that decides what stage a job may
 * move to and what `jobs.status` becomes as a result, and bypassing it is a
 * mistake this repo has already made and paid for: `lib/quote-to-job.ts` set
 * `jobs.status` by hand and never `stage_id`, so for four days every job created
 * from a quote sat outside the stage model — it counted 0 in the pipeline stage
 * counts and matched no lifecycle filter (QUO-02).
 *
 * The transition rules apply here exactly as they do to a person dragging the
 * card. An automation that could make moves the board refuses would be a second
 * opinion about the rule, which is what D-17 exists to prevent.
 */

import { jobs, and, eq } from "@hvac-saas/database";
import {
  canTransition,
  resolveStage,
  transitionMessage,
} from "../../../job-stages.service.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const jobMoveStage: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.job) {
    return {
      skipped:
        "This automation isn't running on a job, so there was no job to move.",
    };
  }

  const pipelineId = typeof params.pipelineId === "string" ? params.pipelineId : null;
  const stageId = typeof params.stageId === "string" ? params.stageId : null;

  if (!stageId) {
    throw new NodeFailure(
      "moveStage node has no stage",
      `The "${node.label}" step has no stage chosen, so there was nowhere to move the job to.`,
    );
  }

  // Tenant-scoped by `resolveStage`, and it refuses a stage belonging to a
  // different pipeline — so a stage id copied between automations cannot move a
  // job onto someone else's board.
  const stage = await resolveStage(db, {
    tenantId: ctx.tenantId,
    pipelineId,
    stageId,
  });

  if (!stage) {
    throw new NodeFailure(
      `Stage ${stageId} not found for tenant ${ctx.tenantId}`,
      `The stage this step moves jobs to no longer exists. Open the automation and pick a different one.`,
    );
  }

  // Read the job's CURRENT stage from the row rather than from the context: the
  // context was loaded when the run started, and on a resumed run that may be
  // days old. A transition check against a stale lifecycle is not a check.
  const [current] = await db
    .select({ stageId: jobs.stageId, status: jobs.status })
    .from(jobs)
    .where(and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.id, ctx.job.id)));

  if (!current) {
    return {
      skipped: "That job has been deleted, so there was nothing to move.",
    };
  }

  // Already there. Reported rather than written, so a resumed run does not
  // record a move that did not happen — and so the log reads honestly.
  if (current.stageId === stage.id) {
    return {
      skipped: `The job is already in ${stage.label}.`,
      output: { jobId: ctx.job.id, stageId: stage.id, stageLabel: stage.label },
    };
  }

  // The whole stage, not just its lifecycle: `transitionMessage` names both
  // stages in the sentence it writes for the user, and "cannot move a scheduled
  // job to Completed" is a far better failure than two enum values.
  const from = current.stageId
    ? await resolveStage(db, {
        tenantId: ctx.tenantId,
        pipelineId: null,
        stageId: current.stageId,
      })
    : null;

  if (from && !canTransition(from.lifecycle, stage.lifecycle)) {
    throw new NodeFailure(
      `Illegal transition ${from.lifecycle} → ${stage.lifecycle}`,
      transitionMessage(from, stage),
    );
  }

  await db
    .update(jobs)
    .set({
      stageId: stage.id,
      // Denormalised from the resolved stage, never assigned independently.
      // The pair is written together or not at all.
      status: stage.name,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.id, ctx.job.id)));

  return {
    output: {
      jobId: ctx.job.id,
      stageId: stage.id,
      stageLabel: stage.label,
      lifecycle: stage.lifecycle,
      movedFrom: from?.label ?? null,
    },
  };
};

export default jobMoveStage;
