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

import type { z } from "zod";
import {
  getDb,
  jobs,
  jobActivities,
  jobChecklistCompletions,
  checklistItems,
  customers,
  customerActivities,
  pipelines,
  tenants,
  and,
  eq,
} from "@hvac-saas/database";
import {
  canTransition,
  getDefaultPipelineId,
  getFirstStage,
  getJobLifecycle,
  resolveStage,
  stageUpdate,
  transitionMessage,
  type JobLifecycle,
  type ResolvedStage,
} from "../job-stages.service.js";
import { emitStageChangeEvents } from "./stage-events.service.js";
import { emitJobCreatedEvent, emitJobUpdatedEvents } from "./job-events.service.js";
import { recalculateJobTotals } from "./totals.js";
import { stopTimersForJob } from "./time.service.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  attachChecklistToJob,
  sendJobCompletionEmailFor,
} from "../../lib/job-helpers.js";
// From `tenant-guards.ts` directly, not through `job-guards.ts`'s re-export.
// The filename was the original bug — importing "job guards" into the calendar
// read like a mistake, so nobody did, and invoices and quotes wrote their own
// copies instead.
import { findForeignRef, isOrgMember } from "../../lib/tenant-guards.js";
import { actorUserId, type Actor } from "../actor.js";
import type { createJobBody, updateJobBody } from "../../lib/schemas/jobs.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;
type JobRow = typeof jobs.$inferSelect;

/**
 * Who is doing this.
 *
 * The type moved to `services/actor.ts` when `customers` needed the identical
 * shape — two structurally-compatible declarations drift the moment one of them
 * gains a field. `JobActor` stays as an alias because it is the name every
 * caller in `routes/jobs` and the executors already imports, and renaming a
 * type across call sites is churn with no reader benefit.
 */
export type JobActor = Actor;

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

    // A job that has reached a terminal lifecycle cannot still be being worked
    // on. Left running, a timer clocked into a completed job keeps its owner
    // clocked in forever — the partial unique index means they cannot start
    // another one, so the next job they open silently refuses to start.
    //
    // Inside the transaction on purpose: a completion that rolls back must not
    // leave the crew clocked out of work they are still doing.
    if (target.lifecycle === "completed" || target.lifecycle === "cancelled") {
      await stopTimersForJob(tx, tenantId, jobId);
    }

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
        // Kept on the row so "why did ten jobs all change at 14:02" is
        // answerable from the timeline alone.
        ...(args.bulk ? { bulk: true } : {}),
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
      ...(args.bulk ? { bulk: true } : {}),
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

// ─────────────────────────────────────────────────────────────────────────────
// Assignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why an assignment did not happen.
 *
 * `not_a_member` is the one that carries security weight: `assigneeId` is a
 * client-supplied foreign key with no row-level security underneath it, and it
 * arrives from a saved automation config exactly as untrusted as a request body
 * — templates and duplicated automations carry ids from wherever they were
 * written. The check is two hops, tenant to organisation to membership, rather
 * than a read of `user`: `user` has no tenant column, so trusting an id there is
 * precisely what makes a cross-tenant assignment possible.
 */
export type AssignJobFailure =
  | "not_found"
  | "archived"
  | "not_a_member"
  | "already_assigned";

export type AssignJobResult =
  | { ok: true; job: JobRow; from: string | null; to: string | null }
  | { ok: false; reason: AssignJobFailure; message: string };

export interface AssignJobArgs {
  tenantId: string;
  jobId: string;
  /** `null` unassigns. The automation node requires somebody; the API does not. */
  assigneeId: string | null;
  actor: JobActor;
}

/**
 * Put a job in somebody's name, with the trail and the events that go with it.
 *
 * The `job.assign` executor did the `UPDATE` and stopped, so an assignment made
 * by an automation raised no `job.assigned` **or** `job.updated` and wrote no
 * activity row: `trigger.job.assigned` exists, and nothing an automation did
 * could ever reach it.
 *
 * Both events fire, not just the specific one. That is `emitJobUpdatedEvents`'s
 * own rule and it is worth restating: suppressing `job.updated` when a more
 * specific event also fired would make "any change to a job" quietly mean "any
 * change except a reassignment" — the kind of exception nobody discovers until
 * their automation has been silently skipping cases for a month.
 *
 * No notification is dispatched, because `PATCH /jobs/:id` does not dispatch one
 * either. Telling a tech they have been given a job is a real gap; it is a gap
 * for people too, so it belongs in its own change rather than smuggled in here
 * where only automations would get it.
 */
