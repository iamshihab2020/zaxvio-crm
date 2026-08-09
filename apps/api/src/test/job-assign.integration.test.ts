import { describe, expect, it } from "vitest";
import { jobs, jobActivities, workflowEventQueue, and, eq } from "@hvac-saas/database";

import { requireDatabase } from "./setup.js";
import { withRollback, type TestDb } from "./db.js";
import { createMember, createTenant, createWorkspace, foreignId } from "./factories/index.js";
import { assignJob } from "../services/jobs/jobs.service.js";
import { isOrgMember } from "../lib/tenant-guards.js";
import { runWithCausation } from "../services/workflow/events/causation.js";

/**
 * `assignJob` — one definition of putting a job in somebody's name.
 *
 * The `job.assign` executor did the `UPDATE` and stopped, so an assignment made
 * by an automation raised no `job.assigned` **and** no `job.updated`, and left
 * no row on the job's timeline. `trigger.job.assigned` shipped as a node and
 * nothing an automation did could ever reach it.
 *
 * The cross-tenant case is the one with security weight: `assigneeId` is a
 * client-supplied foreign key sitting in a saved automation config, and there is
 * no row-level security underneath (D-16), so the application is the boundary.
 */

requireDatabase();

const WORKFLOW_ACTOR = {
  kind: "workflow" as const,
  workflowId: foreignId(),
  workflowName: "Route the work",
  executionId: foreignId(),
};

async function queuedTypes(db: TestDb, tenantId: string) {
  const rows = await db
    .select({
      eventType: workflowEventQueue.eventType,
      depth: workflowEventQueue.causationDepth,
    })
    .from(workflowEventQueue)
    .where(eq(workflowEventQueue.tenantId, tenantId));
  return rows;
}

describe("assignJob", () => {
  it("raises job.assigned AND job.updated, and leaves job.scheduled alone", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const tech = await createMember(db, ws);

      const result = await assignJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        assigneeId: tech.userId,
        actor: WORKFLOW_ACTOR,
      });
      expect(result.ok).toBe(true);

      const rows = await queuedTypes(db, ws.tenantId);
      const types = new Set(rows.map((r) => r.eventType));
      expect(types.has("job.assigned")).toBe(true);
      // Suppressing the catch-all when a specific event also fired would make
      // "any change to a job" quietly mean "any change except a reassignment".
      expect(types.has("job.updated")).toBe(true);
      // Nothing about timing moved, so the reschedule event must stay quiet —
      // "tell the customer their appointment moved" must not fire for this.
      expect(types.has("job.scheduled")).toBe(false);

      const [job] = await db
        .select({ assigneeId: jobs.assigneeId })
        .from(jobs)
        .where(eq(jobs.id, ws.jobId));
      expect(job.assigneeId).toBe(tech.userId);
    });
  });

  it("writes an activity row naming the automation, with nobody attributed", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const tech = await createMember(db, ws);

      await assignJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        assigneeId: tech.userId,
        actor: WORKFLOW_ACTOR,
      });

      const [activity] = await db
        .select({
          description: jobActivities.description,
          performedBy: jobActivities.performedBy,
          metadata: jobActivities.metadata,
        })
        .from(jobActivities)
        .where(
          and(eq(jobActivities.jobId, ws.jobId), eq(jobActivities.type, "job.updated")),
        );

      expect(activity.description).toContain("Route the work");
      expect(activity.performedBy).toBeNull();
      expect((activity.metadata as Record<string, unknown>).executionId).toBe(
        WORKFLOW_ACTOR.executionId,
      );
    });
  });

  it("refuses a user from another workspace — the application is the only boundary", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const other = await createTenant(db);
      const outsider = await createMember(db, other);

      const result = await assignJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        assigneeId: outsider.userId,
        actor: WORKFLOW_ACTOR,
      });

      expect(result).toMatchObject({ ok: false, reason: "not_a_member" });

      // Nothing written, and no event claiming it was.
      const [job] = await db
        .select({ assigneeId: jobs.assigneeId })
        .from(jobs)
        .where(eq(jobs.id, ws.jobId));
      expect(job.assigneeId).toBeNull();
      expect(await queuedTypes(db, ws.tenantId)).toHaveLength(0);
    });
  });

  it("refuses a no-op, so job.updated does not fire for a change that did not happen", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const tech = await createMember(db, ws);

      await assignJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        assigneeId: tech.userId,
        actor: WORKFLOW_ACTOR,
      });
      const before = await queuedTypes(db, ws.tenantId);

      const again = await assignJob(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        assigneeId: tech.userId,
        actor: WORKFLOW_ACTOR,
      });

      expect(again).toMatchObject({ ok: false, reason: "already_assigned" });
      expect(await queuedTypes(db, ws.tenantId)).toHaveLength(before.length);
    });
  });

  it("stamps its events with the depth of the run that caused them", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const tech = await createMember(db, ws);

      await runWithCausation(2, async () => {
        await assignJob(db, {
          tenantId: ws.tenantId,
          jobId: ws.jobId,
          assigneeId: tech.userId,
          actor: WORKFLOW_ACTOR,
        });
      });

      const rows = await queuedTypes(db, ws.tenantId);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.depth === 2)).toBe(true);
    });
  });
});

describe("isOrgMember", () => {
  it("is the one implementation the route, the service and the engine all use", async () => {
    await withRollback(async (db) => {
      const ws = await createTenant(db);
      const tech = await createMember(db, ws);
      const other = await createTenant(db);
      const outsider = await createMember(db, other);

      expect(await isOrgMember(db, ws.tenantId, tech.userId)).toBe(true);
      expect(await isOrgMember(db, ws.tenantId, outsider.userId)).toBe(false);
      // `user` has no tenant column, so this is two hops and a made-up id must
      // not resolve by accident.
      expect(await isOrgMember(db, ws.tenantId, foreignId())).toBe(false);
    });
  });
});
