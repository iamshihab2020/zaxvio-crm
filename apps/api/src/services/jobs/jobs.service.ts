/**
 * Job operations — the one definition of what happens when a job moves.
 *
 * ## Why this exists, which is not the reason the plan gave
 *
 * [[wf-12-phases|P7]] scoped this as paying down [[architecture|ARC-05]]: the
 * route file is 2,616 lines and [[api-rules|§1]] says handlers must be thin.
 * True, and the weakest of the reasons. The real one is that **there were two
 * definitions of "move a job's stage"** and they disagreed.
 *
 * `PATCH /jobs/:id/status` refuses an archived job, refuses a completion with
 * required checklist items outstanding, writes a `job_activities` row, raises
 * `job.stage_changed` plus `job.completed`/`job.cancelled`, dispatches an in-app
 * notification and sends the E-05 completion email.
 *
 * The `job.moveStage` **executor** did the `UPDATE` and stopped. So an
 * automation that completed a job completed it in a way a person is not allowed
 * to, told the customer nothing, left no trace on the job's own timeline, and —
 * because it raised no event — **could not trigger another automation**. That is
 * why `trigger.job.stage_changed` shipped and was unreachable from an
 * automation: the only writer that could have fed it was the one that stayed
 * silent.
 *
 * This is the **third** time this exact shape has been found:
 *
 *   - `PATCH /jobs/reorder` used to write `status` too, skipping the gate, the
 *     email, the notification and the activity row (JOB-06).
 *   - `lib/quote-to-job.ts` wrote `jobs.status` by hand and never `stage_id`, so
 *     for four days every job created from a quote sat outside the stage model
 *     (QUO-02).
 *
 * Both were fixed by routing through the one path, and the executor shipped
 * *after* both fixes — because a sweep of `routes/jobs` does not reach
 * `services/workflow`. `executors/types.ts` had already written the rule down:
 * *"An executor containing an `UPDATE` has, by definition, a second opinion
 * about a business rule."*
 *
 * ## Two shapes that make one function serve both callers
 *
 * **`JobActor` is a person or an automation.** Not `userId: string | null` —
 * null would be three things (a cron, the portal, a workflow) and the activity
 * row needs to name which. The same pair `customer.addNote` already persists as
 * `created_by` / `created_by_workflow_id`.
 *
 * **Failure is a returned union, never a throw.** The route needs a 400 with a
 * sentence; the executor needs a `NodeFailure` for a broken config and a
 * `skipped` for an ordinary outcome, and those are different sentences for
 * different readers. A service that threw either vocabulary would force the
 * other caller to catch and translate — and `reply` objects are truthy, which is
 * how the booking convert path ran its success branch on a failure (BOOK-01).
 */

import {
  getDb,
  jobs,
  jobActivities,
  jobChecklistCompletions,
  checklistItems,
  and,
  eq,
} from "@hvac-saas/database";
import {
  canTransition,
  getJobLifecycle,
  resolveStage,
  stageUpdate,
  transitionMessage,
  type JobLifecycle,
  type ResolvedStage,
} from "../job-stages.service.js";
import { emitStageChangeEvents } from "./stage-events.service.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { sendJobCompletionEmailFor } from "../../lib/job-helpers.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;
type JobRow = typeof jobs.$inferSelect;

/**
 * Who is doing this.
 *
 * `workflowName` and `executionId` are carried rather than looked up because the
 * activity row quotes the automation by name — "Moved by \"Chase overdue
 * invoices\"" is what the job's timeline should say, and a reader who wants the
 * run has the execution id to open it with.
 */
export type JobActor =
  | { kind: "user"; userId: string }
  | {
      kind: "workflow";
      workflowId: string;
      workflowName: string;
      executionId: string;
    };

/** The user id for the columns that hold one. Null for every automation. */
function actorUserId(actor: JobActor): string | null {
  return actor.kind === "user" ? actor.userId : null;
}

export interface MoveJobStageArgs {
  tenantId: string;
  jobId: string;
  /** One of these two. `stageId` wins when both are given, as `resolveStage` decides. */
  stageId?: string | null;
  status?: string | null;
  actor: JobActor;
  /**
   * True for the bulk path, so "notify me per job" does not turn one drag into a
   * hundred emails. Carried through to the event, which is where the node filter
   * reads it.
   */
  bulk?: boolean;
}

/**
 * Why a move did not happen.
 *
 * Deliberately more granular than the messages: the route maps `not_found` to a
 * 404 and everything else to a 400, while the executor maps `already_there`,
 * `not_found` and `checklist_incomplete` to a `skipped` (ordinary outcomes a
 * tenant should read in the run log) and the rest to a `NodeFailure` (a
 * configuration problem somebody has to open the automation and fix).
 */
export type MoveJobStageFailure =
  | "not_found"
  | "archived"
  | "no_such_stage"
  | "already_there"
  | "illegal_transition"
  | "checklist_incomplete";

export type MoveJobStageResult =
  | { ok: true; job: JobRow; from: string; to: ResolvedStage }
  | { ok: false; reason: MoveJobStageFailure; message: string };