export async function assignJob(
  db: Db,
  args: AssignJobArgs,
): Promise<AssignJobResult> {
  const { tenantId, jobId, assigneeId, actor } = args;

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

  if (assigneeId) {
    if (!(await isOrgMember(db, tenantId, assigneeId))) {
      return {
        ok: false,
        reason: "not_a_member",
        message: "Assignee is not a member of this organization",
      };
    }
  }

  // Reported rather than written. A resumed run must not record an assignment
  // that did not happen, and `emitJobUpdatedEvents` would otherwise raise
  // `job.updated` for a no-op — which is an automation firing for nothing.
  if (existing.assigneeId === assigneeId) {
    return {
      ok: false,
      reason: "already_assigned",
      message: assigneeId
        ? "That job is already assigned to them."
        : "That job already has nobody assigned.",
    };
  }

  const description =
    actor.kind === "workflow"
      ? `Updated Assignee by "${actor.workflowName}"`
      : "Updated Assignee";

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(jobs)
      .set({ assigneeId, updatedAt: new Date() })
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
      .returning();

    await tx.insert(jobActivities).values({
      tenantId,
      jobId,
      type: "job.updated",
      description,
      metadata: {
        changedFields: ["assigneeId"],
        ...(actor.kind === "workflow"
          ? { workflowId: actor.workflowId, executionId: actor.executionId }
          : {}),
      },
      performedBy: actorUserId(actor),
    });

    // The same emitter the route uses, given the same shape. The previous values
    // come from `existing`, read before the update — the only place they still
    // exist. Only `assigneeId` is listed as changed, so the schedule comparison
    // inside finds nothing and `job.scheduled` correctly stays quiet.
    await emitJobUpdatedEvents(tx, {
      tenantId,
      actorUserId: actorUserId(actor),
      jobId,
      previous: {
        assigneeId: existing.assigneeId,
        scheduledDate: existing.scheduledDate,
        scheduledStart: existing.scheduledStart,
        scheduledEnd: existing.scheduledEnd,
      },
      changedFields: ["assigneeId"],
    });

    return row;
  });

  return { ok: true, job: updated, from: existing.assigneeId, to: assigneeId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a job was not created.
 *
 * Every one of these is a 400 at the route, which is why the reason exists at
 * all: the *message* is what a person reads, and collapsing six causes into one
 * "Bad request" is how a form ends up unable to say which field is wrong.
 */
export type CreateJobFailure =
  | "customer_not_found"
  | "bad_reference"
  | "pipeline_not_found"
  | "no_such_stage"
  | "pipeline_has_no_stages"
  | "not_a_member";

export type CreateJobResult =
  | { ok: true; job: JobRow }
  | { ok: false; reason: CreateJobFailure; message: string };

export interface CreateJobArgs {
  tenantId: string;
  input: z.infer<typeof createJobBody>;
  actor: JobActor;
}

/**
 * Create a job, its checklist, its two activity rows and its `job.created` event.
 *
 * ## The membership check was still a second copy
 *
 * This handler kept its own inline `member` lookup after `assignJob` moved
 * `PATCH /jobs/:id` onto `isOrgMember` — and it carried the identical
 * **fail-open** shape, `if (body.assigneeId && tenantRecord)` with no `else`, so
 * a tenant whose organisation row is missing skipped the check rather than
 * failing it. The consolidation commit swept the file it was reading and did not
 * reach the handler two hundred lines above, which is the same propagation
 * failure this project has now recorded for `/reorder`, `quote-to-job` and the
 * bulk bar. One import removes the fourth copy.
 *
 * ## Everything stays inside one transaction
 *
 * This was five loose statements — insert, checklist, job activity, customer
 * activity, re-fetch — so a failure part-way left a job with no checklist and no
 * trail. The checklist is what a tech works from; a job without one is not a
 * usable job, and nothing about the response said anything had gone wrong.
 *
 * The `job.created` event joined them for a stricter reason: an event that can
 * commit apart from its domain write is an automation that fires for a job that
 * does not exist, or a job that no automation will ever see.
 */
export async function createJob(
  db: Db,
  args: CreateJobArgs,
): Promise<CreateJobResult> {
  const { tenantId, input, actor } = args;
  const userId = actorUserId(actor);

  const [customer] = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
    })
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, input.customerId)),
    );

  if (!customer) {
    return {
      ok: false,
      reason: "customer_not_found",
      message: "Customer not found",
    };
  }

  // `bookingId` and `equipmentId` are client-supplied foreign keys. They used to
  // be written straight from the body while `customerId`, `pipelineId` and
  // `assigneeId` beside them were all validated.
  const badRef = await findForeignRef(db, tenantId, {
    equipmentId: input.equipmentId,
    bookingId: input.bookingId,
  });
  if (badRef) {
    return {
      ok: false,
      reason: "bad_reference",
      message: `${badRef} not found`,
    };
  }

  let pipelineId: string | null;
  if (input.pipelineId) {
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(
        and(
          eq(pipelines.tenantId, tenantId),
          eq(pipelines.id, input.pipelineId),
        ),
      );
    if (!pipeline) {
      return {
        ok: false,
        reason: "pipeline_not_found",
        message: "Pipeline not found",
      };
    }
    pipelineId = pipeline.id;
  } else {
    pipelineId = await getDefaultPipelineId(db, tenantId);
  }

  // A job starts in the stage the caller asked for — "Add job to this column"
  // sends one — and otherwise in the pipeline's first stage. Either way `status`
  // is that stage's name, so a tenant who renamed "Scheduled" to "Booked" sees
  // new jobs land in the column they actually built.
  let startingStage: ResolvedStage | null = null;
  if (pipelineId) {
    if (input.stageId || input.status) {
      startingStage = await resolveStage(db, {
        tenantId,
        pipelineId,
        stageId: input.stageId,
        status: input.status,
      });
      if (!startingStage) {
        return {
          ok: false,
          reason: "no_such_stage",
          message: `No stage "${input.stageId ?? input.status}" in the selected pipeline`,
        };
      }
    } else {
      startingStage = await getFirstStage(db, { tenantId, pipelineId });
    }
    if (!startingStage) {
      return {
        ok: false,
        reason: "pipeline_has_no_stages",
        message: "The selected pipeline has no stages. Add a stage first.",
      };
    }
  }

  if (input.assigneeId && !(await isOrgMember(db, tenantId, input.assigneeId))) {
    return {
      ok: false,
      reason: "not_a_member",
      message: "Assignee is not a member of this organization",
    };
  }

  const [tenantRecord] = await db
    .select({ defaultTaxRate: tenants.defaultTaxRate })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const taxRate = input.taxRate || tenantRecord?.defaultTaxRate || "0";

  const description =
    actor.kind === "workflow"
      ? `Job created for ${customer.firstName} ${customer.lastName} by "${actor.workflowName}"`
      : `Job created for ${customer.firstName} ${customer.lastName}`;

  const created = await db.transaction(async (tx) => {
    const [job] = await tx
      .insert(jobs)
      .values({
        tenantId,
        customerId: input.customerId,
        bookingId: input.bookingId || null,
        equipmentId: input.equipmentId || null,
        pipelineId,
        stageId: startingStage?.id ?? null,
        jobNumber: "", // Auto-generated by DB trigger
        serviceType: input.serviceType,
        title: input.title,
        description: input.description || null,
        scheduledDate: input.scheduledDate,
        scheduledStart: input.scheduledStart || null,
        scheduledEnd: input.scheduledEnd || null,
        address: input.address || null,
        status: startingStage?.name ?? "scheduled",
        priority: input.priority ?? "standard",
        taxRate,
        notes: input.notes || null,
        assigneeId: input.assigneeId || null,
      })
      .returning();

    await attachChecklistToJob(tx, job.id, tenantId, input.serviceType, userId);

    await tx.insert(jobActivities).values({
      tenantId,
      jobId: job.id,
      type: "job.created",
      description,
      metadata:
        actor.kind === "workflow"
          ? { workflowId: actor.workflowId, executionId: actor.executionId }
          : {},
      performedBy: userId,
    });

    await tx.insert(customerActivities).values({
      tenantId,
      customerId: input.customerId,
      type: "job.created",
      description: `Job ${job.jobNumber || "new"} created`,
      metadata: { jobId: job.id },
      performedBy: userId,
    });

    // `emitJobCreatedEvent` re-reads the row itself, so it gets the
    // trigger-issued `jobNumber` and the resolved stage without this function
    // assembling a payload.
    await emitJobCreatedEvent(tx, {
      tenantId,
      actorUserId: userId,
      jobId: job.id,
      // A job created against a booking is a conversion, whatever screen it was
      // clicked from — an automation that greets a new customer needs to know
      // they have already had a booking confirmation.
      origin: input.bookingId ? "booking" : "manual",
      originId: input.bookingId || null,
    });

    // Re-fetch inside the transaction for the trigger-generated jobNumber.
    const [row] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, job.id)));
    return row;
  });

  return { ok: true, job: created };
}

