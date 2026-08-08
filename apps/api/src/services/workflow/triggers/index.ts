/**
 * Event → candidate workflows → trigger nodes → filters → enrol.
 *
 * This is the subscriber the outbox has been enqueuing rows for since P2. Until
 * now `workflow_trigger` rows were claimed, parsed and completed with nothing
 * behind them — deliberately, so the transport could be proved on its own.
 *
 * ## The one query that has to be fast
 *
 * Every dispatched event runs the candidate lookup, so it reads
 * `workflow_versions.trigger_types` — a denormalised `text[]` with a GIN-able
 * predicate — rather than parsing every published snapshot to find out which
 * ones care. It is the hottest read in the feature.
 *
 * ## Why this never throws for a business reason
 *
 * A workflow whose filters did not match, whose subject has been deleted, or
 * which is already running for this subject are all **normal outcomes**, not
 * failures. Throwing would send the queue row back for five retries and a dead
 * letter, and the dead-letter table would fill with "this automation correctly
 * did not run". Only an infrastructure failure is allowed out of here.
 */

import {
  workflowVersions,
  workflows,
  and,
  eq,
  isNull,
  sql,
  type getDb,
} from "@hvac-saas/database";
import {
  DEFAULT_TIMEZONE,
  allDefinitions,
  describeMatch,
  matchesFilters,
  type SubjectType,
} from "@hvac-saas/workflow-nodes";
import type { GraphNode, WorkflowGraph } from "@hvac-saas/types";
import { execute } from "../engine/execute.js";
import { resolveEnrolment, idempotencyKey } from "./enroll.js";
import type { ClaimedEvent } from "../events/worker.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Event type → the trigger node types that listen for it.
 *
 * Built once at module load from the same `triggerEvents` declarations the
 * registry test cross-checks against the event registry, so a trigger that
 * names an event nothing emits fails the build rather than sitting quiet.
 */
const LISTENERS_BY_EVENT: ReadonlyMap<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const definition of allDefinitions()) {
    for (const event of definition.triggerEvents ?? []) {
      const list = map.get(event);
      if (list) list.push(definition.node);
      else map.set(event, [definition.node]);
    }
  }
  return map;
})();

export interface TriggerOutcome {
  workflowId: string;
  triggerNodeId: string;
  matched: boolean;
  /** Plain language, for "why didn't my automation run?". */
  reason: string;
  executionId?: string | null;
}

/**
 * Handle one claimed `workflow_trigger` event.
 *
 * Returns what it decided for every candidate, which the worker logs and P8's
 * diagnostics page will read.
 */
export async function handleTriggerEvent(
  db: Db,
  event: ClaimedEvent,
): Promise<TriggerOutcome[]> {
  const nodeTypes = LISTENERS_BY_EVENT.get(event.eventType);
  // Nothing listens for this event type. Most events are in this bucket most of
  // the time — `customer.updated` fires constantly and almost nobody triggers
  // on it — so this is the cheap early exit, before any query at all.
  if (!nodeTypes || nodeTypes.length === 0) return [];

  // **The event type, not the node types.** `collectTriggerTypes` fills
  // `trigger_types` from `def.triggerEvents` — event names like `job.completed`
  // — while `LISTENERS_BY_EVENT` maps an event to the *node ids* that listen for
  // it, `trigger.job.completed`. Passing `nodeTypes` here overlapped an array of
  // event names against an array of node ids: two sets that share no member, so
  // the query returned nothing for every event ever dispatched and **no
  // event-triggered automation could fire at all**. Manual runs go straight to
  // `execute()` and never touch this, which is why nothing surfaced it.
  //
  // `nodeTypes` is still right below, where it picks which trigger nodes inside
  // a candidate to evaluate — node ids on both sides there.
  const candidates = await findCandidateVersions(db, event.tenantId, [event.eventType]);
  if (candidates.length === 0) return [];

  const subject =
    event.subjectType && event.subjectId
      ? { type: event.subjectType as SubjectType, id: event.subjectId }
      : null;

  const outcomes: TriggerOutcome[] = [];

  for (const candidate of candidates) {
    // A workflow may have several trigger nodes of the same type — "when a job
    // is completed, if it was a repair" and "…if it was over $2,000" are two
    // legitimate starting points on one canvas, each with its own filters.
    const triggerNodes = candidate.graph.nodes.filter((node) =>
      nodeTypes.includes(node.nodeType),
    );

    for (const node of triggerNodes) {
      const outcome = await evaluateAndEnrol(db, {
        event,
        subject,
        candidate,
        node,
      });
      outcomes.push(outcome);
    }
  }

  return outcomes;
}

interface Candidate {
  workflowId: string;
  workflowName: string;
  versionId: string;
  timezone: string;
  graph: WorkflowGraph;
}

