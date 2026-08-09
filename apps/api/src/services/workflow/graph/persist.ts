/**
 * Saving the draft graph.
 *
 * The contract is a **whole-graph PUT**, not a set of per-node patches. The
 * builder holds the entire graph in a Zustand store and every interaction —
 * drag, insert-on-edge, relink-on-delete, undo — changes several rows at once;
 * expressing that as a patch stream means the server can observe a graph state
 * the client never had. So the client sends everything and the server replaces
 * everything, inside one transaction.
 *
 * That makes optimistic concurrency mandatory rather than nice to have
 * ([[wf-08-builder-frontend|S-6]]): with a whole-graph write, "last save wins"
 * does not lose a field, it loses **the other person's entire automation**.
 */

import {
  workflows,
  workflowNodes,
  workflowEdges,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import { EXECUTION_LIMITS } from "@hvac-saas/workflow-nodes";
import type { NodeConfig, WorkflowGraph } from "@hvac-saas/types";

type Db = ReturnType<typeof getDb>;

export interface GraphNodeInput {
  id: string;
  nodeType: string;
  nodeConfig: NodeConfig;
  positionX: number;
  positionY: number;
}

export interface GraphEdgeInput {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  label?: string | null;
}

export interface SaveGraphParams {
  db: Db;
  tenantId: string;
  workflowId: string;
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
  /**
   * The `updatedAt` the client last saw. A mismatch means someone else saved in
   * between, and the correct answer is to refuse and let the user decide.
   */
  expectedUpdatedAt: Date;
}

export type SaveGraphResult =
  | { status: "saved"; updatedAt: Date; graph: WorkflowGraph }
  | { status: "conflict"; currentUpdatedAt: Date }
  | { status: "too_large"; limit: number; received: number }
  | { status: "not_found" };

export async function saveGraph(
  params: SaveGraphParams,
): Promise<SaveGraphResult> {
  const { db, tenantId, workflowId, nodes, edges, expectedUpdatedAt } = params;

  if (nodes.length > EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW) {
    return {
      status: "too_large",
      limit: EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW,
      received: nodes.length,
    };
  }

  return db.transaction(async (tx) => {
    // Locked for the duration. Without this, two saves both read the same
    // `updatedAt`, both find it matching, and both proceed — which is precisely
    // the clobber the token exists to prevent. The check and the write have to
    // be one atomic step, and a row lock is what makes them one.
    const [workflow] = await tx
      .select({ id: workflows.id, updatedAt: workflows.updatedAt })
      .from(workflows)
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)))
      .for("update");

    if (!workflow) return { status: "not_found" };

    // Compared at millisecond granularity, which is all there is: Postgres
    // stores microseconds, but the value already round-tripped through a JS
    // `Date` on its way to the client and lost them. Comparing the raw strings
    // would fail on a difference neither side can see.
    if (workflow.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
      return { status: "conflict", currentUpdatedAt: workflow.updatedAt };
    }

    // Delete-then-insert rather than a diff. `workflow_edges` deliberately has
    // no foreign key to `workflow_nodes` precisely so this is legal in one
    // statement order — see the schema comment. Edges first anyway, so the
    // intermediate state inside the transaction is never edges-without-nodes.
    await tx
      .delete(workflowEdges)
      .where(
        and(
          eq(workflowEdges.tenantId, tenantId),
          eq(workflowEdges.workflowId, workflowId),
        ),
      );
    await tx
      .delete(workflowNodes)
      .where(
        and(
          eq(workflowNodes.tenantId, tenantId),
          eq(workflowNodes.workflowId, workflowId),
        ),
      );

    if (nodes.length > 0) {
      await tx.insert(workflowNodes).values(
        nodes.map((node) => ({
          id: node.id,
          // **From the session, never from the body.** A tenant id or workflow
          // id taken from the payload is the whole of multi-tenancy handed to
          // the caller (D-16).
          tenantId,
          workflowId,
          nodeType: node.nodeType,
          nodeConfig: node.nodeConfig,
          positionX: Math.trunc(node.positionX),
          positionY: Math.trunc(node.positionY),
        })),
      );
    }

    if (edges.length > 0) {
      await tx.insert(workflowEdges).values(
        edges.map((edge) => ({
          id: edge.id,
          tenantId,
          workflowId,
          sourceNodeId: edge.sourceNodeId,
          sourceHandle: edge.sourceHandle,
          targetNodeId: edge.targetNodeId,
          label: edge.label ?? null,
        })),
      );
    }

    // Set explicitly rather than relying on a trigger or `defaultNow()`, so the
    // value returned to the client is the value stored — the client sends it
    // straight back as the next `expectedUpdatedAt`, and a token it did not
    // receive verbatim is a 409 on the user's very next save.
    const savedAt = new Date();
    await tx
      .update(workflows)
      .set({ updatedAt: savedAt })
      .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)));

    return {
      status: "saved",
      updatedAt: savedAt,
      graph: {
        nodes: nodes.map((n) => ({
          id: n.id,
          nodeType: n.nodeType,
          nodeConfig: n.nodeConfig,
          positionX: Math.trunc(n.positionX),
          positionY: Math.trunc(n.positionY),
        })),
        edges: edges.map((e) => ({
          id: e.id,
          sourceNodeId: e.sourceNodeId,
          sourceHandle: e.sourceHandle,
          targetNodeId: e.targetNodeId,
          label: e.label ?? null,
        })),
      },
    };
  });
}
