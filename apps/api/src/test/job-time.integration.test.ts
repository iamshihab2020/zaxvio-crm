import { describe, expect, it } from "vitest";
import {
  jobs,
  jobTimeEntries,
  tenantMemberRates,
  tenants,
  and,
  eq,
} from "@hvac-saas/database";

import { requireDatabase } from "./setup.js";
import { withRollback, expectViolation, type TestDb } from "./db.js";
import { createWorkspace, createMember, foreignId } from "./factories/index.js";
import {
  startTimer,
  stopTimer,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getRunningTimer,
  stopTimersForJob,
  recalculateJobHours,
} from "../services/jobs/time.service.js";
import { getJobCostSummary } from "../services/costing/index.js";

/**
 * Job time tracking.
 *
 * The assertions that matter are the ones that could not be argued from reading
 * the code: that the **partial unique index** really refuses a second running
 * timer while still permitting a new one after a stop; that the **fourth
 * lateral does not fan out** against line items and expenses; and that an entry
 * with no rate contributes hours but **no cost**, which is the rule the whole
 * costing feature rests on.
 */

requireDatabase();

const HOUR = 3_600_000;

/** A closed entry, `hours` long, ending `endedAgoMs` ago. */
async function logEntry(
  db: TestDb,
  args: {
    tenantId: string;
    jobId: string;
    userId: string;
    hours: number;
    rate: string | null;
    endedAgoMs?: number;
  },
) {
  const endedAt = new Date(Date.now() - (args.endedAgoMs ?? HOUR));
  const startedAt = new Date(endedAt.getTime() - args.hours * HOUR);
  const [row] = await db
    .insert(jobTimeEntries)
    .values({
      tenantId: args.tenantId,
      jobId: args.jobId,
      userId: args.userId,
      startedAt,
      endedAt,
      hourlyCostRate: args.rate,
    })
    .returning();
  return row;
}

describe("the running-timer constraint", () => {
  it("refuses a second running timer for the same person, in the database", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(),
      });

      // 23505 on the PARTIAL unique index. An application check would race with
      // itself; this is the thing that actually makes it impossible.
      await expectViolation(db, "23505", (savepoint) =>
        savepoint.insert(jobTimeEntries).values({
          tenantId: ws.tenantId,
          jobId: ws.jobId,
          userId: ws.ownerUserId,
          startedAt: new Date(),
        }),
      );
    });
  });

  it("permits a new timer once the previous one has stopped — which is why the index is partial", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(Date.now() - 2 * HOUR),
        endedAt: new Date(Date.now() - HOUR),
      });

      const started = await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });
      expect(started.ok).toBe(true);
    });
  });

  it("lets two different people run timers on the same job at once", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(),
      });
      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: mate.userId,
        startedAt: new Date(),
      });

      const rows = await db
        .select()
        .from(jobTimeEntries)
        .where(eq(jobTimeEntries.jobId, ws.jobId));
      expect(rows).toHaveLength(2);
    });
  });

  it("refuses an entry that ends before it starts", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await expectViolation(db, "23514", (savepoint) =>
        savepoint.insert(jobTimeEntries).values({
          tenantId: ws.tenantId,
          jobId: ws.jobId,
          userId: ws.ownerUserId,
          startedAt: new Date(),
          endedAt: new Date(Date.now() - HOUR),
        }),
      );
    });
  });
});

describe("start and stop", () => {
  it("refuses to start when the caller is already clocked in elsewhere, and names the job", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });

      const again = await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });
      expect(again.ok).toBe(false);
      if (!again.ok) {
        expect(again.status).toBe(409);
        expect(again.message).toMatch(/already running on this job/i);
      }
    });
  });

  it("snapshots the member's rate at start, so a later raise leaves the entry alone", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await db.insert(tenantMemberRates).values({
        tenantId: ws.tenantId,
        userId: ws.ownerUserId,
        hourlyCostRate: "45.00",
      });

      const started = await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });
      expect(started.ok).toBe(true);

      await db
        .update(tenantMemberRates)
        .set({ hourlyCostRate: "90.00" })
        .where(eq(tenantMemberRates.tenantId, ws.tenantId));

      const [row] = await db
        .select()
        .from(jobTimeEntries)
        .where(eq(jobTimeEntries.jobId, ws.jobId));
      expect(row.hourlyCostRate).toBe("45.00");
    });
  });

  it("leaves the rate null when nobody has set one — never 0, which would read as free labour", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await db
        .update(tenants)
        .set({ defaultLaborCostRate: null })
        .where(eq(tenants.id, ws.tenantId));

      await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });

      const [row] = await db
        .select()
        .from(jobTimeEntries)
        .where(eq(jobTimeEntries.jobId, ws.jobId));
      expect(row.hourlyCostRate).toBeNull();
    });
  });

  it("stopping writes the hours onto the job's cache", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(Date.now() - 2 * HOUR),
      });

      const stopped = await stopTimer(db, {
        tenantId: ws.tenantId,
        userId: ws.ownerUserId,
      });
      expect(stopped.ok).toBe(true);

      const [job] = await db
        .select({ hours: jobs.actualHours })
        .from(jobs)
        .where(eq(jobs.id, ws.jobId));
      expect(Number(job.hours)).toBeCloseTo(2, 1);
    });
  });

  it("reports 404 rather than throwing when no timer is running", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const stopped = await stopTimer(db, {
        tenantId: ws.tenantId,
        userId: ws.ownerUserId,
      });
      expect(stopped.ok).toBe(false);
      if (!stopped.ok) expect(stopped.status).toBe(404);
    });
  });

  it("getRunningTimer is scoped to the user and returns null for everyone else", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      await startTimer(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
      });

      expect(await getRunningTimer(db, ws.tenantId, ws.ownerUserId)).not.toBeNull();
      expect(await getRunningTimer(db, ws.tenantId, mate.userId)).toBeNull();
    });
  });
});