// ─────────────────────────────────────────────────────────────────────────────
// Field updates
// ─────────────────────────────────────────────────────────────────────────────

export type UpdateJobFailure =
  | "not_found"
  | "archived"
  | "pipeline_not_found"
  | "no_landing_stage"
  | "lifecycle_mismatch"
  | "invalid_times"
  | "not_a_member";

export type UpdateJobResult =
  | { ok: true; job: JobRow; changedFields: string[] }
  | { ok: false; reason: UpdateJobFailure; message: string };

export interface UpdateJobArgs {
  tenantId: string;
  jobId: string;
  input: z.infer<typeof updateJobBody>;
  actor: JobActor;
}

/** The columns this function will write, and what to call each one to a reader. */
const UPDATABLE_FIELDS = [
  "title",
  "description",
  "priority",
  "serviceType",
  "scheduledDate",
  "scheduledStart",
  "scheduledEnd",
  "address",
  "notes",
  "taxRate",
  "equipmentId",
  "pipelineId",
  "assigneeId",
] as const;

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  priority: "Priority",
  serviceType: "Service Type",
  scheduledDate: "Scheduled Date",
  scheduledStart: "Scheduled Start",
  scheduledEnd: "Scheduled End",
  address: "Address",
  notes: "Notes",
  taxRate: "Tax Rate",
  equipmentId: "Asset",
  pipelineId: "Pipeline",
  assigneeId: "Assignee",
};

