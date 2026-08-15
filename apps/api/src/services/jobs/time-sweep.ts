/**
 * Close timers nobody stopped.
 *
 * ## The failure this exists for
 *
 * Somebody clocks in, finishes the job, and drives home with the clock running.
 * Left alone that entry does three things, each worse than the last: it runs up
 * an absurd duration that will later be summed into a real cost figure; it makes
 * the person's *next* timer impossible, because the partial unique index permits
 * one running row per user, so every subsequent Start silently refuses; and the
 * job's hours stay null the whole time, because cost queries only count closed
 * entries.
 *
 * ## Why it truncates rather than deletes or guesses
 *
 * The entry is capped at the ceiling and marked `auto_stopped`. Three options
 * were available and only one is honest:
 *
 *   - **Delete it** — destroys a real record of somebody's work.
 *   - **Trust it** — bills twelve hours of overnight to a job's margin.
 *   - **Cap and flag** — keeps the hours that are probably real, and tells the
 *     coverage rule that this figure has not been confirmed by a person.
 *
 * The third matches the rule the whole costing feature rests on: an uncertain
 * cost makes the total *provisional*, never silently lower or silently higher.
 * Editing the entry clears the flag, because setting the end time by hand is
 * exactly the review the flag was asking for.
 *
 * ## Every instance may run this
 *
 * The `UPDATE … WHERE ended_at IS NULL … RETURNING` claims its rows in one
 * statement, so two instances sweeping at the same moment split the work instead
 * of duplicating it — the same shape INV-30 established for the email crons.
 */

import { getDb, jobTimeEntries, sql, and, isNull } from "@hvac-saas/database";
import { MAX_ENTRY_HOURS } from "../../lib/schemas/job-time.js";
import { recalculateJobHours } from "./time.service.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface TimeSweepResult {
  stopped: number;
  jobsRecalculated: number;
}

export async function sweepRunningTimers(
  db: Db = getDb(),
): Promise<TimeSweepResult> {
  // `started_at + interval` rather than comparing against a value computed in
  // Node: the ceiling is a property of the row, and letting Postgres apply it
  // keeps the comparison and the write in one statement, which is what makes the
  // claim atomic.
  //
  // `::int` on the bound parameter is load-bearing. A parameter arrives with no
  // type, and Postgres has more than one `? * interval` operator to choose from,
  // so it raises rather than guessing. Same reason the overdue sweep casts its
  // day count — there, `date - integer` and `date - date` were both candidates.
  const stopped = await db
    .update(jobTimeEntries)
    .set({
      endedAt: sql`${jobTimeEntries.startedAt} + (${MAX_ENTRY_HOURS}::int * INTERVAL '1 hour')`,
      autoStopped: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        isNull(jobTimeEntries.endedAt),
        sql`${jobTimeEntries.startedAt} < now() - (${MAX_ENTRY_HOURS}::int * INTERVAL '1 hour')`,
      ),
    )
    .returning({
      id: jobTimeEntries.id,
      tenantId: jobTimeEntries.tenantId,
      jobId: jobTimeEntries.jobId,
    });

  // One recalculation per affected job, not per entry: two techs both leaving a
  // timer on the same job is one cache to refresh, and doing it twice would
  // write the same value back for no reason.
  const affected = new Map<string, string>();
  for (const row of stopped) affected.set(row.jobId, row.tenantId);

  for (const [jobId, tenantId] of affected) {
    await recalculateJobHours(db, tenantId, jobId);
  }

  if (stopped.length > 0) {
    console.info(
      `[time-sweep] Auto-stopped ${stopped.length} timer(s) across ${affected.size} job(s)`,
    );
  }

  return { stopped: stopped.length, jobsRecalculated: affected.size };
}
