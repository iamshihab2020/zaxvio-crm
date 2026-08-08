/**
 * `job.assign` — put the job in a teammate's name.
 *
 * The ownership check is the whole of this node's risk. `assigneeId` is a
 * client-supplied foreign key living in a saved config, which makes it exactly
 * as untrusted as a request body — and there is no row-level security
 * underneath (D-16). It is checked at publish so the author is told, and again
 * here because people leave the organisation between the two, and because an
 * automation can be duplicated or seeded from a template carrying its ids.
 *
 * `assertOrgMember` is two hops — tenant → organisation → membership — rather
 * than a read of `user`, because `user` has no tenant column. Trusting an id
 * there is precisely what makes a cross-tenant assignment possible.
 */

import { jobs, and, eq } from "@hvac-saas/database";
import { assertOrgMember } from "../ownership.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

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

  const isMember = await assertOrgMember(db, ctx.tenantId, assigneeId);
  if (!isMember) {
    throw new NodeFailure(
      `User ${assigneeId} is not a member of tenant ${ctx.tenantId}`,
      "The person this step assigns jobs to is no longer on your team. Open the " +
        "automation and pick someone else.",
    );
  }

  const [updated] = await db
    .update(jobs)
    .set({ assigneeId, updatedAt: new Date() })
    .where(and(eq(jobs.tenantId, ctx.tenantId), eq(jobs.id, ctx.job.id)))
    .returning({ id: jobs.id });

  // The tenant predicate above means "no row" is "deleted", not "not yours" —
  // a job belonging to another tenant would never have been loaded as the
  // subject in the first place.
  if (!updated) {
    return { skipped: "That job has been deleted, so there was nothing to assign." };
  }

  return { output: { jobId: ctx.job.id, assigneeId } };
};

export default jobAssign;
