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
 *
 * ## Jumps and loops live here, not in their executors
 *
 * `logic.goto` returns a `jumpTo` and `logic.loop` returns `loopItems`; neither
 * moves the cursor itself. Two reasons, and the second is the one that matters:
 *
 * 1. An executor that could walk the graph would be a second implementation of
 *    traversal, and this project has now found three second implementations of
 *    things that should have had one.
 * 2. Only the walker holds what these need. A backwards jump has to **clear the
 *    `visited` marks** of everything it is about to re-run, or the second pass
 *    silently executes nothing — and `visited` exists nowhere else. Likewise a
 *    loop body is a *subgraph*, and the thing that knows how to walk a subgraph
 *    is the walker.
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
  let jumps = 0;
  const diagnostics: Diagnostic[] = [];

  /** Every node reachable from `start`, following any handle. Cycle-safe. */
  function reachableFrom(startIds: string[], stopAt?: string): Set<string> {
    const out = new Set<string>();
    const stack = [...startIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (out.has(id) || id === stopAt) continue;
      out.add(id);
      for (const edge of outgoing.get(id) ?? []) stack.push(edge.targetNodeId);
    }
    return out;
  }

  /** Follow a node's satisfied outputs, marking edges and enqueueing targets. */
  function advance(nodeId: string, handles: string[], into: string[]): void {
    const left = new Set(handles);
    for (const edge of outgoing.get(nodeId) ?? []) {
      // `source_handle` is a **stable id**, and an executor that returns no
      // handle is treated as `main`. Comparing against the display label is
      // what makes renaming an output break every saved automation (D-07).
      //
      // A set rather than an equality check because a fan-out leaves by several
      // outputs at once. For every other node this is a one-element set and
      // behaves exactly as it did.
      if (!left.has(edge.sourceHandle || "main")) continue;

      const marks = satisfied.get(edge.targetNodeId) ?? new Set<string>();
      marks.add(edge.id);
      satisfied.set(edge.targetNodeId, marks);

      if (!into.includes(edge.targetNodeId)) into.push(edge.targetNodeId);
    }
  }

  /**
   * Walk one region to exhaustion.
   *
   * The outer run and each loop iteration are the same walk over different
   * start points, which is why this is a function rather than the body of the
   * only `while`: an iteration that ran through a *copy* of the traversal logic
   * would be the second implementation this file's docblock warns about.
   *
   * `boundary`, when given, is the set of nodes this walk may enter — a loop
   * body may not wander out into the steps after the loop, because those run
   * once, after all the items.
   */
  async function walk(start: string[], boundary?: Set<string>): Promise<void> {
    const localQueue = [...start];

    while (localQueue.length > 0) {
      const nodeId = localQueue.shift()!;

      if (executed >= EXECUTION_LIMITS.MAX_NODES_EXECUTED) {
        throw new WorkflowLimitExceeded(
          `This automation ran ${EXECUTION_LIMITS.MAX_NODES_EXECUTED} steps and was stopped. That usually means two steps point back at each other — open the automation and look for a loop.`,
        );
      }

      if (boundary && !boundary.has(nodeId)) continue;

      const node = nodesById.get(nodeId);
      // An edge pointing at a node that is not in this version's snapshot. Not
      // an error worth failing a run over: the snapshot is immutable, so this
      // means the graph was saved inconsistently, and stopping the branch is a
      // better outcome for the tenant than a red run.
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

      // ── a jump ──────────────────────────────────────────────────────────
      if (result.jumpTo) {
        jumps += 1;
        if (jumps > EXECUTION_LIMITS.MAX_GOTO_JUMPS) {
          throw new WorkflowLimitExceeded(
            `This automation jumped between steps ${EXECUTION_LIMITS.MAX_GOTO_JUMPS} times and was stopped. A Jump pointing back at an earlier step repeats everything after it — check that something further down eventually stops.`,
          );
        }
        // **Clearing `visited` is the whole trick.** Without it a backwards
        // jump enqueues a node that has already run, the revisit guard drops
        // it, and the automation silently does nothing from that point on —
        // a completed run with half its steps missing and no error anywhere.
        // The satisfied-edge marks go with them, or an AND join inside the
        // repeated region would count arrivals from the previous pass.
        for (const id of reachableFrom([result.jumpTo])) {
          visited.delete(id);
          satisfied.delete(id);
        }
        if (!localQueue.includes(result.jumpTo)) localQueue.push(result.jumpTo);
        continue;
      }

      // ── a loop ──────────────────────────────────────────────────────────
      if (result.loopItems) {
        await runLoop(node.id, result.loopItems);
        // Then out by `done`, which is where the steps after the loop hang.
        advance(node.id, ["done"], localQueue);
        continue;
      }

      advance(node.id, result.handles, localQueue);
    }
  }

  /**
   * Run a loop body once per item.
   *
   * Each iteration re-walks the body from scratch, which is why `visited` and
   * the satisfied marks are cleared for the body between passes — exactly the
   * same reason a backwards jump clears them, and the same bug if it does not.
   *
   * `ctx.loop` is set before the pass and **restored** afterwards rather than
   * deleted: a loop inside a loop is expressible, and blindly clearing would
   * make the outer `{{loop.item}}` resolve to nothing for every step after the
   * inner one finished.
   */
  async function runLoop(loopNodeId: string, items: unknown[]): Promise<void> {
    const bodyStart = (outgoing.get(loopNodeId) ?? [])
      .filter((e) => (e.sourceHandle || "main") === "loop")
      .map((e) => e.targetNodeId);

    if (bodyStart.length === 0) return;

    // Bounded at the loop node itself, so a body that points back at the loop
    // does not pull the loop into its own region.
    const body = reachableFrom(bodyStart, loopNodeId);
    const outer = ctx.loop;

    const capped = items.slice(0, EXECUTION_LIMITS.MAX_LOOP_ITERATIONS);

    for (const [index, item] of capped.entries()) {
      ctx.loop = { item, index, total: capped.length };
      for (const id of body) {
        visited.delete(id);
        satisfied.delete(id);
      }
      await walk(bodyStart, body);
    }

    ctx.loop = outer;
  }

  await walk(queue);

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
