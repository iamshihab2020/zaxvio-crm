/**
 * Job time tracking.
 *
 * ## The one rule
 *
 * Every write in this module goes through a transaction that ends in
 * `recalculateJobHours`. `jobs.actual_hours` is a **cache**, not an input, and a
 * cache that can be written without its source changing is a stale number
 * waiting to happen — which is what the column was before this feature existed.
 *
 * ## Refusals are values, not throws
 *
 * Every function returns a discriminated result rather than throwing, for the
 * reason `moveJobStage` does: the route needs a status code and a sentence for a
 * person to read, and there is no vocabulary that serves both that and a caller
 * which merely wants to know whether the clock was already running.
 */

import {
  getDb,
  jobs,
  jobTimeEntries,
  jobActivities,
  user,
  and,
  eq,
  isNull,
  desc,
  sql,
} from "@hvac-saas/database";
import type { JobTimeEntryView, RunningTimer } from "@hvac-saas/types";
import { resolveLaborCostRate } from "../costing/index.js";
import { MAX_ENTRY_HOURS } from "../../lib/schemas/job-time.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export type TimeResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

const fail = (status: number, message: string): TimeResult<never> => ({
  ok: false,
  status,
  message,
});

/**
 * Recompute `jobs.actual_hours` from the job's closed entries.
 *
 * Mirrors `recalculateJobTotals` deliberately, down to the `Db` type: a Drizzle
 * transaction has every query method but no `$client`, so typing this as the
 * bare handle would make it **uncallable from inside a transaction** — and every
 * caller here is one. That mistake has now been made four times in this
 * codebase (`job-stages.service.ts`, `recalculateJobTotals`,
 * `availability.service.ts`), and each time it looked like a call-site problem.
 *
 * Null rather than 0 when the job has no closed entries. Zero hours is a claim
 * that the job took no time; null is the absence of a claim, and coverage
 * reports the two differently.
 */
export async function recalculateJobHours(
  db: Db,
  tenantId: string,
  jobId: string,
): Promise<void> {
  const [row] = await db
    .select({
      hours: sql<
        string | null
      >`ROUND(SUM(EXTRACT(EPOCH FROM (${jobTimeEntries.endedAt} - ${jobTimeEntries.startedAt}))) / 3600, 2)`,
    })
    .from(jobTimeEntries)
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.jobId, jobId),
        sql`${jobTimeEntries.endedAt} IS NOT NULL`,
      ),
    );

  await db
    .update(jobs)
    .set({ actualHours: row?.hours ?? null, updatedAt: new Date() })
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
}

/** Hours between two instants, to two decimals, as the wire string. */
function hoursBetween(startedAt: Date, endedAt: Date): string {
  const ms = endedAt.getTime() - startedAt.getTime();
  return (Math.round((ms / 3_600_000) * 100) / 100).toFixed(2);
}

/** `hours * rate` in cents, rounded once, back to the "0.00" wire shape. */
function entryCost(hours: string, rate: string | null): string | null {
  if (rate === null) return null;
  const cents = Math.round(Number(hours) * Number(rate) * 100);
  if (!Number.isFinite(cents)) return null;
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

type EntryRow = typeof jobTimeEntries.$inferSelect & {
  userName: string | null;
};

/**
 * Shape one row for the wire, withholding money from members.
 *
 * `undefined` rather than `null` for a withheld rate, and the distinction is
 * load-bearing: `null` already means "nobody has set a rate for this person",
 * which is a real state the UI prompts about. Collapsing the two would tell a
 * member their workspace is misconfigured every time they looked at their own
 * timesheet.
 */
function toView(row: EntryRow, includeMoney: boolean): JobTimeEntryView {
  const hours = row.endedAt ? hoursBetween(row.startedAt, row.endedAt) : null;
  return {
    id: row.id,
    jobId: row.jobId,
    userId: row.userId,
    userName: row.userName,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    hours,
    ...(includeMoney && {
      hourlyCostRate: row.hourlyCostRate,
      cost: hours ? entryCost(hours, row.hourlyCostRate) : null,
    }),
    note: row.note,
    autoStopped: row.autoStopped,
    createdAt: row.createdAt.toISOString(),
  };
}

async function selectEntries(db: Db, tenantId: string, jobId: string) {
  return db
    .select({
      id: jobTimeEntries.id,
      tenantId: jobTimeEntries.tenantId,
      jobId: jobTimeEntries.jobId,
      userId: jobTimeEntries.userId,
      startedAt: jobTimeEntries.startedAt,
      endedAt: jobTimeEntries.endedAt,
      hourlyCostRate: jobTimeEntries.hourlyCostRate,
      note: jobTimeEntries.note,
      autoStopped: jobTimeEntries.autoStopped,
      createdBy: jobTimeEntries.createdBy,
      createdAt: jobTimeEntries.createdAt,
      updatedAt: jobTimeEntries.updatedAt,
      userName: user.name,
    })
    .from(jobTimeEntries)
    .leftJoin(user, eq(user.id, jobTimeEntries.userId))
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.jobId, jobId),
      ),
    )
    .orderBy(desc(jobTimeEntries.startedAt));
}

