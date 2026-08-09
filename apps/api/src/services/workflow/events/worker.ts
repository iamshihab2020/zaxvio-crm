/**
 * The outbox worker.
 *
 * Claims queued events, hands each to its subscriber, and retries with backoff
 * until the attempts run out. Everything about it is shaped by one constraint:
 * **an event must be processed at least once and, as far as anything
 * observable, exactly once.**
 *
 * ## Why the claim is a single statement
 *
 * `SELECT` then `UPDATE` is a race. READ COMMITTED lets two transactions read
 * the same rows before either commits, so two workers pick the same event and
 * the customer gets two emails. `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP
 * LOCKED) RETURNING *` is one statement: the rows are locked as they are
 * selected, and a second worker skips straight past them. The same pattern the
 * email crons already use, verified there by execution (INV-30).
 *
 * ## Why rows come back to `pending` rather than being retried in place
 *
 * A worker that retried inside its own tick would hold the tick open for the
 * length of the backoff. Writing `next_retry_at` and releasing the row means
 * the retry is just another claim, so a restart in the middle loses nothing and
 * a permanently failing event cannot block the ones behind it.
 *
 * ## What it deliberately does not do
 *
 * It does not process inline on enqueue failure, and it does not fall back to
 * an in-memory queue. Losing an event to a database blip is recoverable — the
 * row is either there or the transaction rolled back. An email sent from a
 * transaction that then rolled back is not.
 */

import {
  getDb,
  workflowEventQueue,
  and,
  eq,
  inArray,
  lte,
  sql,
} from "@hvac-saas/database";
import {
  QUEUE_SETTINGS,
  backoffMs,
  safeParseEventPayload,
  type EventSubscriber,
} from "@hvac-saas/workflow-nodes";
import { onWorkerNudge } from "./bus.js";

/**
 * `Omit<…, "$client">` so a transaction handle satisfies it.
 *
 * Not an accommodation for tests — though it is what lets the integration suite
 * exercise the real claim query inside a rolled-back transaction. The same
 * shape lets a future caller drain the queue inside a transaction it already
 * holds, which is how "run this automation now, synchronously" will work.
 */
type Db = Omit<ReturnType<typeof getDb>, "$client">;

/** One claimed row, as the worker sees it. */
export interface ClaimedEvent {
  id: string;
  tenantId: string;
  eventType: string;
  payload: unknown;
  subjectType: string | null;
  subjectId: string | null;
  actorUserId: string | null;
  subscriber: string;
  attempts: number;
  maxAttempts: number;
  correlationId: string;
  /** How many automations deep the chain that raised this event is. */
  causationDepth: number;
}

/**
 * What a subscriber must implement.
 *
 * Returning normally means done. Throwing means retry — so a handler that
 * cannot ever succeed (a workflow that no longer exists, a subject that was
 * deleted) must **return**, not throw, or it will burn five attempts to reach
 * the same conclusion.
 */
export type SubscriberHandler = (event: ClaimedEvent) => Promise<void>;

const handlers = new Map<EventSubscriber, SubscriberHandler>();

/**
 * Registered rather than imported, so this file does not depend on the engine.
 *
 * P2 ships the pipeline with no handlers: rows are claimed, parsed and
 * completed. That is deliberate — the transport is verifiable on its own, and
 * an unregistered subscriber is a no-op rather than a crash, so instrumenting
 * producers before the engine exists cannot break a request.
 */
export function registerSubscriber(
  subscriber: EventSubscriber,
  handler: SubscriberHandler,
): void {
  handlers.set(subscriber, handler);
}

export function clearSubscribers(): void {
  handlers.clear();
}

// ── Claiming ─────────────────────────────────────────────────────────────────

/**
 * Claim up to `limit` eligible rows.
 *
 * Eligible means pending **and** due: either it has never been tried
 * (`next_retry_at IS NULL`) and its `scheduled_at` has arrived, or its backoff
 * has elapsed. Ordered by `scheduled_at` so a burst is drained oldest-first and
 * one tenant's backlog cannot starve another's newest event indefinitely.
 */
