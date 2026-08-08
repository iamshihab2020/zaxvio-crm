/**
 * The sweep worker — the clock behind time-based triggers.
 *
 * Most workflow events are raised by the write that causes them. A few are not:
 * an invoice going overdue, a contract coming up for renewal, a warranty
 * expiring. Nothing *happens* in those cases — a date simply passes — so
 * something has to look.
 *
 * Hourly rather than daily, because the node promises "checked hourly, so it
 * fires shortly after the due date passes rather than exactly at midnight", and
 * because tenants are in different timezones: a single daily tick fires at the
 * wrong local hour for everyone except the zone it was scheduled in. The
 * per-tenant-day dedup key is what makes an hourly tick safe — 24 ticks produce
 * one event.
 *
 * That safety is deliberately in the **database**, not here. A flag saying "done
 * today" held in this module would not survive a restart, would be wrong on a
 * second instance, and would silently double-send on a deploy — which for this
 * feature means a customer receiving two chase emails.
 */

import { getDb } from "@hvac-saas/database";
import { sweepOverdueInvoices } from "../sweeps/invoice-overdue.js";

/** Hourly. See above for why not daily. */
const TICK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * How long after boot the first tick runs.
 *
 * Not zero: a request served during startup should not race a background sweep,
 * which is the same reasoning `server.ts` already applies to the email crons.
 */
const FIRST_TICK_DELAY_MS = 60 * 1000;

let tickTimer: NodeJS.Timeout | null = null;
let firstTimer: NodeJS.Timeout | null = null;
/** One tick at a time. A slow sweep must not overlap the next. */
let running = false;

/**
 * Run every sweep once.
 *
 * Exported so a test can drive a tick without waiting on a timer, and so a
 * future admin endpoint can nudge it.
 */
export async function runSweepTick(): Promise<void> {
  const db = getDb();

  // Sequential, and each guarded on its own. Sweeps are independent, and one
  // throwing must not cancel the others — `Promise.all` would do exactly that.
  try {
    const result = await sweepOverdueInvoices(db);
    if (result.emitted > 0) {
      console.log(
        `[workflow] invoice.overdue: ${result.emitted} raised, ${result.deduped} already raised today`,
      );
    }
  } catch (error) {
    console.error("[workflow] invoice.overdue sweep failed", error);
  }
}

export function startSweepWorker(): void {
  if (tickTimer) return;

  firstTimer = setTimeout(() => {
    void tick();
    tickTimer = setInterval(() => void tick(), TICK_INTERVAL_MS);
    tickTimer.unref?.();
  }, FIRST_TICK_DELAY_MS);
  firstTimer.unref?.();

  console.log(
    `[workflow] Sweep worker started (every ${TICK_INTERVAL_MS / 60000} min)`,
  );
}

function tick(): Promise<void> {
  if (running) return Promise.resolve();
  running = true;
  return runSweepTick()
    .catch((error) => console.error("[workflow] Sweep tick failed", error))
    .finally(() => {
      running = false;
    });
}

export function stopSweepWorker(): void {
  if (firstTimer) {
    clearTimeout(firstTimer);
    firstTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