describe("manual entries", () => {
  it("refuses a member logging time for somebody else", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      const result = await createTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        actorId: mate.userId,
        canManageOthers: false,
        userId: ws.ownerUserId,
        startedAt: new Date(Date.now() - 2 * HOUR).toISOString(),
        endedAt: new Date(Date.now() - HOUR).toISOString(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(403);
    });
  });

  it("refuses an entry longer than the ceiling the sweep enforces", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const result = await createTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        actorId: ws.ownerUserId,
        canManageOthers: true,
        startedAt: new Date(Date.now() - 20 * HOUR).toISOString(),
        endedAt: new Date().toISOString(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/cannot be longer than/i);
    });
  });

  it("refuses an entry that ends in the future", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const result = await createTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        actorId: ws.ownerUserId,
        canManageOthers: true,
        startedAt: new Date().toISOString(),
        endedAt: new Date(Date.now() + 4 * HOUR).toISOString(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toMatch(/future/i);
    });
  });

  it("editing an auto-stopped entry clears the flag — the edit is the review it asked for", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const entry = await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 12,
        rate: "50.00",
      });
      await db
        .update(jobTimeEntries)
        .set({ autoStopped: true })
        .where(eq(jobTimeEntries.id, entry.id));

      const result = await updateTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        entryId: entry.id,
        actorId: ws.ownerUserId,
        canManageOthers: true,
        endedAt: new Date(entry.startedAt.getTime() + 3 * HOUR).toISOString(),
      });
      expect(result.ok).toBe(true);

      const [row] = await db
        .select()
        .from(jobTimeEntries)
        .where(eq(jobTimeEntries.id, entry.id));
      expect(row.autoStopped).toBe(false);
    });
  });

  it("deleting the last entry returns the job's hours to null, not 0", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const entry = await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 3,
        rate: "50.00",
      });
      await recalculateJobHours(db, ws.tenantId, ws.jobId);

      await deleteTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        entryId: entry.id,
        actorId: ws.ownerUserId,
        canManageOthers: true,
      });

      const [job] = await db
        .select({ hours: jobs.actualHours })
        .from(jobs)
        .where(eq(jobs.id, ws.jobId));
      // Null is the absence of a claim; 0 asserts the job took no time, and
      // coverage reports the two differently.
      expect(job.hours).toBeNull();
    });
  });

  it("will not touch an entry belonging to another job, even with a real entry id", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const entry = await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 1,
        rate: "50.00",
      });

      const result = await deleteTimeEntry(db, {
        tenantId: ws.tenantId,
        jobId: foreignId(),
        entryId: entry.id,
        actorId: ws.ownerUserId,
        canManageOthers: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe(404);
    });
  });
});

