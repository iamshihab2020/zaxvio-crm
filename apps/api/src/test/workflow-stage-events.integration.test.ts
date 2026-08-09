import { describe, expect, it } from "vitest";
import { workflowEventQueue, eq, and } from "@hvac-saas/database";
import { parseEventPayload } from "@hvac-saas/workflow-nodes";

import { requireDatabase } from "./setup.js";
import { withRollback, type TestDb } from "./db.js";
import {
  createCustomer,
  createJob,
  createPipeline,
  createTenant,
} from "./factories/index.js";
import { emitStageChangeEvents } from "../services/jobs/stage-events.service.js";

/**
 * The stage-change producer, end to end against real rows.
 *
 * This is the event the whole feature leans on — "when a job is completed" is
 * the first automation any tenant will build — so the assertions here are about
 * the payload's *contents*, not just that a row appeared. A queue row with the
 * wrong stage id in it is worse than no queue row: it runs the wrong automation
 * and looks like it worked.
 */

requireDatabase();

async function queueRows(db: TestDb, tenantId: string, eventType: string) {
  return db
    .select()
    .from(workflowEventQueue)
    .where(
      and(
        eq(workflowEventQueue.tenantId, tenantId),
        eq(workflowEventQueue.eventType, eventType),
      ),
    );
}

