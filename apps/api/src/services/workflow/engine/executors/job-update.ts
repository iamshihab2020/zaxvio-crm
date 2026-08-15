/**
 * `job.update` — change fields on the job.
 *
 * Through `updateJob()`, which owns the field allow-list, the merged
 * end-after-start check, the activity row and `job.updated`.
 *
 * **It cannot move a job's stage**, and that is the point of it being a separate
 * node from `job.moveStage`. `updateJob` writes no `status` and no `stageId`
 * except when rehoming a pipeline, so a generic "set a field" step has no path
 * to the transition table, the required-checklist gate, the completion email or
 * the notification. A node that could write `status` here would be the *fifth*
 * implementation of a stage move in this codebase.
 *
 * Absent is not blank, for the same reason as `customer.update`: an unresolved
 * `{{job.notes}}` arrives as `""`, and treating that as an instruction to clear
 * would erase the field the variable was reading from.
 */

import { updateJob } from "../../../jobs/jobs.service.js";
import { updateJobBody } from "../../../../lib/schemas/jobs.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const FIELDS = ["priority", "scheduledDate", "notes"] as const;

const jobUpdate: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.job) {
    return {
      skipped: "This automation isn't running for a job, so there was nothing to update.",
    };
  }

  const input: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = params[field];
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    input[field] = trimmed;
  }

  if (Object.keys(input).length === 0) {
    return {
      skipped: "Every field on this step was empty, so there was nothing to change.",
    };
  }

  const parsed = updateJobBody.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new NodeFailure(
      `job.update invalid config on ${node.id}: ${first?.path.join(".")}`,
      `The "${node.label}" step could not update the job: ${first?.message ?? "one of its settings is not valid"}.`,
    );
  }

  const result = await updateJob(db, {
    tenantId: ctx.tenantId,
    jobId: ctx.job.id,
    input: parsed.data,
    actor: {
      kind: "workflow",
      workflowId: ctx.workflowId,
      workflowName: ctx.workflowName,
      executionId: ctx.executionId,
    },
  });

  if (!result.ok) {
    // `not_a_member` cannot arise — this node offers no assignee field — and
    // the rest are ordinary outcomes: an archived job, a job deleted mid-run,
    // or values that were already what the step wanted to set.
    return { skipped: result.message };
  }

  return {
    output: {
      jobId: result.job.id,
      jobNumber: result.job.jobNumber,
      changedFields: result.changedFields,
    },
  };
};

export default jobUpdate;