export async function claimEvents(db: Db, limit: number): Promise<ClaimedEvent[]> {
  // `clock_timestamp()`, deliberately, not `now()`.
  //
  // `now()` is the **transaction** start time. A producer stamps `scheduled_at`
  // from the application clock, which is necessarily later than the start of
  // whatever transaction it is running in — so any claim sharing a transaction
  // with the emit compares a real timestamp against a frozen one and finds the
  // row "not due yet". Harmless for the deployed worker, whose transactions are
  // one statement long, and fatal for anything that drains the queue inside a
  // transaction it already holds: the synchronous "run this now" path, and every
  // integration test in this suite. `clock_timestamp()` reads the wall clock at
  // each evaluation, which is what "is this row due" actually means.
  const rows = await db.execute<{
    id: string;
    tenant_id: string;
    event_type: string;
    payload: unknown;
    subject_type: string | null;
    subject_id: string | null;
    actor_user_id: string | null;
    subscriber: string;
    attempts: number;
    max_attempts: number;
    correlation_id: string;
    causation_depth: number;
  }>(sql`
    UPDATE workflow_event_queue
       SET status = 'processing',
           claimed_at = clock_timestamp(),
           attempts = attempts + 1
     WHERE id IN (
       SELECT id
         FROM workflow_event_queue
        WHERE status = 'pending'
          AND scheduled_at <= clock_timestamp()
          AND (next_retry_at IS NULL OR next_retry_at <= clock_timestamp())
        ORDER BY scheduled_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
     )
    RETURNING id, tenant_id, event_type, payload, subject_type, subject_id,
              actor_user_id, subscriber, attempts, max_attempts, correlation_id,
              causation_depth
  `);

  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    eventType: r.event_type,
    payload: r.payload,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    actorUserId: r.actor_user_id,
    subscriber: r.subscriber,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    correlationId: r.correlation_id,
    causationDepth: r.causation_depth,
  }));
}

// ── Outcomes ─────────────────────────────────────────────────────────────────

async function markCompleted(db: Db, id: string): Promise<void> {
  await db
    .update(workflowEventQueue)
    .set({ status: "completed", processedAt: new Date(), lastError: null })
    .where(eq(workflowEventQueue.id, id));
}

/**
 * Release for retry, or dead-letter when the attempts are spent.
 *
 * `attempts` was already incremented by the claim, so the comparison is against
 * the count *including* the one that just failed — which is what makes
 * `maxAttempts: 5` mean five tries rather than six.
 */
async function markFailed(
  db: Db,
  event: ClaimedEvent,
  error: string,
): Promise<"retrying" | "dead-lettered"> {
  const truncated = error.slice(0, 2000);

  if (event.attempts >= event.maxAttempts) {
    await db
      .update(workflowEventQueue)
      .set({ status: "failed", processedAt: new Date(), lastError: truncated })
      .where(eq(workflowEventQueue.id, event.id));
    console.error(
      `[workflow-worker] dead-lettered ${event.eventType} (${event.subscriber}) ` +
        `after ${event.attempts} attempts: ${truncated}`,
      { queueId: event.id, correlationId: event.correlationId, tenantId: event.tenantId },
    );
    return "dead-lettered";
  }

  const delay = backoffMs(event.attempts);
  await db
    .update(workflowEventQueue)
    .set({
      status: "pending",
      claimedAt: null,
      nextRetryAt: new Date(Date.now() + delay),
      lastError: truncated,
    })
    .where(eq(workflowEventQueue.id, event.id));
  return "retrying";
}

/**
 * A payload that no longer parses is dead on arrival, not retryable.
 *
 * Retrying it would burn five attempts and eight minutes to reach the same
 * answer. It means a deploy changed a payload shape while rows were queued —
 * the one thing the second parse exists to catch — so it is logged loudly and
 * dead-lettered immediately.
 */
async function markUnprocessable(db: Db, event: ClaimedEvent, error: string): Promise<void> {
  await db
    .update(workflowEventQueue)
    .set({
      status: "failed",
      processedAt: new Date(),
      lastError: `unprocessable: ${error}`.slice(0, 2000),
    })
    .where(eq(workflowEventQueue.id, event.id));
  console.error(
    `[workflow-worker] UNPROCESSABLE ${event.eventType} (${event.subscriber}): ${error}. ` +
      `A producer's payload shape no longer matches its schema — this is a deploy ` +
      `problem, not a transient failure.`,
    { queueId: event.id, correlationId: event.correlationId },
  );
}

// ── Processing ───────────────────────────────────────────────────────────────

export interface TickResult {
  claimed: number;
  completed: number;
  retrying: number;
  deadLettered: number;
  unprocessable: number;
}

const EMPTY_TICK: TickResult = {
  claimed: 0,
  completed: 0,
  retrying: 0,
  deadLettered: 0,
  unprocessable: 0,
};

/**
 * One pass: claim a batch and process it.
 *
 * Events are processed **sequentially**. One instance, one database, and the
 * handlers write — concurrency here would buy latency on a queue that is
 * normally empty and cost predictability when it is not. The batch size is the
 * throughput knob.
 */