describe("emitStageChangeEvents", () => {
  it("emits stage_changed with both sides of the move and the real lifecycles", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const pipeline = await createPipeline(db, tenant.tenantId);
      const job = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });

      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: tenant.ownerUserId,
        bulk: false,
        transitions: [
          {
            jobId: job.id,
            from: { id: pipeline.stages.scheduled, name: "scheduled", lifecycle: "scheduled" },
            to: {
              id: pipeline.stages.in_progress,
              name: "in_progress",
              lifecycle: "in_progress",
            },
          },
        ],
      });

      const rows = await queueRows(db, tenant.tenantId, "job.stage_changed");
      // One per subscriber.
      expect(rows).toHaveLength(2);

      const payload = parseEventPayload("job.stage_changed", rows[0].payload);
      expect(payload.jobId).toBe(job.id);
      expect(payload.jobNumber).toBe(job.jobNumber);
      expect(payload.fromStageId).toBe(pipeline.stages.scheduled);
      expect(payload.fromLifecycle).toBe("scheduled");
      expect(payload.toStageId).toBe(pipeline.stages.in_progress);
      expect(payload.toLifecycle).toBe("in_progress");
      expect(payload.bulk).toBe(false);

      // The customer travels with the event, so `{{customer.firstName}}`
      // resolves in the first node without a query.
      expect(payload.customerId).toBe(customer.id);
      expect(payload.customerEmail).toBe(customer.email);

      // And the subject is right, which is what enrollment keys on.
      expect(rows[0].subjectType).toBe("job");
      expect(rows[0].subjectId).toBe(job.id);
      expect(rows[0].actorUserId).toBe(tenant.ownerUserId);
    });
  });

  it("emits job.completed alongside the stage change, once", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const pipeline = await createPipeline(db, tenant.tenantId);
      const job = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });

      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: null,
        bulk: false,
        transitions: [
          {
            jobId: job.id,
            from: { id: pipeline.stages.scheduled, name: "scheduled", lifecycle: "scheduled" },
            to: { id: pipeline.stages.completed, name: "completed", lifecycle: "completed" },
          },
        ],
      });

      expect(await queueRows(db, tenant.tenantId, "job.stage_changed")).toHaveLength(2);
      const completed = await queueRows(db, tenant.tenantId, "job.completed");
      expect(completed).toHaveLength(2);

      const payload = parseEventPayload("job.completed", completed[0].payload);
      expect(payload.jobId).toBe(job.id);
      expect(payload.stageId).toBe(pipeline.stages.completed);
      // The factory creates no line items.
      expect(payload.hasLineItems).toBe(false);
    });
  });

  it("does NOT re-complete a job moving between two completed stages", async () => {
    // A tenant with "Done" and "Invoiced" both mapped to the completed
    // lifecycle must not email the customer twice because someone tidied the
    // board. The transition, not the destination, is what makes a completion.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const pipeline = await createPipeline(db, tenant.tenantId);
      const job = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });

      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: null,
        bulk: false,
        transitions: [
          {
            jobId: job.id,
            from: { id: pipeline.stages.completed, name: "completed", lifecycle: "completed" },
            // A second stage that also means "completed".
            to: { id: pipeline.stages.completed, name: "invoiced", lifecycle: "completed" },
          },
        ],
      });

      expect(await queueRows(db, tenant.tenantId, "job.stage_changed")).toHaveLength(2);
      expect(await queueRows(db, tenant.tenantId, "job.completed")).toHaveLength(0);
    });
  });

  it("emits job.cancelled on the way into a cancelled stage", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const pipeline = await createPipeline(db, tenant.tenantId);
      const job = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });

      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: null,
        bulk: false,
        transitions: [
          {
            jobId: job.id,
            from: { id: pipeline.stages.scheduled, name: "scheduled", lifecycle: "scheduled" },
            to: { id: pipeline.stages.cancelled, name: "cancelled", lifecycle: "cancelled" },
          },
        ],
      });

      const rows = await queueRows(db, tenant.tenantId, "job.cancelled");
      expect(rows).toHaveLength(2);
      const payload = parseEventPayload("job.cancelled", rows[0].payload);
      expect(payload.fromStageName).toBe("scheduled");
    });
  });

  it("marks bulk moves as bulk, for every job in the batch", async () => {
    // The single and bulk paths share this one implementation precisely so they
    // cannot diverge the way JOB-22 found them diverging over the completion
    // email. `bulk` is how an automation opts out of a hundred emails from one
    // drag, so it has to be true on every row, not just the first.
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      const customer = await createCustomer(db, tenant.tenantId);
      const pipeline = await createPipeline(db, tenant.tenantId);
      const jobA = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });
      const jobB = await createJob(db, {
        tenantId: tenant.tenantId,
        customerId: customer.id,
        pipeline,
      });

      const to = {
        id: pipeline.stages.completed,
        name: "completed",
        lifecycle: "completed" as const,
      };
      const from = {
        id: pipeline.stages.scheduled,
        name: "scheduled",
        lifecycle: "scheduled" as const,
      };

      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: null,
        bulk: true,
        transitions: [
          { jobId: jobA.id, from, to },
          { jobId: jobB.id, from, to },
        ],
      });

      const rows = await queueRows(db, tenant.tenantId, "job.stage_changed");
      // 2 jobs × 2 subscribers.
      expect(rows).toHaveLength(4);
      for (const row of rows) {
        expect(parseEventPayload("job.stage_changed", row.payload).bulk).toBe(true);
      }
      // Both jobs completed, so both produce the completion event too.
      expect(await queueRows(db, tenant.tenantId, "job.completed")).toHaveLength(4);
    });
  });

  it("emits nothing for an empty batch", async () => {
    await withRollback(async (db) => {
      const tenant = await createTenant(db);
      await emitStageChangeEvents(db, {
        tenantId: tenant.tenantId,
        actorUserId: null,
        bulk: true,
        transitions: [],
      });
      expect(await queueRows(db, tenant.tenantId, "job.stage_changed")).toHaveLength(0);
    });
  });

  it("skips a job from another tenant rather than leaking it", async () => {
    // The read is tenant-scoped on both the job and the customer join. An id
    // from elsewhere resolves to nothing, so no payload is built from another
    // tenant's customer name, email and phone.
    await withRollback(async (db) => {
      const mine = await createTenant(db);
      const theirs = await createTenant(db);
      const theirCustomer = await createCustomer(db, theirs.tenantId);
      const theirPipeline = await createPipeline(db, theirs.tenantId);
      const theirJob = await createJob(db, {
        tenantId: theirs.tenantId,
        customerId: theirCustomer.id,
        pipeline: theirPipeline,
      });

      await emitStageChangeEvents(db, {
        tenantId: mine.tenantId,
        actorUserId: null,
        bulk: false,
        transitions: [
          {
            jobId: theirJob.id,
            from: null,
            to: {
              id: theirPipeline.stages.completed,
              name: "completed",
              lifecycle: "completed",
            },
          },
        ],
      });

      expect(await queueRows(db, mine.tenantId, "job.stage_changed")).toHaveLength(0);
      expect(await queueRows(db, theirs.tenantId, "job.stage_changed")).toHaveLength(0);
    });
  });
});
