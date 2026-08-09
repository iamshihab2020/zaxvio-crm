/**
 * `job.assign` — put the job in a teammate's name.
 *
 * **Calls `assignJob()` and writes no table itself** (`types.ts`: an executor
 * containing an `UPDATE` has, by definition, a second opinion about a business
 * rule). This one had one. It did the ownership check correctly and then wrote
 * `jobs.assignee_id` on its own, so an assignment made by an automation raised
 * no `job.assigned` **and** no `job.updated`, and left no row on the job's
 * timeline. `trigger.job.assigned` shipped as a node, and nothing an automation
 * did could ever reach it.
 *
 * The ownership check still matters and now lives in the service, where the
 * route's own copy of it lived: `assigneeId` is a client-supplied foreign key
 * sitting in a saved config, which makes it exactly as untrusted as a request
 * body, and there is no row-level security underneath (D-16). It is checked at
 * publish so the author is told, and again here because people leave the
 * organisation between the two, and because an automation can be duplicated or
 * seeded from a template carrying its ids.
 */

import { assignJob, type AssignJobFailure } from "../../../jobs/jobs.service.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

/**
 * Which refusals are somebody's mistake.
 *
 * `not_a_member` is a configuration problem with a specific fix — open the
 * automation and pick someone still on the team — so it fails loudly. A job that
 * was archived or deleted, or that is already in that person's name, is just
 * what happened; those are recorded with a reason and the run carries on.
 */
const CONFIG_FAILURES: ReadonlySet<AssignJobFailure> = new Set(["not_a_member"]);

const jobAssign: Executor = async ({ db, ctx, params, node }) => {
  if (!ctx.job) {
    return {
      skipped:
        "This automation isn't running on a job, so there was nothing to assign.",
    };
  }

  const assigneeId = typeof params.assigneeId === "string" ? params.assigneeId : null;
  if (!assigneeId) {
    throw new NodeFailure(
      "assign node has no assignee",
      `The "${node.label}" step has nobody chosen, so the job was left as it was.`,
    );
  }

  const result = await assignJob(db, {
    tenantId: ctx.tenantId,
    jobId: ctx.job.id,
    assigneeId,
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
        `User ${assigneeId} is not a member of tenant ${ctx.tenantId}`,
        "The person this step assigns jobs to is no longer on your team. Open the " +
          "automation and pick someone else.",
      );
    }
    return { skipped: result.message };
  }

  return { output: { jobId: ctx.job.id, assigneeId, previousAssigneeId: result.from } };
};

export default jobAssign;
