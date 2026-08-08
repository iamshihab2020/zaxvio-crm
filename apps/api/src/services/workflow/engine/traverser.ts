/**
 * Walking the graph.
 *
 * ## Join semantics — the most important rule in the engine
 *
 * | Incoming edge | Join | Why |
 * |---|---|---|
 * | from a `trigger.*` node | **OR** | an automation may have several parallel trigger chains |
 * | into `logic.merge` | **AND** | that is what a merge node is *for* |
 * | everything else | **OR** | converging IF/ELSE branches proceed as soon as either arrives |
 *
 * OR-by-default is unusual and deliberate. The common pattern is an if/else
 * whose two branches both feed one "send follow-up" node; under AND semantics
 * that node would **never fire**, because only one branch ever ran. And the
 * editor says so out loud — any node with more than one incoming edge renders
 * "Runs when any branch reaches it" (D-05), because semantics you cannot see
 * are semantics you get wrong.
 *
 * P3 ships linear and branching traversal. `logic.merge`, `logic.goto` and
 * `logic.loop` are P6; the readiness bookkeeping that makes AND joins possible
 * is here from the start so their arrival is a node, not a rewrite.
 */

import { EXECUTION_LIMITS, getDefinition, type ExecutionContext } from "@hvac-saas/workflow-nodes";
import type { GraphEdge, GraphNode, WorkflowGraph } from "@hvac-saas/types";
import { executeNode } from "./node-executor.js";
import { WorkflowLimitExceeded } from "./errors.js";
import type { ExecutorDb } from "./executors/index.js";
import type { Diagnostic } from "./interpolate.js";

export interface TraverseParams {
  db: ExecutorDb;
  ctx: ExecutionContext;
  graph: WorkflowGraph;
  /** Where to begin. The trigger node, or the resume point's successors. */
  startNodeIds: string[];
  /** Continues the log ordering across a resume. */
  startSequence?: number;
}

export interface TraverseResult {
  nodesExecuted: number;
  lastSequence: number;
  diagnostics: Diagnostic[];
}

export async function traverse(params: TraverseParams): Promise<TraverseResult> {
  const { db, ctx, graph } = params;

  const nodesById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, GraphEdge[]>();
  const incomingCount = new Map<string, number>();

  for (const edge of graph.edges) {
    const list = outgoing.get(edge.sourceNodeId);
    if (list) list.push(edge);
    else outgoing.set(edge.sourceNodeId, [edge]);
    incomingCount.set(edge.targetNodeId, (incomingCount.get(edge.targetNodeId) ?? 0) + 1);
  }

  // Labels are how an author refers to a previous node's output —
  // `{{previous.Send Email.messageId}}`. Node ids are UUIDs nobody types.
  for (const node of graph.nodes) {
    const label = node.nodeConfig.label;
    if (label) ctx.nodeLabels[label] = node.id;
  }

  const queue = [...params.startNodeIds];
  const visited = new Set<string>();
  /** Which incoming edges have been satisfied, for AND joins. */
  const satisfied = new Map<string, Set<string>>();

  let executed = 0;
  let sequence = params.startSequence ?? 0;
  const diagnostics: Diagnostic[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;

    if (executed >= EXECUTION_LIMITS.MAX_NODES_EXECUTED) {
      throw new WorkflowLimitExceeded(
        `This automation ran ${EXECUTION_LIMITS.MAX_NODES_EXECUTED} steps and was stopped. That usually means two steps point back at each other — open the automation and look for a loop.`,
      );
    }

    const node = nodesById.get(nodeId);
    // An edge pointing at a node that is not in this version's snapshot. Not an
    // error worth failing a run over: the snapshot is immutable, so this means
    // the graph was saved inconsistently, and stopping the branch is a better
    // outcome for the tenant than a red run.
    if (!node) continue;

    // A merge node re-entered by its second branch is the one legitimate
    // revisit in P3's node set; readiness below is what gates it.
    if (visited.has(nodeId)) continue;

    if (!isReady(node, incomingCount, satisfied)) continue;

    visited.add(nodeId);
    sequence += 1;

    const result = await executeNode({ db, ctx, node, sequence });
    executed += 1;
    diagnostics.push(...result.diagnostics);

    // Keyed by id. `nodeLabels` above is what makes the label form work, so
    // there is one store rather than two that can disagree.
    ctx.nodeOutputs[node.id] = result.output;

    for (const edge of outgoing.get(node.id) ?? []) {
      // `source_handle` is a **stable id**, and an executor that returns no
      // handle is treated as `main`. Comparing against the display label is
      // what makes renaming an output break every saved automation (D-07).
      if ((edge.sourceHandle || "main") !== result.handle) continue;

      const marks = satisfied.get(edge.targetNodeId) ?? new Set<string>();
      marks.add(edge.id);
      satisfied.set(edge.targetNodeId, marks);

      if (!queue.includes(edge.targetNodeId)) queue.push(edge.targetNodeId);
    }
  }

  return { nodesExecuted: executed, lastSequence: sequence, diagnostics };
}

/**
 * Is this node allowed to run yet?
 *
 * AND for `logic.merge` — every incoming edge must have been satisfied. OR for
 * everything else, which is the whole point of the table at the top of this
 * file.
 */
function isReady(
  node: GraphNode,
  incomingCount: Map<string, number>,
  satisfied: Map<string, Set<string>>,
): boolean {
  const definition = getDefinition(node.nodeType);
  const isMerge = definition?.node === "logic.merge";
  if (!isMerge) return true;

  const required = incomingCount.get(node.id) ?? 0;
  const got = satisfied.get(node.id)?.size ?? 0;
  return got >= required;
}

/**
 * The nodes a resume continues from.
 *
 * `reExecuteCurrentNode` returns the paused node itself rather than its
 * successors — needed the moment a gate exists, because an approval step has to
 * re-evaluate the thing it was waiting on rather than assume it changed.
 */
export function successorsOf(
  graph: WorkflowGraph,
  nodeId: string,
  reExecuteCurrentNode: boolean,
): string[] {
  if (reExecuteCurrentNode) return [nodeId];
  return graph.edges
    .filter((e) => e.sourceNodeId === nodeId)
    .map((e) => e.targetNodeId);
}