/**
 * Nullable text columns where "the user cleared this" must be exactly one value.
 *
 * `POST` writes `input.x || null` while this loop wrote `input[field]` verbatim,
 * so clearing a description through the two verbs produced `NULL` from one and
 * `''` from the other — one column, two spellings of empty, and every `IS NULL`
 * check downstream disagreeing with itself.
 */
const NULLABLE_TEXT = new Set([
  "description",
  "address",
  "notes",
  "scheduledStart",
  "scheduledEnd",
]);

/**
 * Update a job's fields. Deliberately not its stage — that is `moveJobStage`.
 *
 * Moving pipelines has to move the stage pointer too, or the job keeps a
 * `stage_id` belonging to the pipeline it just left, and the landing stage has
 * to be at the *same* lifecycle: rehoming a completed job must not quietly
 * reopen it, and there is no product path that means "move board and change
 * state" as one gesture.
 */
export async function updateJob(
  db: Db,
  args: UpdateJobArgs,
): Promise<UpdateJobResult> {
  const { tenantId, jobId, input, actor } = args;
  const userId = actorUserId(actor);

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

  let rehomedStageId: string | undefined;
  if (input.pipelineId) {
    const [pipeline] = await db
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(
        and(
          eq(pipelines.tenantId, tenantId),
          eq(pipelines.id, input.pipelineId),
        ),
      );
    if (!pipeline) {
      return {
        ok: false,
        reason: "pipeline_not_found",
        message: "Pipeline not found",
      };
    }

    const currentLifecycle = await getJobLifecycle(db, {
      tenantId,
      stageId: existing.stageId,
      status: existing.status,
    });
    const landing = await resolveStage(db, {
      tenantId,
      pipelineId: input.pipelineId,
      status: existing.status,
    });
    if (!landing) {
      return {
        ok: false,
        reason: "no_landing_stage",
        message: `Target pipeline has no stage matching current job status "${existing.status}"`,
      };
    }
    if (landing.lifecycle !== currentLifecycle) {
      return {
        ok: false,
        reason: "lifecycle_mismatch",
        message: `Target pipeline's "${landing.label}" stage is ${landing.lifecycle.replace("_", " ")}, but this job is ${currentLifecycle.replace("_", " ")}`,
      };
    }
    rehomedStageId = landing.id;
  }

  // The schema-level refinement only sees the fields in this request, so a PATCH
  // sending just `scheduledEnd` would pass while inverting the times on a job
  // that already has a start. Check the merged result.
  const mergedStart =
    "scheduledStart" in input ? input.scheduledStart : existing.scheduledStart;
  const mergedEnd =
    "scheduledEnd" in input ? input.scheduledEnd : existing.scheduledEnd;
  if (mergedStart && mergedEnd && mergedEnd <= mergedStart) {
    return {
      ok: false,
      reason: "invalid_times",
      message: "End time must be after start time",
    };
  }

  if (input.assigneeId && !(await isOrgMember(db, tenantId, input.assigneeId))) {
    return {
      ok: false,
      reason: "not_a_member",
      message: "Assignee is not a member of this organization",
    };
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const changedFields: string[] = [];

  for (const field of UPDATABLE_FIELDS) {
    if (field in input) {
      const raw = input[field];
      const value =
        NULLABLE_TEXT.has(field) && typeof raw === "string" && raw.trim() === ""
          ? null
          : raw;
      const oldVal = existing[field] ?? "";
      const newVal = value ?? "";
      if (String(oldVal) !== String(newVal)) {
        changedFields.push(field);
      }
      updates[field] = value;
    }
  }

  if (rehomedStageId) {
    updates.stageId = rehomedStageId;
  }

  // One transaction. `emitJobUpdatedEvents` reads the row back to build its
  // payload, so it must see the update, and the update must not survive without
  // it. The activity row joins them for the same reason it does in `createJob` —
  // a change with no trail is invisible.
  const final = await db.transaction(async (tx) => {
    await tx
      .update(jobs)
      .set(updates)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

    if (changedFields.includes("taxRate")) {
      await recalculateJobTotals(tx, jobId, tenantId);
    }

    if (changedFields.length > 0) {
      const readableFields = changedFields
        .map((f) => FIELD_LABELS[f] ?? f)
        .join(", ");
      await tx.insert(jobActivities).values({
        tenantId,
        jobId,
        type: "job.updated",
        description:
          actor.kind === "workflow"
            ? `Updated ${readableFields} by "${actor.workflowName}"`
            : `Updated ${readableFields}`,
        metadata: {
          changedFields,
          ...(actor.kind === "workflow"
            ? { workflowId: actor.workflowId, executionId: actor.executionId }
            : {}),
        },
        performedBy: userId,
      });
    }

    // `job.updated`, plus `job.assigned` and `job.scheduled` when those specific
    // things moved. The previous values come from `existing`, read before the
    // update — the only place they still exist.
    await emitJobUpdatedEvents(tx, {
      tenantId,
      actorUserId: userId,
      jobId,
      previous: {
        assigneeId: existing.assigneeId,
        scheduledDate: existing.scheduledDate,
        scheduledStart: existing.scheduledStart,
        scheduledEnd: existing.scheduledEnd,
      },
      changedFields,
    });

    // Re-fetch after potential recalculation. Tenant-scoped like every other
    // read — this one had only the job id (security-rules §1).
    const [row] = await tx
      .select()
      .from(jobs)
      .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
    return row;
  });

  return { ok: true, job: final, changedFields };
}
