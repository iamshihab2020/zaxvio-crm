/**
 * Goals — ending a run because something else happened.
 *
 * The mirror of `triggers/index.ts`. That module asks whether a dispatched
 * event should **start** a run; this one asks whether it should **end** one
 * already in flight. Both are subscribers on the same outbox, so a single
 * `invoice.paid` can start one automation and stop another with no coupling
 * between them.
 *
 * ## Two lessons from the trigger matcher, applied here before they cost
 * anything
 *
 * 1. **`goal_event` holds event names.** `job.completed`, never
 *    `trigger.job.completed`. The trigger matcher stored one vocabulary and
 *    queried with the other — both `string[]`, both internally consistent, and
 *    the overlap was empty for every event ever dispatched.
 * 2. **Arrays are built server-side.** Interpolating a JS array into a `sql`
 *    template binds it as a single scalar; the same predicate raised
 *    `22P02 malformed array literal` on every dispatched event for a day. There
 *    is no array parameter here at all, which is the cheapest way not to
 *    repeat it.
 *
 * ## Why nothing here throws for a business reason
 *
 * Same rule as the trigger subscriber: a goal that did not match, a run that
 * has already ended, a listener whose execution was deleted — all normal.
 * Throwing sends the queue row back for five attempts and a dead letter, and a
 * dead-letter table full of "this goal correctly did not fire" is worse than no
 * dead-letter table.
 */

import {
  workflowGoalListeners,
  workflowExecutions,
  and,
  eq,
  or,
  inArray,
  type getDb,
} from "@hvac-saas/database";
import { SUBJECT_TYPES, type SubjectType } from "@hvac-saas/workflow-nodes";
import type { ClaimedEvent } from "../events/worker.js";

/**
 * Narrow the event's subject type to the enum the column actually holds.
 *
 * `ClaimedEvent.subjectType` is `string | null` — it came out of a jsonb queue
 * row. Casting it into the enum would compile whether or not the value is
 * really a member ([[strict-rules]] §4); checking it costs one `includes` and
 * turns a corrupt row into "no goal matched" rather than a database error.
 */
function asSubjectType(value: string | null): SubjectType | null {
  if (!value) return null;
  return (SUBJECT_TYPES as readonly string[]).includes(value)
    ? (value as SubjectType)
    : null;
}

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface GoalOutcome {
  listenerId: string;
  executionId: string;
  /** False when the run had already finished by the time the goal fired. */
  endedRun: boolean;
  reason: string;
}

/**
 * Handle one claimed event for the `goal_listener` subscriber.
 *
 * Returns what it decided for each matching listener, which the worker logs.
 */
export async function handleGoalEvent(
  db: Db,
  event: ClaimedEvent,
): Promise<GoalOutcome[]> {
  // The payload's customer, for goals scoped to "anything for this customer".
  // Every payload carries `customerId` via the shared `customerRef` spread —
  // nullable only on bookings, where a hand-typed booking may not be linked to
  // anyone yet.
  const payload = (event.payload ?? {}) as { customerId?: unknown };
  const customerId =
    typeof payload.customerId === "string" && payload.customerId ? payload.customerId : null;

  // Nothing to match against. A goal is always about a record, so an event with
  // neither its own subject nor a customer cannot end anything.
  if (!event.subjectId && !customerId) return [];

  const subjectType = asSubjectType(event.subjectType);

  const scopeMatches = [];
  if (subjectType && event.subjectId) {
    scopeMatches.push(
      and(
        eq(workflowGoalListeners.subjectType, subjectType),
        eq(workflowGoalListeners.subjectId, event.subjectId),
      ),
    );
  }
  if (customerId) {
    scopeMatches.push(
      and(
        eq(workflowGoalListeners.subjectType, "customer"),
        eq(workflowGoalListeners.subjectId, customerId),
      ),
    );
  }

  const listeners = await db
    .select({
      id: workflowGoalListeners.id,
      executionId: workflowGoalListeners.executionId,
      nodeId: workflowGoalListeners.nodeId,
    })
    .from(workflowGoalListeners)
    .where(
      and(
        eq(workflowGoalListeners.tenantId, event.tenantId),
        eq(workflowGoalListeners.goalEvent, event.eventType),
        eq(workflowGoalListeners.status, "active"),
        or(...scopeMatches),
      ),
    );

  if (listeners.length === 0) return [];

  const outcomes: GoalOutcome[] = [];

  for (const listener of listeners) {
    // Compare-and-set from `waiting`, exactly as every other terminal
    // transition in this engine is. A run that resumed and finished on its own
    // between the listener being written and this event arriving must not be
    // re-completed — and the `returning()` is how we find out which happened
    // rather than assuming.
    const ended = await db
      .update(workflowExecutions)
      .set({
        status: "completed",
        completedAt: new Date(),
        // Cleared so the run does not read as still parked on the goal node.
        resumeAt: null,
      })
      .where(
        and(
          eq(workflowExecutions.tenantId, event.tenantId),
          eq(workflowExecutions.id, listener.executionId),
          eq(workflowExecutions.status, "waiting"),
        ),
      )
      .returning({ id: workflowExecutions.id });

    const endedRun = ended.length > 0;

    await db
      .update(workflowGoalListeners)
      .set({ status: "met", metAt: new Date() })
      .where(
        and(
          eq(workflowGoalListeners.tenantId, event.tenantId),
          eq(workflowGoalListeners.id, listener.id),
        ),
      );

    // A run may carry several goals. Once one is met the others are moot, and
    // leaving them active would keep matching events for a run that has ended.
    if (endedRun) await deactivateListeners(db, event.tenantId, listener.executionId);

    outcomes.push({
      listenerId: listener.id,
      executionId: listener.executionId,
      endedRun,
      reason: endedRun
        ? `Stopped early: ${event.eventType} happened.`
        : "The goal fired, but this automation had already finished.",
    });
  }

  return outcomes;
}

