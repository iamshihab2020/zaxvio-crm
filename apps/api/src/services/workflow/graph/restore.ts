/**
 * Going back to an earlier version.
 *
 * Version history has existed since P5 — `workflow_versions` holds an immutable
 * snapshot of every publish — and until now there was no way to *use* one.
 * `GET /:id/versions` returned a list, `useWorkflowVersions` had zero callers,
 * and the answer to "I published a change and it broke" was to rebuild by hand
 * from memory.
 *
 * ## Restore writes the DRAFT, it does not activate
 *
 * The tempting shortcut is to point `active_version_id` at the old snapshot:
 * one column, instant rollback. It is wrong, for two reasons.
 *
 * The draft would still hold the broken graph, so the builder would show one
 * thing while the engine ran another — and the next Save would quietly publish
 * the breakage back. And it would mean a version becoming live without anybody
 * looking at it, which is the one rule this feature has held everywhere else:
 * drawing is not publishing, and nothing goes live except by an explicit act.
 *
 * So this copies the snapshot into `workflow_nodes` / `workflow_edges` and
 * stops. The tenant sees the old automation on the canvas, checks it is what
 * they wanted, and presses Publish — which mints a *new* version rather than
 * rewriting history. "v5, restored from v2" is a true statement about what
 * happened; silently making v2 current again is not.
 *
 * ## Node ids are kept
 *
 * The snapshot's ids go back in as they are, rather than being re-minted. Edges
 * inside the snapshot already reference them, so keeping them is the only way
 * the copy stays internally consistent without a rewrite — and `node_execution_logs`
 * points at node ids with no FK precisely so history survives this kind of
 * thing. A restored step keeps the run history it had the first time.
 */

import { workflowVersions, and, eq, type getDb } from "@hvac-saas/database";
import type { WorkflowGraph } from "@hvac-saas/types";
import { saveGraph, type SaveGraphResult } from "./persist.js";

type Db = ReturnType<typeof getDb>;

export interface RestoreVersionParams {
  db: Db;
  tenantId: string;
  workflowId: string;
  versionId: string;
  /** The `updatedAt` the client last saw — restore is a save like any other. */
  expectedUpdatedAt: Date;
}

export type RestoreResult =
  | { status: "not_found" }
  | { status: "empty" }
  | ({ restoredVersion: number } & SaveGraphResult);

export async function restoreVersion(
  params: RestoreVersionParams,
): Promise<RestoreResult> {
  const { db, tenantId, workflowId, versionId } = params;

  const [version] = await db
    .select({
      version: workflowVersions.version,
      graph: workflowVersions.graph,
    })
    .from(workflowVersions)
    .where(
      and(
        eq(workflowVersions.id, versionId),
        // Both, not just the id. A version id is a UUID nobody discloses, but
        // "you would have to guess it" is the reasoning behind every one of the
        // three ownership gaps the security audit found.
        eq(workflowVersions.tenantId, tenantId),
        eq(workflowVersions.workflowId, workflowId),
      ),
    );

  if (!version) return { status: "not_found" };

  const graph = version.graph as WorkflowGraph;

  // A snapshot with no nodes cannot be published, so restoring it would leave
  // the tenant with an empty canvas and a Publish button that refuses. Refusing
  // here says why; letting it through would look like the restore silently
  // deleted their work.
  if (!graph?.nodes?.length) return { status: "empty" };

  // Through the ordinary save path, deliberately. It holds the row lock, checks
  // the concurrency token and enforces the size cap — a second write path that
  // skipped any of those is how the "two saves both read the same token and both
  // proceed" bug comes back, and losing somebody's automation to a restore they
  // did not expect is the worst version of it.
  const result = await saveGraph({
    db,
    tenantId,
    workflowId,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      nodeType: node.nodeType,
      nodeConfig: node.nodeConfig,
      positionX: node.positionX,
      positionY: node.positionY,
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      sourceHandle: edge.sourceHandle,
      targetNodeId: edge.targetNodeId,
      label: edge.label ?? null,
    })),
    expectedUpdatedAt: params.expectedUpdatedAt,
  });

  return { restoredVersion: version.version, ...result };
}
