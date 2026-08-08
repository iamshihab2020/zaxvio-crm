/**
 * Workflow events for a job stage change — **one implementation, two callers**.
 *
 * `PATCH /jobs/:id/status` and `POST /jobs/bulk-status-update` both move jobs
 * between stages, and this repo has already paid for letting them diverge:
 * JOB-22 found that the bulk path sent no completion email at all, so
 * completing ten jobs from the bulk bar notified nobody while completing the
 * same ten one at a time sent ten emails. The fix then was to share the email
 * helper. This is the same fix, applied to events before the divergence can
 * happen rather than after.
 *
 * Everything here runs **inside the caller's transaction**, so the events and
 * the `UPDATE` that caused them commit together. A stage change that committed
 * without its event would leave an automation permanently un-fired with nothing
 * to show for it.
 */

import {
  customers,
  jobs,
  jobLineItems,
  and,
  eq,
  inArray,
  count,
  type getDb,
} from "@hvac-saas/database";
import type { JobLifecycle } from "../job-stages.service.js";
import { jobCancelled, jobCompleted, jobStageChanged } from "../workflow/events/producers/index.js";
import type { CustomerArgs } from "../workflow/events/producers/index.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/** A stage as this service needs it — `label` is for humans and not carried. */
export interface StageRef {
  id: string;
  name: string;
  lifecycle: JobLifecycle;
}

export interface StageTransition {
  jobId: string;
  /** Null when the job had no stage at all — rows predating the stage split. */
  from: StageRef | null;
  to: StageRef;
}

export interface EmitStageChangeArgs {
  tenantId: string;
  actorUserId: string | null;
  transitions: StageTransition[];
  /** True for the bulk path, so "notify me per job" can opt out of a hundred
   *  emails from one drag. */
  bulk: boolean;
}

/**
 * Emit `job.stage_changed` for every transition, plus `job.completed` or
 * `job.cancelled` where the lifecycle actually crossed into one.
 *
 * The transition check matters: moving between two stages that both map to
 * `completed` — "Done" to "Invoiced", say — is not a second completion, and an
 * automation that emails the customer on completion must not fire twice
 * because someone tidied their board.
 */
export async function emitStageChangeEvents(
  db: Db,
  args: EmitStageChangeArgs,
): Promise<void> {
  const { tenantId, actorUserId, transitions, bulk } = args;
  if (transitions.length === 0) return;

  const jobIds = transitions.map((t) => t.jobId);

  // Read the jobs *after* the update, so the payload carries what the row now
  // says rather than what it said when the request arrived. Tenant-scoped:
  // every read in this repo is, and an event is not an exception.
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
      completedAt: jobs.completedAt,
      customerId: customers.id,
      customerFirstName: customers.firstName,
      customerLastName: customers.lastName,
      customerEmail: customers.email,
      customerPhone: customers.phone,
    })
    .from(jobs)
    .innerJoin(
      customers,
      and(eq(jobs.customerId, customers.id), eq(customers.tenantId, tenantId)),
    )
    .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.id, jobIds)));

  const byId = new Map(rows.map((r) => [r.id, r]));

  // Whether each job has line items — one grouped query rather than one per
  // job. Only consumed by `job.completed`, but a single query for the batch is
  // cheaper than branching on which jobs will need it.
  const completing = transitions.filter(
    (t) => t.to.lifecycle === "completed" && t.from?.lifecycle !== "completed",
  );
  const lineItemCounts = new Map<string, number>();
  if (completing.length > 0) {
    const counts = await db
      .select({ jobId: jobLineItems.jobId, n: count() })
      .from(jobLineItems)
      .where(
        and(
          eq(jobLineItems.tenantId, tenantId),
          inArray(
            jobLineItems.jobId,
            completing.map((t) => t.jobId),
          ),
        ),
      )
      .groupBy(jobLineItems.jobId);
    for (const row of counts) lineItemCounts.set(row.jobId, Number(row.n));
  }

  for (const transition of transitions) {
    const row = byId.get(transition.jobId);
    // A job that vanished between the update and this read is not an error
    // worth failing the request over — it cannot be enrolled either way.
    if (!row) continue;

    const customer: CustomerArgs = {
      id: row.customerId,
      firstName: row.customerFirstName,
      lastName: row.customerLastName,
      email: row.customerEmail,
      phone: row.customerPhone,
    };
    const job = {
      id: row.id,
      jobNumber: row.jobNumber ?? "",
      title: row.title,
      serviceType: row.serviceType,
      priority: row.priority,
      pipelineId: row.pipelineId,
      assigneeId: row.assigneeId,
      totalAmount: row.totalAmount,
      scheduledDate: row.scheduledDate,
    };

    await jobStageChanged(db, {
      tenantId,
      actorUserId,
      job,
      customer,
      from: transition.from,
      to: transition.to,
      bulk,
    });

    if (transition.to.lifecycle === "completed" && transition.from?.lifecycle !== "completed") {
      await jobCompleted(db, {
        tenantId,
        actorUserId,
        job,
        customer,
        stage: transition.to,
        // `stageUpdate()` set this in the same statement, so it is present.
        // Falling back to now keeps the payload valid for a row written before
        // the stage split rather than throwing on history.
        completedAt: row.completedAt ?? new Date(),
        hasLineItems: (lineItemCounts.get(row.id) ?? 0) > 0,
      });
    }

    if (transition.to.lifecycle === "cancelled" && transition.from?.lifecycle !== "cancelled") {
      await jobCancelled(db, {
        tenantId,
        actorUserId,
        job,
        customer,
        fromStageName: transition.from?.name ?? null,
        cancelledAt: new Date(),
      });
    }
  }
}
