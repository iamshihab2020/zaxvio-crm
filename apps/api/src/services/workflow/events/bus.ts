/**
 * The in-process nudge.
 *
 * The worker polls every 5 seconds. That poll is the floor and the recovery
 * path, not the latency budget: at 5 seconds a booking confirmation averages
 * 2.5 seconds of doing nothing, and "the email took 8 seconds" is a product
 * quality signal a customer notices.
 *
 * So `emitWorkflowEvent` fires this after its transaction commits and the
 * worker wakes immediately. Sub-second in the common case, with the poll still
 * underneath it.
 *
 * **Known constraint, written down rather than discovered later:** a second API
 * instance would not see the nudge, because this is an in-process EventEmitter
 * and not a queue. The poll covers that — it is why the poll exists at all. The
 * swap point is the same one ADR-001 records for the SSE bus, and it is one
 * file.
 */

import { EventEmitter } from "node:events";

const bus = new EventEmitter();

/** Deliberately generous: one listener per worker, and there is one worker. */
bus.setMaxListeners(20);

const NUDGE = "workflow:event-enqueued";

/**
 * Tell the worker something is waiting.
 *
 * Never throws and never awaits. A failed nudge must not fail the request that
 * caused it — the row is already committed, and the poll will find it within
 * five seconds. Losing latency is acceptable; losing the caller's transaction
 * because a listener threw is not.
 */
export function nudgeWorker(): void {
  try {
    bus.emit(NUDGE);
  } catch (err) {
    console.error("[workflow] nudge failed (the poll will still pick it up):", err);
  }
}

export function onWorkerNudge(listener: () => void): () => void {
  bus.on(NUDGE, listener);
  return () => bus.off(NUDGE, listener);
}
