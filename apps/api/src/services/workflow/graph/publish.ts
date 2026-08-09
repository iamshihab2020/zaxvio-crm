/**
 * Publishing — turning a draft into something that runs.
 *
 * [[wf-00-decisions|D-06]]: drawing is not publishing. Saving persists the
 * draft and changes nothing about what executes; publishing snapshots the draft
 * into an immutable `workflow_versions` row and points `active_version_id` at
 * it. A run in flight keeps the version it started on, so a delay that paused
 * three days ago resumes against the graph it began with rather than one that
 * may no longer contain its next node.
 *
 * This is also where `trigger_types` is written, which is the column the whole
 * trigger matcher reads. Until a workflow is published it has no version, no
 * trigger types, and therefore fires for nothing — which is exactly the
 * intended behaviour for a half-drawn automation.
 */

import {
  workflows,
  workflowVersions,
  and,
  eq,
  desc,
  type getDb,
} from "@hvac-saas/database";
import { getDefinition, type GraphValidation } from "@hvac-saas/workflow-nodes";
import type { WorkflowGraph, WorkflowVersion } from "@hvac-saas/types";
import { loadDraftGraph } from "./load.js";
import { validateGraphForTenant } from "./validate.js";

type Db = ReturnType<typeof getDb>;

export type PublishResult =
  | { status: "published"; version: WorkflowVersion }
  | { status: "invalid"; validation: GraphValidation }
  | { status: "not_found" };

export interface PublishParams {
  db: Db;
  tenantId: string;
  workflowId: string;
  publishedBy: string | null;
  /** What changed, in the publisher's words. Shown in version history. */
  note?: string | null;
}

/**
 * Snapshot the draft, bump the version, make it active.
 *
 * One transaction, with the workflow row locked. The lock is not decoration:
 * `version` is derived from the current maximum, and `(workflow_id, version)`
 * carries a unique index, so two publishes landing together would otherwise
 * either race to the same number and one would fail with a `23505` the user
 * cannot interpret, or — worse, without the index — silently produce two v4s.
 */
export async function publishWorkflow(
  params: PublishParams,
): Promise<PublishResult> {
  const { db, tenantId, workflowId, publishedBy } = params;

  return db.transaction(async (tx) => {
    const [workflow] = await tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)))
      .for("update");

    if (!workflow) return { status: "not_found" };

    const graph = await loadDraftGraph(tx, tenantId, workflowId);

    // Validated **inside** the transaction and against the graph just read, not
    // against whatever the client sent. A publish that trusts a client-side
    // "it's valid" is a publish that runs an invalid graph.
    // The name check lives in `validateGraphForTenant`, not here. It was here
    // first, and that made publish and `GET /:id/validate` disagree — which the
    // client notices, because a refused publish re-reads its problem list from
    // that endpoint. One validator, one answer.
    const validation = await validateGraphForTenant(
      tx,
      tenantId,
      graph,
      workflow.name,
    );

    if (validation.errors.length > 0) {
      return { status: "invalid", validation };
    }

    const [latest] = await tx
      .select({ version: workflowVersions.version })
      .from(workflowVersions)
      .where(
        and(
          eq(workflowVersions.tenantId, tenantId),
          eq(workflowVersions.workflowId, workflowId),
        ),
      )
      .orderBy(desc(workflowVersions.version))
      .limit(1);

    const nextVersion = (latest?.version ?? 0) + 1;

    const [version] = await tx
      .insert(workflowVersions)
      .values({
        tenantId,
        workflowId,
        version: nextVersion,
        graph,
        triggerTypes: collectTriggerTypes(graph),
        nodeCount: graph.nodes.length,
        publishedBy,
        note: params.note ?? null,
      })
      .returning();

    await tx
      .update(workflows)
      .set({ activeVersionId: version.id, updatedAt: new Date() })
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)));

    return { status: "published", version };
  });
}

/**
 * Does the draft differ from what is published — "● 3 unpublished changes".
 *
 * Compares **behaviour, not layout.** Node positions are excluded on purpose:
 * dragging a node to tidy the canvas changes nothing about what the automation
 * does, and counting it as an unpublished change would mean the banner is lit
 * almost permanently. A warning that is always on is a warning nobody reads,
 * and this one has to still mean something on the day it says "your edits are
 * not live yet".
 *
 * Layout still persists — Save writes positions like anything else. It simply
 * does not oblige a Publish.
 */
export function isDraftDirty(
  draft: WorkflowGraph,
  published: WorkflowGraph | null,
): boolean {
  if (!published) return draft.nodes.length > 0;
  return behaviourKey(draft) !== behaviourKey(published);
}

/**
 * A stable string describing everything about a graph that affects execution.
 *
 * Sorted by id, because the comparison must not depend on row order — two reads
 * that differ only in ordering would report a change the user did not make.
 */
function behaviourKey(graph: WorkflowGraph): string {
  const nodes = [...graph.nodes]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((n) => ({
      id: n.id,
      nodeType: n.nodeType,
      label: n.nodeConfig.label,
      disabled: n.nodeConfig.disabled ?? false,
      parameters: sortKeys(n.nodeConfig.parameters ?? {}),
    }));

  const edges = [...graph.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((e) => ({
      id: e.id,
      sourceNodeId: e.sourceNodeId,
      sourceHandle: e.sourceHandle,
      targetNodeId: e.targetNodeId,
    }));

  return JSON.stringify({ nodes, edges });
}

/** `JSON.stringify` preserves insertion order, so keys are ordered explicitly —
 *  otherwise re-saving the same parameters in a different order reads as a change. */
function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) out[key] = value[key];
  return out;
}

/**
 * The event types this graph listens for.
 *
 * Denormalised onto the version row so the trigger matcher can find candidate
 * workflows with an index instead of parsing every snapshot — this query runs
 * on **every dispatched event**, so it is the hottest read in the feature.
 *
 * Derived from the graph at publish time and never written by hand. A trigger
 * node the author deleted must stop matching the moment they publish, and the
 * only way to guarantee that is to recompute the whole set from the snapshot
 * being published rather than adjusting a stored one.
 *
 * Disabled trigger nodes are **excluded**: a switched-off trigger that still
 * enrolled runs would make the disable toggle a lie.
 */
export function collectTriggerTypes(graph: WorkflowGraph): string[] {
  const types = new Set<string>();

  for (const node of graph.nodes) {
    if (node.nodeConfig.disabled) continue;
    const def = getDefinition(node.nodeType);
    if (!def || def.category !== "trigger") continue;
    for (const eventType of def.triggerEvents ?? []) types.add(eventType);
  }

  // Sorted so two publishes of the same graph produce an identical array. An
  // unstable order makes version diffs noisy and "did anything change" hard to
  // answer.
  return [...types].sort();
}
