/**
 * Reading the draft graph.
 *
 * The *draft* is `workflow_nodes` + `workflow_edges`; the *published* graph is
 * the JSON snapshot in `workflow_versions.graph`. The engine reads the snapshot
 * and never these tables — that separation is what lets someone edit an
 * automation while a run from three days ago is still paused inside it.
 */

import {
  workflows,
  workflowNodes,
  workflowEdges,
  workflowVersions,
  and,
  eq,
  asc,
  desc,
  type getDb,
} from "@hvac-saas/database";
import type {
  GraphEdge,
  GraphNode,
  NodeConfig,
  Workflow,
  WorkflowGraph,
} from "@hvac-saas/types";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface LoadedWorkflow {
  workflow: Workflow;
  graph: WorkflowGraph;
}

/**
 * One workflow and its draft graph, or null.
 *
 * **Every predicate carries `tenantId`** ([[security-rules]] §1). Matching on
 * the record id alone is the defect the 2026-08-06 audit found in four separate
 * reads, and a workflow id is a uuid the app hands to the browser.
 */
export async function loadWorkflowWithGraph(
  db: Db,
  tenantId: string,
  workflowId: string,
): Promise<LoadedWorkflow | null> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)));

  if (!workflow) return null;

  const graph = await loadDraftGraph(db, tenantId, workflowId);
  return { workflow, graph };
}

/**
 * The draft nodes and edges.
 *
 * Ordered by `createdAt` so a save round-trip is stable — an unordered read
 * makes the whole-graph PUT look dirty on every load, and "3 unpublished
 * changes" that never goes away trains users to ignore it.
 */
export async function loadDraftGraph(
  db: Db,
  tenantId: string,
  workflowId: string,
): Promise<WorkflowGraph> {
  const [nodeRows, edgeRows] = await Promise.all([
    db
      .select()
      .from(workflowNodes)
      .where(
        and(
          eq(workflowNodes.tenantId, tenantId),
          eq(workflowNodes.workflowId, workflowId),
        ),
      )
      .orderBy(asc(workflowNodes.createdAt), asc(workflowNodes.id)),
    db
      .select()
      .from(workflowEdges)
      .where(
        and(
          eq(workflowEdges.tenantId, tenantId),
          eq(workflowEdges.workflowId, workflowId),
        ),
      )
      .orderBy(asc(workflowEdges.createdAt), asc(workflowEdges.id)),
  ]);

  const nodes: GraphNode[] = nodeRows.map((row) => ({
    id: row.id,
    nodeType: row.nodeType,
    // `node_config` is jsonb, so Drizzle types it `unknown`. This is the one
    // boundary where the shape is asserted, and it is asserted to a named type
    // rather than `any` ([[strict-rules]] §4).
    nodeConfig: row.nodeConfig as NodeConfig,
    positionX: row.positionX,
    positionY: row.positionY,
  }));

  const edges: GraphEdge[] = edgeRows.map((row) => ({
    id: row.id,
    sourceNodeId: row.sourceNodeId,
    sourceHandle: row.sourceHandle,
    targetNodeId: row.targetNodeId,
    label: row.label,
  }));

  return { nodes, edges };
}

/**
 * The version a workflow actually runs, or null before the first publish.
 *
 * Reads `workflows.active_version_id` rather than "the highest version number".
 * They are the same until someone restores an older version, and then they are
 * not — the engine pins `active_version_id`, so anything else here would show
 * the user a version that is not the one running.
 */
export async function loadActiveVersion(
  db: Db,
  tenantId: string,
  workflow: Pick<Workflow, "activeVersionId">,
) {
  if (!workflow.activeVersionId) return null;

  const [row] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.tenantId, tenantId),
        eq(workflowVersions.id, workflow.activeVersionId),
      ),
    );
  return row ?? null;
}

/** The most recently published version, whether or not it is the active one. */
export async function loadLatestVersion(
  db: Db,
  tenantId: string,
  workflowId: string,
) {
  const [row] = await db
    .select()
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.tenantId, tenantId),
        eq(workflowVersions.workflowId, workflowId),
      ),
    )
    .orderBy(desc(workflowVersions.version))
    .limit(1);
  return row ?? null;
}