export async function listTimeEntries(
  db: Db,
  tenantId: string,
  jobId: string,
  includeMoney: boolean,
): Promise<JobTimeEntryView[]> {
  const rows = await selectEntries(db, tenantId, jobId);
  return rows.map((r) => toView(r, includeMoney));
}

/**
 * The current user's running timer, with enough of the job to name it.
 *
 * This is what the shell bar spends. It is scoped to one user and one tenant
 * because the partial unique index guarantees at most one row — so the endpoint
 * returns an object or null, never a list that the caller has to reason about.
 */
export async function getRunningTimer(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<RunningTimer | null> {
  const [row] = await db
    .select({
      id: jobTimeEntries.id,
      jobId: jobTimeEntries.jobId,
      startedAt: jobTimeEntries.startedAt,
      jobNumber: jobs.jobNumber,
      jobTitle: jobs.title,
    })
    .from(jobTimeEntries)
    .innerJoin(jobs, eq(jobs.id, jobTimeEntries.jobId))
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.userId, userId),
        isNull(jobTimeEntries.endedAt),
      ),
    );

  if (!row) return null;
  return {
    id: row.id,
    jobId: row.jobId,
    jobNumber: row.jobNumber,
    jobTitle: row.jobTitle,
    startedAt: row.startedAt.toISOString(),
  };
}

/**
 * Start the clock on a job.
 *
 * The rate is snapshotted **now**, at the moment the row is created, which is
 * the same rule every other snapshot in this codebase follows. Resolved for the
 * person doing the work rather than the job's assignee: with entries, "who
 * worked it" is a fact per row instead of a guess per job.
 */
export async function startTimer(
  db: Db,
  params: {
    tenantId: string;
    jobId: string;
    userId: string;
    note?: string;
  },
): Promise<TimeResult<JobTimeEntryView>> {
  const { tenantId, jobId, userId, note } = params;

  const existing = await getRunningTimer(db, tenantId, userId);
  if (existing) {
    // Checked here so the caller gets a sentence naming the other job rather
    // than a 23505. The index is still what makes it true — this check races,
    // the index does not, and the route surfaces whichever one fires.
    return fail(
      409,
      existing.jobId === jobId
        ? "Your timer is already running on this job"
        : `You are already clocked in on job ${existing.jobNumber}`,
    );
  }

  const rate = await resolveLaborCostRate(db, tenantId, userId);

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(jobTimeEntries)
      .values({
        tenantId,
        jobId,
        userId,
        startedAt: new Date(),
        hourlyCostRate: rate,
        note: note ?? null,
        createdBy: userId,
      })
      .returning();

    await tx.insert(jobActivities).values({
      tenantId,
      jobId,
      type: "time.started",
      description: "Started a timer",
      metadata: { entryId: entry.id },
      performedBy: userId,
    });

    // No recalculate: a running entry contributes nothing to hours until it
    // stops, and calling it here would write the same value back for no reason.
    const [withName] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId));

    return {
      ok: true as const,
      data: toView({ ...entry, userName: withName?.name ?? null }, true),
    };
  });
}

