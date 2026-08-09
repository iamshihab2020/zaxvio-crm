/**
 * Workflow events for a job's **lifecycle outside the stage column** — creation,
 * field edits, assignment and scheduling.
 *
 * Stage moves live in `stage-events.service.ts` and are deliberately separate:
 * they are written by one service (`stageUpdate`) from two routes, whereas these
 * are written by three different routes plus two conversion paths. What the two
 * files share is the rule that made the first one worth extracting — the payload
 * is assembled **once**, from a read of the row after it was written, so a job
 * created by the API, by a quote conversion and by a booking conversion all
 * produce byte-identical event shapes. `lib/quote-to-job.ts` is the reason to
 * insist on it: that file wrote `jobs.status` by hand and skipped `stage_id`
 * for four days because it was outside the file everyone was editing.
 *
 * Everything runs **inside the caller's transaction**. A job that committed
 * without its `job.created` event is a job no automation will ever see, and
 * nothing in the UI would show that anything was missed.
 */

import {
  customers,
  jobs,
  jobPipelineStages,
  user,
  and,
  eq,
  inArray,
  type getDb,
} from "@hvac-saas/database";
import type { JobLifecycle } from "../job-stages.service.js";
import {
  changedFields as diffFields,
  jobAssigned,
  jobCreated,
  jobScheduled,
  jobUpdated,
  type CustomerArgs,
} from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/** A stage as an event payload needs it. `label` is for humans and not carried. */
export interface StageRef {
  id: string;
  name: string;
  lifecycle: JobLifecycle;
}

/** Everything a job producer needs, read from the row rather than the request. */
export interface JobEventContext {
  job: {
    id: string;
    jobNumber: string;
    title: string;
    serviceType:
      | "installation"
      | "repair"
      | "maintenance"
      | "inspection"
      | "emergency"
      | "consultation"
      | "other";
    priority: "standard" | "urgent" | "emergency";
    pipelineId: string | null;
    assigneeId: string | null;
    totalAmount: string | null;
    scheduledDate: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    createdAt: Date;
  };
  customer: CustomerArgs;
  stage: StageRef | null;
}

/**
 * Read the jobs, their customers and their stages in one query.
 *
 * `innerJoin` on customers, `leftJoin` on the stage: a job cannot exist without
 * a customer (the column is `NOT NULL`), but it can sit outside the stage model
 * — rows predating the stage split do, and so does any job whose pipeline was
 * deleted (`stage_id` is `SET NULL`, deliberately, so deleting a column does not
 * delete the work in it).
 *
 * Both joins carry a tenant predicate. The `jobs` filter alone would be enough
 * for correctness today, but a join without one is the exact shape of the three
 * ownership gaps the 2026-08-06 audit found, and the cost of writing it is one
 * line.
 */
export async function loadJobEventContext(
  db: Db,
  tenantId: string,
  jobIds: string[],
): Promise<Map<string, JobEventContext>> {
  const out = new Map<string, JobEventContext>();
  if (jobIds.length === 0) return out;

  const rows = await db
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      title: jobs.title,
      serviceType: jobs.serviceType,
      priority: jobs.priority,
      pipelineId: jobs.pipelineId,
      assigneeId: jobs.assigneeId,
      totalAmount: jobs.totalAmount,
      scheduledDate: jobs.scheduledDate,
      scheduledStart: jobs.scheduledStart,
      scheduledEnd: jobs.scheduledEnd,
      createdAt: jobs.createdAt,
      customerId: customers.id,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
      stageId: jobPipelineStages.id,
      stageName: jobPipelineStages.name,
      stageLifecycle: jobPipelineStages.lifecycle,
    })
    .from(jobs)
    .innerJoin(
      customers,
      and(eq(jobs.customerId, customers.id), eq(customers.tenantId, tenantId)),
    )
    .leftJoin(
      jobPipelineStages,
      and(
        eq(jobs.stageId, jobPipelineStages.id),
        eq(jobPipelineStages.tenantId, tenantId),
      ),
    )
    .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, jobIds)));

  for (const row of rows) {
    out.set(row.id, {
      job: {
        id: row.id,
        // The number is issued by a trigger. Empty only for the instant between
        // the `INSERT` and the re-read, which callers here are always past.
        jobNumber: row.jobNumber ?? "",
        title: row.title,
        serviceType: row.serviceType,
        priority: row.priority,
        pipelineId: row.pipelineId,
        assigneeId: row.assigneeId,
        totalAmount: row.totalAmount,
        scheduledDate: row.scheduledDate,
        scheduledStart: row.scheduledStart,
        scheduledEnd: row.scheduledEnd,
        createdAt: row.createdAt,
      },
      customer: {
        id: row.customerId,
        firstName: row.customerFirstName,
        lastName: row.customerLastName,
        email: row.customerEmail,
        phone: row.customerPhone,
      },
      stage:
        row.stageId && row.stageName && row.stageLifecycle
          ? { id: row.stageId, name: row.stageName, lifecycle: row.stageLifecycle }
          : null,
    });
  }

  return out;
}

/**
 * Display names for a set of user ids.
 *
 * The ids only ever come from `jobs.assignee_id`, which is validated as an org
 * member before it is written, so this reads the Better Auth `user` table by id
 * with no tenant predicate — that table has no tenant column and the scoping
 * happened at the write. A name that cannot be resolved comes back `null`
 * rather than throwing: a deleted teammate must not stop the event.
 */
async function resolveUserNames(
  db: Db,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return names;

  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, unique));

  for (const row of rows) names.set(row.id, row.name);
  return names;
}