async function evaluateAndEnrol(
  db: Db,
  input: {
    event: ClaimedEvent;
    subject: { type: SubjectType; id: string } | null;
    candidate: Candidate;
    node: GraphNode;
  },
): Promise<TriggerOutcome> {
  const { event, subject, candidate, node } = input;

  const definition = allDefinitions().find((d) => d.node === node.nodeType);
  if (!definition) {
    // The snapshot names a node type the registry no longer has. Node ids are
    // immutable, so this is corrupt data rather than a rename — and refusing
    // the one trigger beats failing the whole event.
    return {
      workflowId: candidate.workflowId,
      triggerNodeId: node.id,
      matched: false,
      reason: `This automation starts with a step ("${node.nodeType}") that no longer exists.`,
    };
  }

  const result = matchesFilters(
    definition,
    node.nodeConfig.parameters ?? {},
    event.payload,
  );

  if (!result.matched) {
    return {
      workflowId: candidate.workflowId,
      triggerNodeId: node.id,
      matched: false,
      reason: describeMatch(result),
    };
  }

  const enrolment = await resolveEnrolment(db, {
    tenantId: event.tenantId,
    workflowId: candidate.workflowId,
    workflowName: candidate.workflowName,
    versionId: candidate.versionId,
    timezone: candidate.timezone,
    triggerNodeId: node.id,
    queueRowId: event.id,
    subject,
    event: {
      type: event.eventType,
      payload: event.payload as Record<string, unknown>,
    },
  });

  if (enrolment.kind !== "enrol") {
    return {
      workflowId: candidate.workflowId,
      triggerNodeId: node.id,
      matched: true,
      reason: enrolment.reason,
      executionId: enrolment.kind === "refreshed" ? enrolment.executionId : null,
    };
  }

  const run = await execute({
    tenantId: event.tenantId,
    workflowId: candidate.workflowId,
    versionId: candidate.versionId,
    subject,
    event: {
      type: event.eventType,
      payload: event.payload as Record<string, unknown>,
    },
    source: "event",
    // Passed so `execute()`'s insert carries it too. `resolveEnrolment` checked
    // for an existing row, but two workers claiming two rows for the same event
    // in the same instant would both pass that check — the unique index is what
    // actually decides, and it can only do that if the key is on the insert.
    idempotencyKey: idempotencyKey(candidate.workflowId, node.id, event.id),
    actorUserId: event.actorUserId,
  });

  return {
    workflowId: candidate.workflowId,
    triggerNodeId: node.id,
    matched: true,
    reason: run.reason,
    executionId: run.executionId,
  };
}

/**
 * Published, active, unarchived versions whose graph contains a listening node.
 *
 * `trigger_types && ARRAY[...]` is the array-overlap operator — true when the
 * two share any member. **Both sides are event names.** Parameterised, never
 * interpolated; the values come from the node registry rather than from a
 * request, but a raw-SQL array literal built by string concatenation is a habit
 * worth not having.
 *
 * `activeVersionId` is matched rather than "the latest version": a run must
 * start on the version the tenant **published**, not on whatever was saved most
 * recently. Drawing is not publishing.
 */
async function findCandidateVersions(
  db: Db,
  tenantId: string,
  /**
   * **Event names**, matching what `collectTriggerTypes` writes — not node ids.
   *
   * Named for what it holds. The parameter used to be `nodeTypes`, and the call
   * site duly passed node ids: both sides were internally consistent, the types
   * agreed (`string[]` either way), and the overlap was silently always empty.
   */
  eventTypes: string[],
): Promise<Candidate[]> {
  const rows = await db
    .select({
      workflowId: workflows.id,
      workflowName: workflows.name,
      timezoneMode: workflows.timezoneMode,
      timezone: workflows.timezone,
      versionId: workflowVersions.id,
      graph: workflowVersions.graph,
    })
    .from(workflows)
    .innerJoin(
      workflowVersions,
      and(
        eq(workflows.activeVersionId, workflowVersions.id),
        eq(workflowVersions.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(workflows.tenantId, tenantId),
        // Switched on by the tenant. An automation that is drawn, published and
        // then paused must not fire.
        eq(workflows.isActive, true),
        isNull(workflows.archivedAt),
        sql`${workflowVersions.triggerTypes} && ${eventTypes}`,
      ),
    );

  return rows.map((row) => ({
    workflowId: row.workflowId,
    workflowName: row.workflowName,
    versionId: row.versionId,
    // The workflow's zone when it has one, else the tenant's. `execute()`
    // resolves this again from the same rule — one of them is redundant, and it
    // is this one, kept so a refresh has a zone without a second query.
    timezone:
      row.timezoneMode === "custom" && row.timezone ? row.timezone : DEFAULT_TIMEZONE,
    graph: row.graph as WorkflowGraph,
  }));
}