/** Stop the current user's running timer, wherever it is running. */
export async function stopTimer(
  db: Db,
  params: { tenantId: string; userId: string; note?: string },
): Promise<TimeResult<JobTimeEntryView>> {
  const { tenantId, userId, note } = params;

  return db.transaction(async (tx) => {
    const endedAt = new Date();

    // The predicate is the claim: only a row that is still running can be
    // stopped, so two tabs pressing Stop cannot produce two different end times.
    // The loser gets zero rows back and is told the timer was not running, which
    // is true by the time it asked.
    const [entry] = await tx
      .update(jobTimeEntries)
      .set({
        endedAt,
        ...(note !== undefined && { note }),
        updatedAt: endedAt,
      })
      .where(
        and(
          eq(jobTimeEntries.tenantId, tenantId),
          eq(jobTimeEntries.userId, userId),
          isNull(jobTimeEntries.endedAt),
        ),
      )
      .returning();

    if (!entry) return fail(404, "No timer is running");

    const hours = hoursBetween(entry.startedAt, endedAt);

    await tx.insert(jobActivities).values({
      tenantId,
      jobId: entry.jobId,
      type: "time.stopped",
      description: `Logged ${hours} hours`,
      metadata: { entryId: entry.id, hours },
      performedBy: userId,
    });

    await recalculateJobHours(tx, tenantId, entry.jobId);

    const [withName] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, userId));

    return {
      ok: true as const,
      data: toView({ ...entry, userName: withName?.name ?? null }, true),
    };
  });
}

/**
 * Validate a start/end pair.
 *
 * The future check uses a small tolerance rather than a strict comparison,
 * because the browser supplies these and a device clock that is four seconds
 * fast would otherwise refuse an entry somebody just finished.
 */
function validateWindow(
  startedAt: Date,
  endedAt: Date,
): { message: string } | null {
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
    return { message: "Invalid start or end time" };
  }
  if (endedAt <= startedAt) {
    return { message: "The end time must be after the start time" };
  }
  if (endedAt.getTime() > Date.now() + 60_000) {
    return { message: "An entry cannot end in the future" };
  }
  const hours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000;
  if (hours > MAX_ENTRY_HOURS) {
    return {
      message: `A single entry cannot be longer than ${MAX_ENTRY_HOURS} hours. Split it into separate entries.`,
    };
  }
  return null;
}

export async function createTimeEntry(
  db: Db,
  params: {
    tenantId: string;
    jobId: string;
    actorId: string;
    canManageOthers: boolean;
    startedAt: string;
    endedAt: string;
    userId?: string;
    note?: string;
    hourlyCostRate?: string | null;
  },
): Promise<TimeResult<JobTimeEntryView>> {
  const { tenantId, jobId, actorId, canManageOthers } = params;

  // A member logging time for somebody else would be writing into that person's
  // timesheet, which is payroll data. Silently reassigning it to themselves
  // would be worse — the entry would look right and cost the wrong rate.
  const subjectId = params.userId ?? actorId;
  if (subjectId !== actorId && !canManageOthers) {
    return fail(403, "Only an owner or admin can log time for someone else");
  }

  const startedAt = new Date(params.startedAt);
  const endedAt = new Date(params.endedAt);
  const invalid = validateWindow(startedAt, endedAt);
  if (invalid) return fail(400, invalid.message);

  const rate =
    canManageOthers && params.hourlyCostRate !== undefined
      ? params.hourlyCostRate
      : await resolveLaborCostRate(db, tenantId, subjectId);

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .insert(jobTimeEntries)
      .values({
        tenantId,
        jobId,
        userId: subjectId,
        startedAt,
        endedAt,
        hourlyCostRate: rate,
        note: params.note ?? null,
        createdBy: actorId,
      })
      .returning();

    await tx.insert(jobActivities).values({
      tenantId,
      jobId,
      type: "time.logged",
      description: `Logged ${hoursBetween(startedAt, endedAt)} hours`,
      metadata: { entryId: entry.id },
      performedBy: actorId,
    });

    await recalculateJobHours(tx, tenantId, jobId);

    const [withName] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, subjectId));

    return {
      ok: true as const,
      data: toView({ ...entry, userName: withName?.name ?? null }, true),
    };
  });
}