export interface EmitJobCreatedArgs {
  tenantId: string;
  actorUserId: string | null;
  jobId: string;
  /**
   * Where the job came from. A follow-up automation reads this to avoid
   * double-messaging a customer who has just been emailed a quote acceptance
   * or a booking confirmation.
   */
  origin: "manual" | "quote" | "booking" | "api";
  /** The quote or booking id when `origin` names one; null otherwise. */
  originId: string | null;
}

/** Emit `job.created`. Safe to call for a job that has since vanished. */
export async function emitJobCreatedEvent(
  db: Db,
  args: EmitJobCreatedArgs,
): Promise<void> {
  const context = (await loadJobEventContext(db, args.tenantId, [args.jobId])).get(
    args.jobId,
  );
  if (!context) return;

  await jobCreated(db, {
    tenantId: args.tenantId,
    actorUserId: args.actorUserId,
    // Written out rather than `{ ...toJobArgs(context), createdAt }`. The
    // producers directory bans spreads outright and a test enforces it; this
    // file is one call away from those payloads, so it holds the same line.
    job: {
      id: context.job.id,
      jobNumber: context.job.jobNumber,
      title: context.job.title,
      serviceType: context.job.serviceType,
      priority: context.job.priority,
      pipelineId: context.job.pipelineId,
      assigneeId: context.job.assigneeId,
      totalAmount: context.job.totalAmount,
      scheduledDate: context.job.scheduledDate,
      createdAt: context.job.createdAt,
    },
    customer: context.customer,
    stage: context.stage,
    origin: args.origin,
    originId: args.originId,
  });
}

/**
 * The nine job fields every payload shares, from a context.
 *
 * This is the one place in this file that copies a row into the producer shape,
 * and it is written field by field for the same reason the producers are: a
 * spread would carry `scheduledStart` into a payload that never declared it and
 * — worse — would silently start carrying whatever column is added to `jobs`
 * next. See `services/workflow/events/producers/shared.ts`.
 */
function toJobArgs(context: JobEventContext) {
  return {
    id: context.job.id,
    jobNumber: context.job.jobNumber,
    title: context.job.title,
    serviceType: context.job.serviceType,
    priority: context.job.priority,
    pipelineId: context.job.pipelineId,
    assigneeId: context.job.assigneeId,
    totalAmount: context.job.totalAmount,
    scheduledDate: context.job.scheduledDate,
  };
}

/** The subset of a job's previous state that decides which events an edit emits. */
export interface JobEditSnapshot {
  assigneeId: string | null;
  scheduledDate: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
}

export interface EmitJobUpdatedArgs {
  tenantId: string;
  actorUserId: string | null;
  jobId: string;
  /** The row as it was **before** the update, for the three comparisons below. */
  previous: JobEditSnapshot;
  /**
   * The route's own diff. Passed in rather than recomputed because the route
   * already normalises `""` to `null` before comparing, and a second diff that
   * did not would report a change the route decided was not one.
   */
  changedFields: string[];
}

/**
 * Emit `job.updated`, plus `job.assigned` and `job.scheduled` when those
 * specific things changed.
 *
 * Three events rather than one because they answer different questions and a
 * tenant will want different automations on them: "tell the customer their
 * appointment moved" must not fire because someone fixed a typo in the notes,
 * and "notify the tech" must not fire because the price changed.
 *
 * `job.updated` still fires alongside — it is the catch-all trigger, and a
 * filter node is how a workflow narrows it. Suppressing it when a more specific
 * event also fired would make "any change to a job" quietly mean "any change
 * except a reassignment", which is the kind of exception nobody discovers until
 * their automation has been silently skipping cases for a month.
 */
export async function emitJobUpdatedEvents(
  db: Db,
  args: EmitJobUpdatedArgs,
): Promise<void> {
  if (args.changedFields.length === 0) return;

  const context = (await loadJobEventContext(db, args.tenantId, [args.jobId])).get(
    args.jobId,
  );
  if (!context) return;

  const job = toJobArgs(context);
  const { tenantId, actorUserId, previous } = args;

  await jobUpdated(db, {
    tenantId,
    actorUserId,
    job,
    customer: context.customer,
    changedFields: args.changedFields,
  });

  const assigneeChanged = previous.assigneeId !== context.job.assigneeId;
  if (assigneeChanged) {
    const names = await resolveUserNames(
      db,
      [previous.assigneeId, context.job.assigneeId].filter(
        (id): id is string => id !== null,
      ),
    );
    await jobAssigned(db, {
      tenantId,
      actorUserId,
      job,
      customer: context.customer,
      from: previous.assigneeId
        ? { id: previous.assigneeId, name: names.get(previous.assigneeId) ?? "Unknown" }
        : null,
      to: context.job.assigneeId
        ? {
            id: context.job.assigneeId,
            name: names.get(context.job.assigneeId) ?? "Unknown",
          }
        : null,
    });
  }

  // A schedule change is a change to the date **or** either time — moving a
  // 9am to 2pm on the same day is a reschedule the customer needs to hear
  // about, and comparing only the date would call that no change at all.
  const timing = diffFields(
    {
      scheduledDate: previous.scheduledDate,
      scheduledStart: previous.scheduledStart,
      scheduledEnd: previous.scheduledEnd,
    },
    {
      scheduledDate: context.job.scheduledDate,
      scheduledStart: context.job.scheduledStart,
      scheduledEnd: context.job.scheduledEnd,
    },
  );

  if (timing.length > 0) {
    await jobScheduled(db, {
      tenantId,
      actorUserId,
      job,
      customer: context.customer,
      fromDate: previous.scheduledDate,
      toDate: context.job.scheduledDate,
      startTime: context.job.scheduledStart,
      endTime: context.job.scheduledEnd,
    });
  }
}
