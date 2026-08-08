import type {
  workflows,
  workflowVersions,
  workflowFolders,
  workflowNodes,
  workflowEdges,
  workflowExecutions,
  nodeExecutionLogs,
} from "@hvac-saas/database";

// ── Row types ────────────────────────────────────────────────────────────────

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowInsert = typeof workflows.$inferInsert;
export type WorkflowUpdate = Partial<WorkflowInsert>;

export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type WorkflowVersionInsert = typeof workflowVersions.$inferInsert;

export type WorkflowFolder = typeof workflowFolders.$inferSelect;
export type WorkflowFolderInsert = typeof workflowFolders.$inferInsert;

export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type WorkflowNodeInsert = typeof workflowNodes.$inferInsert;

export type WorkflowEdge = typeof workflowEdges.$inferSelect;
export type WorkflowEdgeInsert = typeof workflowEdges.$inferInsert;

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type WorkflowExecutionInsert = typeof workflowExecutions.$inferInsert;

export type NodeExecutionLog = typeof nodeExecutionLogs.$inferSelect;
export type NodeExecutionLogInsert = typeof nodeExecutionLogs.$inferInsert;

export type WorkflowExecutionStatus = WorkflowExecution["status"];
export type WorkflowExecutionSource = WorkflowExecution["source"];
export type WorkflowSubjectType = NonNullable<WorkflowExecution["subjectType"]>;
export type NodeExecutionStatus = NodeExecutionLog["status"];

// ── The JSON shapes the columns hold ─────────────────────────────────────────

/**
 * `workflow_nodes.node_config`.
 *
 * `parameters` keys are `NodeProperty.name` from the node's definition, and
 * every default is seeded here at creation — the UI default and the runtime
 * default must be one declaration, not two.
 */
export interface NodeConfig {
  /** The user's name for this step. Renameable; the node type beneath it is not. */
  label: string;
  parameters: Record<string, unknown>;
  /** Skipped at run time, logged as `skipped`. The primary debugging tool. */
  disabled?: boolean;
}

/** One node inside a published snapshot. Mirrors the draft row, minus bookkeeping. */
export interface GraphNode {
  id: string;
  nodeType: string;
  nodeConfig: NodeConfig;
  positionX: number;
  positionY: number;
}

/** One edge inside a published snapshot. `sourceHandle` is a stable id. */
export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
  label?: string | null;
}

/**
 * `workflow_versions.graph` — the immutable snapshot the engine runs.
 *
 * Read from here and never from the draft tables, which is the whole point:
 * a run that paused for three days resumes against the graph it started with.
 */
export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── API shapes ───────────────────────────────────────────────────────────────

/** `GET /workflows/:id` — the draft graph plus enough state to render the toolbar. */
export interface WorkflowWithGraph {
  workflow: Workflow;
  graph: WorkflowGraph;
  activeVersion: Pick<
    WorkflowVersion,
    "id" | "version" | "publishedAt" | "note"
  > | null;
  /** The draft differs from the published version — drives "N unpublished changes". */
  isDirty: boolean;
}

/**
 * `GraphIssue` and `GraphValidation` are **not** declared here.
 *
 * They belong to the validator, and the validator has to be importable by the
 * browser as well as the API — so it lives in `@hvac-saas/workflow-nodes`,
 * which is pure and has no Drizzle behind it. Import them from there:
 *
 * ```ts
 * import type { GraphIssue, GraphValidation } from "@hvac-saas/workflow-nodes";
 * ```
 *
 * They were declared in both places at first. Two structurally identical
 * interfaces in two packages type-check fine and drift the moment a `severity`
 * or a `code` is added to one of them, which is the whole reason `code` is a
 * closed union on the real declaration and was a bare `string` on this one.
 */

/** A run, with the node logs the replay view renders. */
export interface WorkflowRunDetail {
  execution: WorkflowExecution;
  nodeLogs: NodeExecutionLog[];
  /** The exact graph this run executed — not the current draft. */
  graph: WorkflowGraph;
  workflowName: string;
  version: number;
}
