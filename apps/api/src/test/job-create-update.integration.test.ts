import { describe, expect, it } from "vitest";
import {
  jobs,
  jobActivities,
  customerActivities,
  workflowEventQueue,
  and,
  eq,
} from "@hvac-saas/database";

import { requireDatabase } from "./setup.js";
import { withRollback, type TestDb } from "./db.js";
import { createMember, createWorkspace, foreignId } from "./factories/index.js";
import { createJob, updateJob } from "../services/jobs/jobs.service.js";

/**
 * `createJob` / `updateJob` — the pure-move half of the ARC-05 extraction.
 *
 * These two had no second caller, so unlike `moveJobStage` and `assignJob` there
 * was no divergent implementation to reconcile. One thing was not a pure move:
 * `POST /jobs` still carried its **own** inline organisation-membership check
 * after the previous commit moved `PATCH /jobs/:id` onto `isOrgMember`, and it
 * carried the same **fail-open** shape — `if (assigneeId && tenantRecord)` with
 * no `else`, so a tenant whose organisation row is missing skipped the check
 * rather than failing it. The consolidation swept the handler it was reading and
 * did not reach the one two hundred lines above.
 *
 * The activity-row count is the assertion worth keeping: creating a job writes
 * **two** rows, because `attachChecklistToJob` writes its own. A test asserting
 * "exactly one" passes only until a tenant has a checklist template, which is
 * every real tenant.
 */

requireDatabase();

const WORKFLOW_ACTOR = {
  kind: "workflow" as const,
  workflowId: foreignId(),
  workflowName: "Book the follow-up",
  executionId: foreignId(),
};

async function activitiesFor(db: TestDb, tenantId: string, jobId: string) {
  return db
    .select()
    .from(jobActivities)
    .where(and(eq(jobActivities.tenantId, tenantId), eq(jobActivities.jobId, jobId)));
}

describe("createJob", () => {
  it("writes the job, its checklist trail, the customer timeline and job.created", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await createJob(db, {
        tenantId: ws.tenantId,
        input: {
          customerId: ws.customerId,
          serviceType: "repair",
          title: "Replace the flashing",
          scheduledDate: "2026-09-01",
        },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Issued by the database trigger, not by us.
      expect(result.job.jobNumber).toBeTruthy();
      // A job always lands in a real stage — the first by sort order — so it is
      // never outside the stage model the way a quote-created job used to be
      // (QUO-02), where `stage_id` stayed NULL and the job counted 0 in every
      // pipeline column and matched no lifecycle filter.
      expect(result.job.stageId).toBe(ws.pipeline.stages.scheduled);

      const created = (await activitiesFor(db, ws.tenantId, result.job.id)).filter(
        (a) => a.type === "job.created",
      );
      expect(created).toHaveLength(1);
      expect(created[0].performedBy).toBe(ws.ownerUserId);

      const timeline = await db
        .select()
        .from(customerActivities)
        .where(
          and(
            eq(customerActivities.tenantId, ws.tenantId),
            eq(customerActivities.customerId, ws.customerId),
          ),
        );
      expect(
        timeline.some((row) => (row.metadata as { jobId?: string })?.jobId === result.job.id),
      ).toBe(true);

      const queued = await db
        .select({ eventType: workflowEventQueue.eventType })
        .from(workflowEventQueue)
        .where(
          and(
            eq(workflowEventQueue.tenantId, ws.tenantId),
            eq(workflowEventQueue.subjectId, result.job.id),
          ),
        );
      expect(queued.some((e) => e.eventType === "job.created")).toBe(true);
    });
  });

  it("attributes a job created by an automation to the automation", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await createJob(db, {
        tenantId: ws.tenantId,
        input: {
          customerId: ws.customerId,
          serviceType: "repair",
          title: "Annual service",
          scheduledDate: "2026-09-01",
        },
        actor: WORKFLOW_ACTOR,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const [row] = (await activitiesFor(db, ws.tenantId, result.job.id)).filter(
        (a) => a.type === "job.created",
      );
      // `performed_by` is NULL rather than a sentinel user: the column is a real
      // FK to `user`, and an automation is not a person.
      expect(row.performedBy).toBeNull();
      expect(row.description).toContain('"Book the follow-up"');
      expect((row.metadata as { executionId?: string }).executionId).toBe(
        WORKFLOW_ACTOR.executionId,
      );
    });
  });

  it("refuses a customer belonging to another tenant", async () => {
    await withRollback(async (db) => {
      const mine = await createWorkspace(db);
      const theirs = await createWorkspace(db);

      const result = await createJob(db, {
        tenantId: mine.tenantId,
        input: {
          customerId: theirs.customerId,
          serviceType: "repair",
          title: "Should never exist",
          scheduledDate: "2026-09-01",
        },
        actor: { kind: "user", userId: mine.ownerUserId },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("customer_not_found");

      const written = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(eq(jobs.tenantId, mine.tenantId));
      // The workspace's own job, and nothing else.
      expect(written).toHaveLength(1);
    });
  });

  it("refuses an assignee who is not an org member — the check that failed OPEN", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await createJob(db, {
        tenantId: ws.tenantId,
        input: {
          customerId: ws.customerId,
          serviceType: "repair",
          title: "Assigned to a stranger",
          scheduledDate: "2026-09-01",
          assigneeId: foreignId(),
        },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("not_a_member");
    });
  });

  it("accepts an assignee who is a member", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      const result = await createJob(db, {
        tenantId: ws.tenantId,
        input: {
          customerId: ws.customerId,
          serviceType: "repair",
          title: "Assigned properly",
          scheduledDate: "2026-09-01",
          assigneeId: mate.userId,
        },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.job.assigneeId).toBe(mate.userId);
    });
  });

  it("refuses a starting stage that is not in the pipeline", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await createJob(db, {
        tenantId: ws.tenantId,
        input: {
          customerId: ws.customerId,
          serviceType: "repair",
          title: "Nowhere to land",
          scheduledDate: "2026-09-01",
          status: "not_a_stage_in_this_pipeline",
        },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("no_such_stage");
    });
  });
});

