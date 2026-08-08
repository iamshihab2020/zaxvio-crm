/**
 * The resume worker — what makes a pause durable.
 *
 * A `delay.wait` writes `resume_at` and stops. Nothing in memory is holding the
 * run: this ticks, finds the rows whose time has come, and picks them up. That
 * is what lets a three-day wait survive a deploy, a restart and a crash.
 *
 * It is deliberately dumb. Finding due rows and calling `resumeExecution` is
 * all it does — every decision about *how* a run continues lives in the engine,
 * so the worker cannot develop a second opinion about it.
 */

import {
  getDb,
  workflowExecutions,
  and,
  asc,
  eq,
  isNotNull,
  lte,
  sql,
} from "@hvac-saas/database";
import { RESUME_SETTINGS } from "@hvac-saas/workflow-nodes";
import { resumeExecution } from "../engine/resume.js";

let tickTimer: NodeJS.Timeout | null = null;
/** One tick at a time. A slow batch must not overlap the next. */
let running = false;

/**
 * Find and resume everything due.
 *
 * Exported so a test can drive one tick without waiting on a timer, and so a
 * future admin endpoint can nudge it.
 */
export async function runResumeTick(): Promise<number> {
  const db = getDb();

  // `clock_timestamp()`, not `now()`: `now()` is the *transaction* start time
  // and is fixed for its whole duration, so a long tick would keep comparing
  // against a stale clock and re-select rows it had already passed. The outbox
  // worker made this choice for the same reason.
  //
  // `resume_at IS NOT NULL` is load-bearing: a **goal wait** is also `waiting`
  // but has a null `resume_at`, and only a matching event may end one. Without
  // this predicate the clock would wake runs that are waiting on something
  // that has not happened.
  const due = await db
    .select({ id: workflowExecutions.id })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.status, "waiting"),
        isNotNull(workflowExecutions.resumeAt),
        lte(workflowExecutions.resumeAt, sql`clock_timestamp()`),
      ),
    )
    // Oldest first, so a backlog drains in the order it built up rather than
    // starving the runs that have been waiting longest.
    .orderBy(asc(workflowExecutions.resumeAt))
    .limit(RESUME_SETTINGS.CLAIM_BATCH_SIZE);

  if (due.length === 0) return 0;

  let resumed = 0;
  for (const row of due) {
    try {
      // Sequential, not `Promise.all`. Each resume runs a whole automation —
      // sending email, writing records — and ten of those at once is a burst
      // this has no reason to create. The claim is a compare-and-set, so
      // another instance racing us simply loses.
      const result = await resumeExecution(db, row.id);
      if (result.status === "resumed") resumed += 1;
    } catch (error) {
      // One bad run must never stop the batch, and must never kill the tick.
      // `resumeExecution` already settles what it can; this is the backstop for
      // what it could not.
      console.error(`[workflow] Resume failed for execution ${row.id}`, error);
    }
  }

  return resumed;
}

export function startResumeWorker(): void {
  if (tickTimer) return;

  tickTimer = setInterval(() => {
    if (running) return;
    running = true;
    void runResumeTick()
      .catch((error) => console.error("[workflow] Resume tick failed", error))
      .finally(() => {
        running = false;
      });
  }, RESUME_SETTINGS.TICK_INTERVAL_MS);

  // `unref` so the timer never holds the process open during shutdown — the
  // same reason the outbox worker does it. A pending resume is a database row,
  // so nothing is lost by exiting: the next boot picks it up.
  tickTimer.unref?.();

  console.log(
    `[workflow] Resume worker started (every ${RESUME_SETTINGS.TICK_INTERVAL_MS / 1000}s)`,
  );
}

export function stopResumeWorker(): void {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
}