/**
 * Stand every remaining watch down for a run.
 *
 * Called on each terminal transition — a listener that outlives its run is a
 * watch that can never usefully fire, and it would still be read on every
 * dispatched event. `status <> 'active'` rows drop straight out of the partial
 * index, so this is also what keeps the hot lookup small.
 */
export async function deactivateListeners(
  db: Db,
  tenantId: string,
  executionId: string,
): Promise<void> {
  await db
    .update(workflowGoalListeners)
    .set({ status: "inactive" })
    .where(
      and(
        eq(workflowGoalListeners.tenantId, tenantId),
        eq(workflowGoalListeners.executionId, executionId),
        eq(workflowGoalListeners.status, "active"),
      ),
    );
}

/** Same, for a batch — used by the retention sweep and the reaper. */
export async function deactivateListenersFor(
  db: Db,
  tenantId: string,
  executionIds: string[],
): Promise<void> {
  if (executionIds.length === 0) return;
  await db
    .update(workflowGoalListeners)
    .set({ status: "inactive" })
    .where(
      and(
        eq(workflowGoalListeners.tenantId, tenantId),
        inArray(workflowGoalListeners.executionId, executionIds),
        eq(workflowGoalListeners.status, "active"),
      ),
    );
}

/**
 * Register every goal on the graph, at run start.
 *
 * This is step 7 of `execute()` and it happens **before traversal**, which is
 * the whole point: a goal has to be watching while the chase runs, not from the
 * moment the chain happens to reach it. "Chase this quote on day 3, 7 and 14,
 * and stop the moment they accept" only works if the watch is live during the
 * waits — registering on execution would mean the goal starts watching after
 * the last email, which is far too late to be worth anything.
 *
 * Reaching the node during traversal is a separate thing and still meaningful:
 * it has no outputs, so there is nothing left to do but wait, and the executor
 * parks the run as `waiting` with no clock. The listener it would need is
 * already here.
 *
 * Failures are swallowed per goal. A goal that cannot be registered — a run
 * with no customer under a customer-scoped goal — must not stop the automation
 * from running; it means one fewer early exit, not a broken chase.
 */
export async function registerGoals(
  db: Db,
  ctx: {
    tenantId: string;
    workflowId: string;
    executionId: string;
    subject: { type: SubjectType; id: string } | null;
    customer: { id: string } | null;
  },
  graph: { nodes: Array<{ id: string; nodeType: string; nodeConfig: { parameters?: Record<string, unknown>; disabled?: boolean } }> },
): Promise<number> {
  let registered = 0;

  for (const node of graph.nodes) {
    if (node.nodeType !== "goal.event") continue;
    // A switched-off goal must not still end the run — that is the one thing
    // "disabled" has to mean everywhere.
    if (node.nodeConfig.disabled) continue;

    const params = node.nodeConfig.parameters ?? {};
    const goal = typeof params.goalEvent === "string" ? params.goalEvent : "";
    if (!goal) continue;

    // Anything but the exact string falls back to the record. The customer
    // scope is the wider one, and a junk value must never silently widen a
    // goal — the same rule `email.send`'s purpose follows.
    const byCustomer = params.scope === "customer";
    const subjectType = byCustomer ? "customer" : (ctx.subject?.type ?? null);
    const subjectId = byCustomer ? (ctx.customer?.id ?? null) : (ctx.subject?.id ?? null);
    if (!subjectType || !subjectId) continue;

    try {
      await db
        .insert(workflowGoalListeners)
        .values({
          tenantId: ctx.tenantId,
          workflowId: ctx.workflowId,
          executionId: ctx.executionId,
          nodeId: node.id,
          subjectType,
          subjectId,
          goalEvent: goal,
          goalFilter: {},
        })
        // The unique index is partial on `status = 'active'`, so this covers the
        // resume case: a run that comes back from a delay re-registers nothing.
        .onConflictDoNothing();
      registered += 1;
    } catch (error) {
      console.error(
        `[workflow] Could not register goal ${goal} on execution ${ctx.executionId}`,
        error,
      );
    }
  }

  return registered;
}
