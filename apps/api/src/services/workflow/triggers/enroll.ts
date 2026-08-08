/**
 * Enrolment.
 *
 * **Two different problems, two different keys**, and conflating them is how a
 * system ends up either double-running or never re-running:
 *
 * | Problem | Key | A `23505` means |
 * |---|---|---|
 * | The *same event* delivered twice | `idempotency_key = sha256(workflowId:triggerNodeId:queueRowId)` | already handled — stop |
 * | A *different event* for a subject already mid-run | `active_dedup_key = workflowId:subjectType:subjectId` | **refresh**, do not start a second |
 *
 * The second is what stops a chatty trigger — a job updated five times during a
 * three-day wait — from creating five parallel runs of the same automation for
 * the same job.
 *
 * **Structural, not query-then-insert.** Checking with a `SELECT` and then
 * inserting is a race that loses exactly when it matters: two events for the
 * same subject arriving in the same second, which is the normal shape of a bulk
 * action. The unique index is the same instinct that put a `UNIQUE` on
 * `quotes.access_token`, and that one was verified by execution.
 */

import crypto from "node:crypto";
import {
  workflowExecutions,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import type { SubjectType } from "@hvac-saas/workflow-nodes";
import { loadExecutionContext } from "../engine/context.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * `sha256(workflowId:triggerNodeId:queueRowId)`.
 *
 * The **queue row** id, not the event's correlation id: the outbox writes one
 * row per subscriber, and the whole point of that split is that a failing
 * subscriber retries alone. Keying on the correlation id would make a retry of
 * the trigger row look like a duplicate of the goal row.
 *
 * Hashed rather than concatenated because it is three UUIDs and the column is a
 * `text` unique index — a fixed 64 characters indexes better than 110, and the
 * value is never read back by a human.
 */
export function idempotencyKey(
  workflowId: string,
  triggerNodeId: string,
  queueRowId: string,
): string {
  return crypto
    .createHash("sha256")
    .update(`${workflowId}:${triggerNodeId}:${queueRowId}`)
    .digest("hex");
}

/** `workflowId:subjectType:subjectId`, or null when there is no subject. */
export function activeDedupKey(
  workflowId: string,
  subject: { type: SubjectType; id: string } | null,
): string | null {
  // No subject, no dedup. A scheduled or webhook run has nothing to be "already
  // enrolled" *for*, and a shared key would serialise every one of them.
  return subject ? `${workflowId}:${subject.type}:${subject.id}` : null;
}

export type EnrolOutcome =
  | { kind: "duplicate"; reason: string }
  | { kind: "refreshed"; executionId: string; reason: string }
  | { kind: "enrol" };

/**
 * Decide whether to start a run, refresh one, or do nothing.
 *
 * Deliberately does **not** create the execution row — `execute()` owns that,
 * because it also owns the quota check, the version pinning and the terminal
 * handling, and two places inserting into `workflow_executions` is two places
 * that can disagree about what a run is.
 *
 * What this owns is the *decision*, and the refresh branch that follows from it.
 */
export async function resolveEnrolment(
  db: Db,
  params: {
    tenantId: string;
    workflowId: string;
    workflowName: string;
    versionId: string;
    timezone: string;
    triggerNodeId: string;
    queueRowId: string;
    subject: { type: SubjectType; id: string } | null;
    event: { type: string; payload: Record<string, unknown> };
  },
): Promise<EnrolOutcome> {
  const idem = idempotencyKey(
    params.workflowId,
    params.triggerNodeId,
    params.queueRowId,
  );

  // This exact queue row has already been handled. A pre-check rather than
  // relying on the insert's 23505, because the outbox retries a failed
  // subscriber and a retry that re-ran the automation would be worse than the
  // failure it is retrying.
  const [existingByEvent] = await db
    .select({ id: workflowExecutions.id })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, params.tenantId),
        eq(workflowExecutions.idempotencyKey, idem),
      ),
    );

  if (existingByEvent) {
    return { kind: "duplicate", reason: "This event was already handled." };
  }

  const dedup = activeDedupKey(params.workflowId, params.subject);
  if (!dedup) return { kind: "enrol" };

  const [live] = await db
    .select({
      id: workflowExecutions.id,
      status: workflowExecutions.status,
      waitingContext: workflowExecutions.waitingContext,
    })
    .from(workflowExecutions)
    .where(
      and(
        eq(workflowExecutions.tenantId, params.tenantId),
        eq(workflowExecutions.activeDedupKey, dedup),
      ),
    );

  // The index is partial on `status IN ('running','waiting')`, so a row here is
  // by definition non-terminal. A completed run never blocks a legitimate
  // re-enrolment later.
  if (!live) return { kind: "enrol" };

  await refreshWaitingContext(db, {
    ...params,
    executionId: live.id,
    existingContext: live.waitingContext,
  });

  return {
    kind: "refreshed",
    executionId: live.id,
    reason:
      "This automation is already running for this record, so its details were refreshed instead of starting a second one.",
  };
}

