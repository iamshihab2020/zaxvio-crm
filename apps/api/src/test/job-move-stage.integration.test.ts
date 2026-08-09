import { describe, expect, it } from "vitest";
import { jobs, jobActivities, workflowEventQueue, and, eq } from "@hvac-saas/database";

import { requireDatabase } from "./setup.js";
import { withRollback, type TestDb } from "./db.js";
import { createWorkspace, foreignId } from "./factories/index.js";
import { moveJobStage } from "../services/jobs/jobs.service.js";
import { runWithCausation } from "../services/workflow/events/causation.js";

/**
 * `moveJobStage` — the one definition of what happens when a job moves.
 *
 * The tests that matter here are the ones that would have failed before the
 * extraction, when the `job.moveStage` executor did the `UPDATE` itself: an
 * automation moved a job and raised **no event**, so it could not trigger
 * another automation; wrote **no activity row**, so the job's own timeline
 * showed nothing; and walked past the **required-checklist gate** a person
 * cannot walk past.
 *
 * `dispatchNotification` fires on its own handle by design, so inside
 * `withRollback` it tries to write against a tenant that no longer exists and
 * logs a foreign-key error. That noise is the correct behaviour of a
 * fire-and-forget dispatcher meeting a rolled-back fixture — nothing is left
 * behind, because the insert is what fails.
 */

requireDatabase();

const WORKFLOW_ACTOR = {
  kind: "workflow" as const,
  workflowId: foreignId(),
  workflowName: "Chase the job",
  executionId: foreignId(),
};

async function stageChangedRows(db: TestDb, tenantId: string) {
  return db
    .select({
      eventType: workflowEventQueue.eventType,
      depth: workflowEventQueue.causationDepth,
    })
    .from(workflowEventQueue)
    .where(
      and(
        eq(workflowEventQueue.tenantId, tenantId),
        eq(workflowEventQueue.eventType, "job.stage_changed"),
      ),
    );
}

describe("moveJobStage", () => {
  it("raises job.stage_changed for an automation, which is what makes automations chainable", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: ws.pipeline.stages.in_progress,
        actor: WORKFLOW_ACTOR,
      });

      expect(result.ok).toBe(true);

      const rows = await stageChangedRows(db, ws.tenantId);
      // One per subscriber: workflow_trigger and goal_listener.
      expect(rows.length).toBeGreaterThan(0);

      const [job] = await db
        .select({ stageId: jobs.stageId, status: jobs.status })
        .from(jobs)
        .where(eq(jobs.id, ws.jobId));
      expect(job.stageId).toBe(ws.pipeline.stages.in_progress);
    });
  });

  it("writes an activity row naming the automation, with no person attributed to it", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: ws.pipeline.stages.in_progress,
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
          and(
            eq(jobActivities.jobId, ws.jobId),
            eq(jobActivities.type, "job.status_changed"),
          ),
        );

      expect(activity.description).toContain("Chase the job");
      // The pair `customer.addNote` already persists: a person or an automation,
      // never both and never neither.
      expect(activity.performedBy).toBeNull();
      expect((activity.metadata as Record<string, unknown>).executionId).toBe(
        WORKFLOW_ACTOR.executionId,
      );
    });
  });

  it("stamps events raised inside a run with the run's depth, without any producer knowing", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await runWithCausation(3, async () => {
        await moveJobStage(db, {
          tenantId: ws.tenantId,
          jobId: ws.jobId,
          stageId: ws.pipeline.stages.in_progress,
          actor: WORKFLOW_ACTOR,
        });
      });

      const rows = await stageChangedRows(db, ws.tenantId);
      expect(rows.length).toBeGreaterThan(0);
      // The whole point of the ambient store: `emitStageChangeEvents` and the
      // `job.stage_changed` producer were not touched to make this true.
      expect(rows.every((r) => r.depth === 3)).toBe(true);
    });
  });

  it("is depth 0 outside a run — a person pressing a button starts a fresh chain", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: ws.pipeline.stages.in_progress,
        actor: WORKFLOW_ACTOR,
      });

      const rows = await stageChangedRows(db, ws.tenantId);
      expect(rows.every((r) => r.depth === 0)).toBe(true);
    });
  });

  it("distinguishes its refusals, because each caller words them differently", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const sameStage = await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: ws.pipeline.stages.scheduled,
        actor: WORKFLOW_ACTOR,
      });
      expect(sameStage).toMatchObject({ ok: false, reason: "already_there" });

      const unknownStage = await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: foreignId(),
        actor: WORKFLOW_ACTOR,
      });
      expect(unknownStage).toMatchObject({ ok: false, reason: "no_such_stage" });

      const goneJob = await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: foreignId(),
        stageId: ws.pipeline.stages.in_progress,
        actor: WORKFLOW_ACTOR,
      });
      // The route turns exactly this one into a 404 and everything else into a
      // 400, which is only expressible because the reason is returned.
      expect(goneJob).toMatchObject({ ok: false, reason: "not_found" });
    });
  });

  it("refuses to complete a job from a scheduled stage, for an automation as for a person", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      const result = await moveJobStage(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        stageId: ws.pipeline.stages.completed,
        actor: WORKFLOW_ACTOR,
      });

      // scheduled -> completed is not in the transition table. The executor used
      // to check this itself; it now inherits it, which is the point.
      expect(result).toMatchObject({ ok: false, reason: "illegal_transition" });

      const rows = await stageChangedRows(db, ws.tenantId);
      expect(rows).toHaveLength(0);
    });
  });
});
