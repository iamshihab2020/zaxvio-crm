/**
 * The schedule worker. P9.
 *
 * Two cadences, because the two jobs have different costs and different
 * tolerances:
 *
 * - **Every minute** — `tickSchedules`, the daily/weekly clock. It has to be
 *   minute-grained or "09:00" would mean "sometime this hour", and it is cheap:
 *   one indexed read of active workflows, and almost every tick decides
 *   "not due" without writing anything.
 * - **Every hour** — the calendar sweeps (warranties, agreements, visits). Each
 *   is a table scan, and none of them has an answer that changes within a day.
 *   Running them per minute would be sixty scans for one day's worth of news.
 *
 * ## Ticks never overlap
 *
 * A `running` flag rather than a lock. A sweep that takes longer than its
 * interval would otherwise start again on top of itself, and while the dedup
 * rows make that *safe* it makes it pointless — two scans competing for the
 * same rows to discover they are both already claimed.
 *
 * ## A failing tick logs and continues
 *
 * The interval is not cleared on error. A sweep that threw once — a transient
 * connection, a row that failed its parse — must not silently stop the clock
 * for every tenant until somebody restarts the process. That is the failure
 * mode the outbox worker was written to avoid and it applies identically here.
 */

import { getDb } from "@hvac-saas/database";
import { tickSchedules } from "../sweeps/clock.js";
import { sweepAllSchedules } from "../sweeps/schedule.js";

const CLOCK_INTERVAL_MS = 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

let clockTimer: NodeJS.Timeout | null = null;
let sweepTimer: NodeJS.Timeout | null = null;
let clockRunning = false;
let sweepRunning = false;

export function startScheduleWorker(): void {
  if (clockTimer || sweepTimer) return;

  clockTimer = setInterval(() => {
    void runClock();
  }, CLOCK_INTERVAL_MS);

  sweepTimer = setInterval(() => {
    void runSweeps();
  }, SWEEP_INTERVAL_MS);

  // `unref` so a pending timer never holds the process open during a shutdown.
  clockTimer.unref?.();
  sweepTimer.unref?.();

  console.log(
    `[workflow] Schedule worker started (clock every ${CLOCK_INTERVAL_MS / 1000}s, sweeps every ${SWEEP_INTERVAL_MS / 60000} min)`,
  );

  // One sweep shortly after boot rather than waiting a full hour. A deploy at
  // 08:55 must not push the day's warranty notices to 09:55.
  setTimeout(() => void runSweeps(), 30 * 1000).unref?.();
}

export function stopScheduleWorker(): void {
  if (clockTimer) clearInterval(clockTimer);
  if (sweepTimer) clearInterval(sweepTimer);
  clockTimer = null;
  sweepTimer = null;
}

async function runClock(): Promise<void> {
  if (clockRunning) return;
  clockRunning = true;
  try {
    const result = await tickSchedules(getDb());
    // Only when something happened. A line a minute saying "0 fired" is a log
    // nobody reads, which is the same as no log at all.
    if (result.fired > 0) {
      console.log(
        `[workflow] Schedules fired: ${result.fired} (considered ${result.considered}, already done ${result.deduped})`,
      );
    }
  } catch (err) {
    console.error("[workflow] Schedule clock tick failed", err);
  } finally {
    clockRunning = false;
  }
}

async function runSweeps(): Promise<void> {
  if (sweepRunning) return;
  sweepRunning = true;
  try {
    const results = await sweepAllSchedules(getDb());
    for (const result of results) {
      if (result.emitted > 0 || result.truncated) {
        console.log(
          `[workflow] Sweep ${result.kind}: ${result.emitted} raised, ${result.deduped} already done, ${result.scanned} scanned${result.truncated ? " (TRUNCATED — more remain for the next tick)" : ""}`,
        );
      }
    }
  } catch (err) {
    console.error("[workflow] Schedule sweep failed", err);
  } finally {
    sweepRunning = false;
  }
}