export async function updateTimeEntry(
  db: Db,
  params: {
    tenantId: string;
    jobId: string;
    entryId: string;
    actorId: string;
    canManageOthers: boolean;
    startedAt?: string;
    endedAt?: string;
    note?: string | null;
    hourlyCostRate?: string | null;
  },
): Promise<TimeResult<JobTimeEntryView>> {
  const { tenantId, jobId, entryId, actorId, canManageOthers } = params;

  // tenantId AND jobId AND id — never the record id alone (security-rules §1).
  const [existing] = await db
    .select()
    .from(jobTimeEntries)
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.jobId, jobId),
        eq(jobTimeEntries.id, entryId),
      ),
    );

  if (!existing) return fail(404, "Time entry not found");
  if (existing.userId !== actorId && !canManageOthers) {
    return fail(403, "You can only edit your own time entries");
  }
  if (!existing.endedAt) {
    return fail(400, "Stop the timer before editing this entry");
  }

  const startedAt =
    params.startedAt !== undefined
      ? new Date(params.startedAt)
      : existing.startedAt;
  const endedAt =
    params.endedAt !== undefined ? new Date(params.endedAt) : existing.endedAt;

  const invalid = validateWindow(startedAt, endedAt);
  if (invalid) return fail(400, invalid.message);

  return db.transaction(async (tx) => {
    const [entry] = await tx
      .update(jobTimeEntries)
      .set({
        startedAt,
        endedAt,
        ...(params.note !== undefined && { note: params.note }),
        ...(canManageOthers &&
          params.hourlyCostRate !== undefined && {
            hourlyCostRate: params.hourlyCostRate,
          }),
        // Editing an auto-stopped entry is exactly the review the flag exists to
        // ask for, so clearing it here is the point: once a person has set the
        // end time, the number is theirs and coverage stops calling it doubtful.
        autoStopped: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(jobTimeEntries.tenantId, tenantId),
          eq(jobTimeEntries.jobId, jobId),
          eq(jobTimeEntries.id, entryId),
        ),
      )
      .returning();

    // The row was there a statement ago; if it is not now, another request
    // deleted it. Reporting 404 is truer than crashing on a missing field.
    if (!entry) return fail(404, "Time entry not found");

    await recalculateJobHours(tx, tenantId, jobId);

    const [withName] = await tx
      .select({ name: user.name })
      .from(user)
      .where(eq(user.id, entry.userId));

    return {
      ok: true as const,
      data: toView({ ...entry, userName: withName?.name ?? null }, true),
    };
  });
}

export async function deleteTimeEntry(
  db: Db,
  params: {
    tenantId: string;
    jobId: string;
    entryId: string;
    actorId: string;
    canManageOthers: boolean;
  },
): Promise<TimeResult<{ id: string }>> {
  const { tenantId, jobId, entryId, actorId, canManageOthers } = params;

  const [existing] = await db
    .select()
    .from(jobTimeEntries)
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.jobId, jobId),
        eq(jobTimeEntries.id, entryId),
      ),
    );

  if (!existing) return fail(404, "Time entry not found");
  if (existing.userId !== actorId && !canManageOthers) {
    return fail(403, "You can only delete your own time entries");
  }

  return db.transaction(async (tx) => {
    await tx
      .delete(jobTimeEntries)
      .where(
        and(
          eq(jobTimeEntries.tenantId, tenantId),
          eq(jobTimeEntries.jobId, jobId),
          eq(jobTimeEntries.id, entryId),
        ),
      );

    await tx.insert(jobActivities).values({
      tenantId,
      jobId,
      type: "time.deleted",
      description: "Removed a time entry",
      metadata: { entryId },
      performedBy: actorId,
    });

    await recalculateJobHours(tx, tenantId, jobId);
    return { ok: true as const, data: { id: entryId } };
  });
}

/**
 * Stop any timer still running on a job, whoever it belongs to.
 *
 * Called by the completion path. Takes the caller's transaction, so a job that
 * fails to complete does not leave its crew clocked out — the whole point of
 * `moveJobStage` running in one transaction.
 */
export async function stopTimersForJob(
  db: Db,
  tenantId: string,
  jobId: string,
): Promise<number> {
  const endedAt = new Date();
  const stopped = await db
    .update(jobTimeEntries)
    .set({ endedAt, updatedAt: endedAt })
    .where(
      and(
        eq(jobTimeEntries.tenantId, tenantId),
        eq(jobTimeEntries.jobId, jobId),
        isNull(jobTimeEntries.endedAt),
      ),
    )
    .returning({ id: jobTimeEntries.id });

  if (stopped.length > 0) {
    await recalculateJobHours(db, tenantId, jobId);
  }
  return stopped.length;
}