export async function tick(db: Db = getDb()): Promise<TickResult> {
  const events = await claimEvents(db, QUEUE_SETTINGS.CLAIM_BATCH_SIZE);
  if (events.length === 0) return EMPTY_TICK;

  const result: TickResult = { ...EMPTY_TICK, claimed: events.length };

  for (const event of events) {
    // Parse #2 of 2 — see `emit.ts` for #1. This is the one that catches drift
    // between what was written and what is being read.
    const parsed = safeParseEventPayload(event.eventType, event.payload);
    if (!parsed.ok) {
      await markUnprocessable(db, event, parsed.error);
      result.unprocessable += 1;
      continue;
    }

    const handler = handlers.get(event.subscriber as EventSubscriber);
    if (!handler) {
      // Not an error. P2 ships before the engine, and a subscriber with no
      // handler has genuinely nothing to do — completing is honest, and
      // retrying would fill the dead-letter queue with rows describing a
      // feature that has not been built yet.
      await markCompleted(db, event.id);
      result.completed += 1;
      continue;
    }

    try {
      await handler({ ...event, payload: parsed.data });
      await markCompleted(db, event.id);
      result.completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const outcome = await markFailed(db, event, message);
      if (outcome === "retrying") result.retrying += 1;
      else result.deadLettered += 1;
    }
  }

  return result;
}

/**
 * Return rows abandoned mid-flight to `pending`.
 *
 * A process that dies between the claim and the outcome leaves its rows in
 * `processing` forever — the failure mode a queue built on a status column
 * always has, and the reason "just add a status column" is not a queue on its
 * own.
 *
 * `attempts` is **not** decremented: the attempt did happen, and a crash that
 * repeats deterministically must still exhaust its retries rather than loop.
 */
export async function recoverStaleEvents(db: Db = getDb()): Promise<number> {
  const cutoff = new Date(Date.now() - QUEUE_SETTINGS.STALE_PROCESSING_MS);
  const rows = await db
    .update(workflowEventQueue)
    .set({ status: "pending", claimedAt: null })
    .where(
      and(
        eq(workflowEventQueue.status, "processing"),
        lte(workflowEventQueue.claimedAt, cutoff),
      ),
    )
    .returning({ id: workflowEventQueue.id });

  if (rows.length > 0) {
    console.warn(
      `[workflow-worker] recovered ${rows.length} event(s) abandoned in 'processing' — ` +
        `a worker died mid-flight or a tick exceeded ${QUEUE_SETTINGS.STALE_PROCESSING_MS}ms`,
    );
  }
  return rows.length;
}

/** Cancel queued rows for workflows that no longer exist. Nothing went wrong. */
export async function cancelEvents(db: Db, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db
    .update(workflowEventQueue)
    .set({ status: "cancelled", processedAt: new Date() })
    .where(
      and(
        inArray(workflowEventQueue.id, ids),
        eq(workflowEventQueue.status, "pending"),
      ),
    )
    .returning({ id: workflowEventQueue.id });
  return rows.length;
}

// ── The loop ─────────────────────────────────────────────────────────────────

let running = false;
let stopped = false;
let pollTimer: NodeJS.Timeout | null = null;
let recoveryTimer: NodeJS.Timeout | null = null;
let unsubscribeNudge: (() => void) | null = null;

/**
 * Drain until a tick claims nothing.
 *
 * A single tick would leave a burst of 200 events waiting a full poll interval
 * per batch. The `running` guard is what keeps a nudge storm — twenty writes in
 * one request — from starting twenty overlapping drains.
 */
async function drain(): Promise<void> {
  if (running || stopped) return;
  running = true;
  try {
    for (let i = 0; i < QUEUE_SETTINGS.MAX_BATCHES_PER_DRAIN; i++) {
      const result = await tick();
      if (result.claimed === 0) break;
    }
  } catch (err) {
    // Never rethrow out of a timer callback: an unhandled rejection here takes
    // the API process down, which is the same class of defect the analytics
    // cache's background revalidate had (DASH-01).
    console.error("[workflow-worker] tick failed:", err);
  } finally {
    running = false;
  }
}

export function startEventWorker(): void {
  if (pollTimer) return;
  stopped = false;

  pollTimer = setInterval(() => void drain(), QUEUE_SETTINGS.POLL_INTERVAL_MS);
  recoveryTimer = setInterval(() => {
    recoverStaleEvents().catch((err) =>
      console.error("[workflow-worker] stale recovery failed:", err),
    );
  }, QUEUE_SETTINGS.RECOVERY_INTERVAL_MS);

  // The poll is the floor; this is what makes the common case sub-second.
  unsubscribeNudge = onWorkerNudge(() => void drain());

  // `unref` so these timers never hold the process open during shutdown. The
  // rows are durable — anything mid-flight comes back through stale recovery.
  pollTimer.unref?.();
  recoveryTimer.unref?.();

  console.info(
    `[workflow-worker] started — poll ${QUEUE_SETTINGS.POLL_INTERVAL_MS}ms, ` +
      `batch ${QUEUE_SETTINGS.CLAIM_BATCH_SIZE}, stale recovery every ` +
      `${QUEUE_SETTINGS.RECOVERY_INTERVAL_MS}ms`,
  );
}

export function stopEventWorker(): void {
  stopped = true;
  if (pollTimer) clearInterval(pollTimer);
  if (recoveryTimer) clearInterval(recoveryTimer);
  pollTimer = null;
  recoveryTimer = null;
  unsubscribeNudge?.();
  unsubscribeNudge = null;
}