/**
 * Move a job to a pipeline stage, with everything that has always gone with it.
 *
 * Resolution is scoped to **the job's own pipeline**, taken from the row rather
 * than from the caller. The route already did this; the executor took a
 * `pipelineId` from its saved config, so a stage id copied between automations
 * could move a job onto a board it was not on. There is no product path that
 * changes a job's pipeline by moving its stage, so the stricter rule is also the
 * correct one.
 */
export async function moveJobStage(
  db: Db,
  args: MoveJobStageArgs,
): Promise<MoveJobStageResult> {
  const { tenantId, jobId, actor } = args;

  // Read the job fresh. The executor used to trust `ctx.job`, which on a resumed
  // run can be three days old — and a transition checked against a stale
  // lifecycle is not a check.
  const [existing] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

  if (!existing) {
    return { ok: false, reason: "not_found", message: "Job not found" };
  }

  if (existing.archivedAt) {
    return {
      ok: false,
      reason: "archived",
      message: "Cannot modify an archived job. Restore it first.",
    };
  }

  const target = await resolveStage(db, {
    tenantId,
    pipelineId: existing.pipelineId,
    stageId: args.stageId ?? null,
    status: args.status ?? null,
  });

  if (!target) {
    return {
      ok: false,
      reason: "no_such_stage",
      message: `No stage "${args.stageId ?? args.status}" in this job's pipeline`,
    };
  }

  if (existing.stageId === target.id) {
    return {
      ok: false,
      reason: "already_there",
      message: `Job is already in "${target.label}"`,
    };
  }

  const fromLifecycle: JobLifecycle = await getJobLifecycle(db, {
    tenantId,
    stageId: existing.stageId,
    status: existing.status,
  });

  if (!canTransition(fromLifecycle, target.lifecycle)) {
    return {
      ok: false,
      reason: "illegal_transition",
      message: transitionMessage(
        { label: existing.status, lifecycle: fromLifecycle },
        target,
      ),
    };
  }

  // The completion gate. An automation is subject to it for the same reason a
  // person is: the tenant configured those items as required, and a rule that
  // an automation can walk past is not a rule. This is the single largest
  // behaviour change in the extraction, and it is a restoration rather than a
  // new restriction.
  if (target.lifecycle === "completed") {
    const incompleteRequired = await db
      .select({ id: jobChecklistCompletions.id })
      .from(jobChecklistCompletions)
      .innerJoin(
        checklistItems,
        eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
      )
      .where(
        and(
          eq(jobChecklistCompletions.jobId, jobId),
          eq(jobChecklistCompletions.tenantId, tenantId),
          eq(checklistItems.isRequired, true),
          eq(jobChecklistCompletions.isCompleted, false),
        ),
      );

    if (incompleteRequired.length > 0) {
      return {
        ok: false,
        reason: "checklist_incomplete",
        message: `Cannot complete job: ${incompleteRequired.length} required checklist item(s) not completed`,
      };
    }
  }

  const description =
    actor.kind === "workflow"
      ? `Status changed from ${existing.status} to ${target.label} by "${actor.workflowName}"`
      : `Status changed from ${existing.status} to ${target.label}`;

  // One transaction: the move, its activity row and its workflow events. The
  // events must not be able to commit without the move, or an automation fires
  // for a change that did not happen; the move must not be able to commit
  // without the events, or an automation is permanently un-fired with nothing
  // left to show for it.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(jobs)
      .set({ ...stageUpdate(target, fromLifecycle), updatedAt: new Date() })
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
      .returning();

    await tx.insert(jobActivities).values({
      tenantId,
      jobId,
      type: "job.status_changed",
      description,
      metadata: {
        from: existing.status,
        to: target.name,
        fromLifecycle,
        toLifecycle: target.lifecycle,
        stageId: target.id,
        ...(actor.kind === "workflow"
          ? { workflowId: actor.workflowId, executionId: actor.executionId }
          : {}),
      },
      performedBy: actorUserId(actor),
    });

    await emitStageChangeEvents(tx, {
      tenantId,
      actorUserId: actorUserId(actor),
      bulk: args.bulk ?? false,
      transitions: [
        {
          jobId,
          // `jobs.status` is the stage's name, denormalised — so the row itself
          // carries the old stage's name without a second read.
          from: existing.stageId
            ? { id: existing.stageId, name: existing.status, lifecycle: fromLifecycle }
            : null,
          to: { id: target.id, name: target.name, lifecycle: target.lifecycle },
        },
      ],
    });

    return row;
  });

  dispatchNotification({
    tenantId,
    type: "job_status_changed",
    title: `Job ${existing.jobNumber ?? ""} moved to ${target.label}`,
    description,
    entityType: "job",
    entityId: jobId,
    actorId: actorUserId(actor),
    metadata: {
      jobNumber: existing.jobNumber,
      from: existing.status,
      to: target.name,
      ...(actor.kind === "workflow" ? { workflowId: actor.workflowId } : {}),
    },
  });

  // E-05. Keyed on lifecycle, not the stage name — a tenant whose final column
  // is called "closed_out" must still get it.
  if (target.lifecycle === "completed") {
    void sendJobCompletionEmailFor(db, tenantId, jobId);
  }

  return { ok: true, job: updated, from: existing.status, to: target };
}
