/**
 * `emitWorkflowEvent` — the only way an event enters the system.
 *
 * ## The contract
 *
 * Call it with **the transaction that made the change**, not with `getDb()`.
 * The queue row and the row it describes then commit together or not at all,
 * which removes both halves of the classic failure: an email sent for work that
 * rolled back, and a committed change whose automation vanished because the
 * process died in the gap between commit and enqueue.
 *
 * ```ts
 * await db.transaction(async (tx) => {
 *   const [job] = await tx.update(jobs).set(...).returning();
 *   await emitWorkflowEvent(tx, { ... });   // ← same tx
 * });
 * ```
 *
 * ## What it refuses
 *
 * The payload is parsed against its schema **before** the insert. A producer
 * bug is a throw, in development and in production, because the alternative is
 * what the reference implementation shipped: an untyped payload that wrote one
 * spelling, a consumer that read another, and every affected automation
 * silently dead for months behind a passing test.
 *
 * Enqueue failure **degrades, it does not fall back**. If the insert throws,
 * the producer logs at error with the full event and lets the exception reach
 * the caller — inside a transaction, that correctly rolls the domain write back
 * too. What it must never do is process inline instead: at one instance that
 * turns a database blip into a customer email sent from a transaction that then
 * rolls back.
 */

import { randomUUID } from "node:crypto";
import {
  workflowEventQueue,
  type getDb,
} from "@hvac-saas/database";
import {
  EVENT_SUBSCRIBERS,
  requireEventDefinition,
  type EventPayloadFor,
  type EventSubscriber,
  type WorkflowEventType,
} from "@hvac-saas/workflow-nodes";
import type { SubjectType } from "@hvac-saas/workflow-nodes";
import { nudgeWorker } from "./bus.js";
import { currentCausationDepth } from "./causation.js";

/**
 * `Omit<…, "$client">` so a `PgTransaction` satisfies it. Every producer is
 * called from inside a transaction, so this is the *normal* case rather than an
 * accommodation — a bare `ReturnType<typeof getDb>` would make the correct
 * usage the one that fails to compile.
 */
export type EmitDb = Omit<ReturnType<typeof getDb>, "$client">;

export interface EmitEventArgs<T extends WorkflowEventType> {
  type: T;
  tenantId: string;
  /** Omitted for `schedule.*`. Asserted against the registry below. */
  subject?: { type: SubjectType; id: string } | null;
  /** Null for a cron, a public portal visitor, or another automation. */
  actorUserId?: string | null;
  payload: EventPayloadFor<T>;
  /**
   * Producer-supplied idempotency. Where two code paths can produce the same
   * logical event in one request, give both the same key and the second insert
   * is skipped rather than enqueued.
   */
  dedupKey?: string;
  /**
   * Delay eligibility. Only used by the schedule worker; a domain event is
   * always immediately eligible.
   */
  scheduledAt?: Date;
}

export interface EmitResult {
  correlationId: string;
  /** How many subscriber rows were actually written. 0 means deduped. */
  enqueued: number;
  deduped: boolean;
}

/** Postgres unique violation. A dedup hit, not an error. */
const PG_UNIQUE_VIOLATION = "23505";

function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

export async function emitWorkflowEvent<T extends WorkflowEventType>(
  db: EmitDb,
  args: EmitEventArgs<T>,
): Promise<EmitResult> {
  const definition = requireEventDefinition(args.type);
  const subject = args.subject ?? null;

  // The registry says whether this event has a subject. Disagreeing with it is
  // a producer bug that would otherwise surface much later as an enrollment
  // that silently matched nothing, or a dedup key built from `undefined`.
  if (definition.subject === null && subject !== null) {
    throw new Error(
      `Event "${args.type}" has no subject in the registry, but a subject was supplied.`,
    );
  }
  if (definition.subject !== null && subject === null) {
    throw new Error(
      `Event "${args.type}" requires a ${definition.subject} subject, but none was supplied.`,
    );
  }
  if (subject && definition.subject !== null && subject.type !== definition.subject) {
    throw new Error(
      `Event "${args.type}" is about a ${definition.subject}, but a ${subject.type} subject was supplied.`,
    );
  }

  // Parse #1 of 2. Throws on an extra key, a misspelled key, a Date where an
  // ISO string belongs, or a number where money belongs.
  const payload = definition.payload.parse(args.payload) as EventPayloadFor<T>;

  const correlationId = randomUUID();
  const scheduledAt = args.scheduledAt ?? new Date();

  const rows = EVENT_SUBSCRIBERS.map((subscriber: EventSubscriber) => ({
    tenantId: args.tenantId,
    eventType: args.type,
    // No cast. `jsonb("payload")` carries no `$type<>()`, so Drizzle's insert
    // type is `unknown` and the parsed payload is assignable as it stands. The
    // `as unknown as Record<string, unknown>` that used to be here was working
    // around a problem that did not exist, and [[strict-rules]] §4 bans that
    // pair precisely because it compiles whatever you put in front of it.
    payload,
    subjectType: subject?.type ?? null,
    subjectId: subject?.id ?? null,
    actorUserId: args.actorUserId ?? null,
    subscriber,
    correlationId,
    // Read from the async context rather than taken as an argument: the depth
    // has to reach here from an executor through a domain service and a
    // producer, and a parameter that thirty producers must each remember to
    // forward is a guard against runaway execution that fails silently the
    // first time someone forgets. See `causation.ts`.
    causationDepth: currentCausationDepth(),
    // Namespaced per subscriber by the unique index, so one key covers both
    // rows without the producer having to know there are two.
    dedupKey: args.dedupKey ?? null,
    scheduledAt,
  }));

  try {
    const inserted = await db
      .insert(workflowEventQueue)
      .values(rows)
      // A dedup hit must not fail the caller's transaction. `onConflictDoNothing`
      // rather than catching 23505: catching it inside a transaction is too
      // late, because Postgres has already aborted the transaction by the time
      // the error reaches JavaScript, and every statement after it would fail
      // with 25P02.
      .onConflictDoNothing()
      .returning({ id: workflowEventQueue.id });

    if (inserted.length > 0) {
      // After the write, but the listener only wakes a poll — it does not read
      // the row. A nudge that arrives before commit simply finds nothing and
      // the 5-second tick picks it up, which is why this is safe to fire here
      // rather than needing a commit hook the ORM does not expose.
      nudgeWorker();
    }

    return {
      correlationId,
      enqueued: inserted.length,
      deduped: inserted.length === 0,
    };
  } catch (err) {
    if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
      // Belt and braces: reachable only if a future index makes a conflict that
      // `onConflictDoNothing` does not cover.
      return { correlationId, enqueued: 0, deduped: true };
    }
    console.error(
      `[workflow] failed to enqueue "${args.type}" for tenant ${args.tenantId}`,
      { correlationId, subject, error: err },
    );
    // Deliberately rethrown. Inside the caller's transaction this rolls the
    // domain write back, which is the correct outcome: a change whose
    // automation could not be recorded has not fully happened.
    throw err;
  }
}