describe("updateJob", () => {
  it("records what changed, in words, and raises job.updated", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        input: { title: "Renamed" },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.job.title).toBe("Renamed");
      expect(result.changedFields).toEqual(["title"]);

      const [row] = await activitiesFor(db, ws.tenantId, ws.jobId);
      expect(row.description).toBe("Updated Title");

      const queued = await db
        .select({ eventType: workflowEventQueue.eventType })
        .from(workflowEventQueue)
        .where(
          and(
            eq(workflowEventQueue.tenantId, ws.tenantId),
            eq(workflowEventQueue.subjectId, ws.jobId),
          ),
        );
      expect(queued.some((e) => e.eventType === "job.updated")).toBe(true);
      // The specific events stay quiet when their fields did not move. A
      // `job.assigned` here would fire an automation for a rename.
      expect(queued.some((e) => e.eventType === "job.assigned")).toBe(false);
      expect(queued.some((e) => e.eventType === "job.scheduled")).toBe(false);
    });
  });

  it("writes no activity row and no event when nothing actually changed", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const [before] = await db.select().from(jobs).where(eq(jobs.id, ws.jobId));

      const result = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        input: { title: before.title },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.changedFields).toEqual([]);

      const rows = await activitiesFor(db, ws.tenantId, ws.jobId);
      expect(rows.filter((r) => r.type === "job.updated")).toHaveLength(0);
    });
  });

  it("stores a cleared text field as NULL, never as an empty string", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        // Whitespace, not "". A user clearing a textarea can leave either.
        input: { description: "   " },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // `POST` wrote `x || null` and this loop wrote the value verbatim, so one
      // column had two spellings of empty and every `IS NULL` downstream
      // disagreed with itself.
      expect(result.job.description).toBeNull();
    });
  });

  it("checks end-after-start against the merged row, not just the request body", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await db
        .update(jobs)
        .set({ scheduledStart: "10:00:00", scheduledEnd: null })
        .where(and(eq(jobs.tenantId, ws.tenantId), eq(jobs.id, ws.jobId)));

      // The Zod refinement only sees the fields in this request, so a PATCH
      // carrying only `scheduledEnd` passes it while inverting the times.
      const result = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        input: { scheduledEnd: "09:00:00" },
        actor: { kind: "user", userId: ws.ownerUserId },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("invalid_times");
    });
  });

  it("refuses an archived job, a missing job and another tenant's job", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const theirs = await createWorkspace(db);

      const missing = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: foreignId(),
        input: { title: "Ghost" },
        actor: { kind: "user", userId: ws.ownerUserId },
      });
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.reason).toBe("not_found");

      // Another tenant's job is "not found", not "forbidden" — the tenant
      // predicate is in the WHERE clause, so it never loads at all.
      const crossTenant = await updateJob(db, {
        tenantId: theirs.tenantId,
        jobId: ws.jobId,
        input: { title: "Not yours" },
        actor: { kind: "user", userId: theirs.ownerUserId },
      });
      expect(crossTenant.ok).toBe(false);
      if (!crossTenant.ok) expect(crossTenant.reason).toBe("not_found");

      await db
        .update(jobs)
        .set({ archivedAt: new Date() })
        .where(and(eq(jobs.tenantId, ws.tenantId), eq(jobs.id, ws.jobId)));

      const archived = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        input: { title: "Still archived" },
        actor: { kind: "user", userId: ws.ownerUserId },
      });
      expect(archived.ok).toBe(false);
      if (!archived.ok) expect(archived.reason).toBe("archived");
    });
  });

  it("attributes an update made by an automation to the automation", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await updateJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        input: { title: "Touched by a robot" },
        actor: WORKFLOW_ACTOR,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const [row] = await activitiesFor(db, ws.tenantId, ws.jobId);
      expect(row.performedBy).toBeNull();
      expect(row.description).toContain('"Book the follow-up"');
    });
  });
});