/**
 * Merge fresh subject data into a waiting run's stored context.
 *
 * **This calls the loader.** The reference implementation hand-rebuilds contact
 * and lead objects to match the loader's format across ~180 lines — two
 * implementations of one shape, guaranteed to drift, and the drift is invisible
 * because both sides look right in isolation.
 *
 * Node outputs, variables and loop state are kept exactly as they were: they
 * are a record of what already happened, and rewriting them would make a replay
 * lie about its own history.
 */
async function refreshWaitingContext(
  db: Db,
  params: {
    tenantId: string;
    workflowId: string;
    workflowName: string;
    versionId: string;
    timezone: string;
    executionId: string;
    subject: { type: SubjectType; id: string } | null;
    event: { type: string; payload: Record<string, unknown> };
    existingContext: unknown;
  },
): Promise<void> {
  // A run that is `running` rather than `waiting` has no stored context to
  // merge into — it is mid-traversal and holds its context in memory. Leaving
  // it alone is correct: it will finish with what it loaded, and the compare-
  // and-set below would refuse anyway.
  const existing =
    params.existingContext && typeof params.existingContext === "object"
      ? (params.existingContext as Record<string, unknown>)
      : null;
  if (!existing) return;

  let fresh;
  try {
    fresh = await loadExecutionContext(db, {
      tenantId: params.tenantId,
      workflowId: params.workflowId,
      workflowName: params.workflowName,
      versionId: params.versionId,
      executionId: params.executionId,
      timezone: params.timezone,
      subject: params.subject,
      trigger: { event: params.event.type, payload: params.event.payload },
    });
  } catch {
    // The subject was deleted between the event and this refresh. The waiting
    // run will discover that itself when it resumes, and cancelling it from
    // here would be a second place that decides what a missing subject means.
    return;
  }

  await db
    .update(workflowExecutions)
    .set({
      waitingContext: {
        ...existing,
        // Everything the world may have changed since the pause.
        customer: fresh.customer,
        job: fresh.job ?? null,
        invoice: fresh.invoice ?? null,
        quote: fresh.quote ?? null,
        booking: fresh.booking ?? null,
        equipment: fresh.equipment ?? null,
        contract: fresh.contract ?? null,
        tenant: fresh.tenant,
        assignee: fresh.assignee ?? null,
        // The event that prompted the refresh, so a downstream node reading
        // `{{trigger.*}}` after the wait sees the most recent one rather than
        // the one from three days ago.
        trigger: { event: params.event.type, payload: params.event.payload },
      },
    })
    .where(
      and(
        eq(workflowExecutions.tenantId, params.tenantId),
        eq(workflowExecutions.id, params.executionId),
        // Compare-and-set. A run that woke up while we were loading owns its
        // own context now, and overwriting it would hand it a snapshot it has
        // already moved past.
        eq(workflowExecutions.status, "waiting"),
      ),
    );
}