describe("costing reads time entries", () => {
  it("costs two people at their own rates, which the single-rate column could not express", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 2,
        rate: "50.00",
      });
      await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: mate.userId,
        hours: 3,
        rate: "30.00",
      });

      const summary = await getJobCostSummary(db, ws.tenantId, ws.jobId);
      expect(summary).not.toBeNull();
      // 2 × 50 + 3 × 30 = 190, never 5 × one rate.
      expect(Number(summary!.laborCost)).toBeCloseTo(190, 2);
      expect(Number(summary!.actualHours)).toBeCloseTo(5, 2);
      expect(summary!.timeEntryCount).toBe(2);
      expect(summary!.coverage.laborCosted).toBe(true);
    });
  });

  it("an entry with no rate adds hours and no cost, and keeps the margin provisional", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 2,
        rate: "50.00",
      });
      await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 4,
        rate: null,
      });

      const summary = await getJobCostSummary(db, ws.tenantId, ws.jobId);
      expect(Number(summary!.laborCost)).toBeCloseTo(100, 2);
      expect(Number(summary!.actualHours)).toBeCloseTo(6, 2);
      expect(summary!.coverage.laborCosted).toBe(false);
      expect(summary!.coverage.complete).toBe(false);
      expect(summary!.coverage.gaps.join(" ")).toMatch(/no cost rate/i);
    });
  });

  it("a running timer contributes nothing until it stops", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(Date.now() - 5 * HOUR),
        hourlyCostRate: "50.00",
      });

      const summary = await getJobCostSummary(db, ws.tenantId, ws.jobId);
      expect(summary!.actualHours).toBeNull();
      expect(Number(summary!.laborCost)).toBe(0);
      expect(summary!.coverage.gaps.join(" ")).toMatch(/no hours recorded/i);
    });
  });

  it("does not fan out: entries are counted once against line items and expenses", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);

      // Three entries alongside whatever the job already carries. A plain join
      // rather than a lateral would multiply these against the other sets — the
      // silent way a costing figure comes out plausible and wrong.
      for (let i = 0; i < 3; i += 1) {
        await logEntry(db, {
          tenantId: ws.tenantId,
          jobId: ws.jobId,
          userId: ws.ownerUserId,
          hours: 1,
          rate: "10.00",
          endedAgoMs: (i + 1) * 2 * HOUR,
        });
      }

      const summary = await getJobCostSummary(db, ws.tenantId, ws.jobId);
      expect(summary!.timeEntryCount).toBe(3);
      expect(Number(summary!.actualHours)).toBeCloseTo(3, 2);
      expect(Number(summary!.laborCost)).toBeCloseTo(30, 2);
    });
  });

  it("an auto-stopped entry still counts its hours but keeps the figure provisional", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const entry = await logEntry(db, {
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        hours: 12,
        rate: "50.00",
      });
      await db
        .update(jobTimeEntries)
        .set({ autoStopped: true })
        .where(eq(jobTimeEntries.id, entry.id));

      const summary = await getJobCostSummary(db, ws.tenantId, ws.jobId);
      expect(Number(summary!.laborCost)).toBeCloseTo(600, 2);
      expect(summary!.coverage.autoStoppedTimeEntries).toBe(1);
      expect(summary!.coverage.complete).toBe(false);
      expect(summary!.coverage.gaps.join(" ")).toMatch(/stopped automatically/i);
    });
  });

  it("never reads another tenant's entries", async () => {
    await withRollback(async (db) => {
      const mine = await createWorkspace(db);
      const theirs = await createWorkspace(db);

      await logEntry(db, {
        tenantId: theirs.tenantId,
        jobId: theirs.jobId,
        userId: theirs.ownerUserId,
        hours: 8,
        rate: "99.00",
      });

      const summary = await getJobCostSummary(db, mine.tenantId, mine.jobId);
      expect(summary!.timeEntryCount).toBe(0);
      expect(Number(summary!.laborCost)).toBe(0);
    });
  });
});

describe("completion stops the clock", () => {
  it("stopTimersForJob closes every running timer on the job and refreshes the cache", async () => {
    await withRollback(async (db) => {
      const ws = await createWorkspace(db);
      const mate = await createMember(db, ws);

      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: ws.ownerUserId,
        startedAt: new Date(Date.now() - HOUR),
        hourlyCostRate: "40.00",
      });
      await db.insert(jobTimeEntries).values({
        tenantId: ws.tenantId,
        jobId: ws.jobId,
        userId: mate.userId,
        startedAt: new Date(Date.now() - HOUR),
        hourlyCostRate: "40.00",
      });

      const stopped = await stopTimersForJob(db, ws.tenantId, ws.jobId);
      expect(stopped).toBe(2);

      // Both people can now start a timer again — which is the real failure the
      // stop prevents: the partial unique index would otherwise refuse every
      // subsequent Start for the rest of the day.
      expect(await getRunningTimer(db, ws.tenantId, ws.ownerUserId)).toBeNull();
      expect(await getRunningTimer(db, ws.tenantId, mate.userId)).toBeNull();

      const [job] = await db
        .select({ hours: jobs.actualHours })
        .from(jobs)
        .where(and(eq(jobs.tenantId, ws.tenantId), eq(jobs.id, ws.jobId)));
      expect(Number(job.hours)).toBeCloseTo(2, 1);
    });
  });
});
