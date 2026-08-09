/**
 * Graph validation — the rules that decide whether a draft may be published.
 *
 * ## Why this lives in the package and not in `services/`
 *
 * [[wf-08-builder-frontend|§8.7]] requires **two layers, one implementation**:
 * the builder blocks the Publish button and the API refuses the request, and
 * they must never disagree — a client-only check is a suggestion, and a
 * server-only check is a dialog the user cannot act on. The browser cannot
 * import from `apps/api`, so the shared half has to live here.
 *
 * That forces a constraint worth stating: **this module is pure.** No database,
 * no I/O, no `@hvac-saas/types` (which pulls Drizzle in behind it). It takes a
 * graph and returns issues. The one rule that genuinely needs the database —
 * "this node points at a row you do not own" — cannot be pure and therefore
 * lives in `services/workflow/graph/validate.ts`, which calls this and appends.
 *
 * The graph types here are structural rather than imported for the same reason.
 * `WorkflowGraph` from `@hvac-saas/types` satisfies them, so the API passes its
 * real rows straight in and TypeScript checks the shape at the boundary.
 */

import { EXECUTION_LIMITS } from "../limits.js";
import { getDefinition, isActive, outputsFor } from "../catalog.js";
import { getEventDefinition } from "../events/registry.js";
import { VARIABLE_MAP, suggestVariables } from "../variables/index.js";
import {
  getMissingRequiredFields,
  isPropertyVisible,
  type NodeDefinition,
  type SubjectType,
} from "../node-definition.js";

// ─────────────────────────────────────────────────────────────────────────────
// Structural input
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidatableNode {
  id: string;
  nodeType: string;
  nodeConfig: {
    label?: string;
    parameters?: Record<string, unknown>;
    disabled?: boolean;
  };
}

export interface ValidatableEdge {
  id: string;
  sourceNodeId: string;
  sourceHandle: string;
  targetNodeId: string;
}

export interface ValidatableGraph {
  nodes: ValidatableNode[];
  edges: ValidatableEdge[];
}

/**
 * One problem found by the validator.
 *
 * Canonical here; `@hvac-saas/types` re-exports it. Two structurally identical
 * declarations in two packages is exactly how a `severity` value gets added in
 * one and not the other.
 */
export interface GraphIssue {
  /** Errors block a publish; warnings do not. */
  severity: "error" | "warning";
  /** Machine-readable, so the UI can group and the tests can assert. */
  code: GraphIssueCode;
  /** Plain language, naming the cause and the fix. Never a code or a stack. */
  message: string;
  /** Which node to select when the user clicks the issue ([[wf-08-builder-frontend|S-4]]). */
  nodeId?: string;
  field?: string;
}

export interface GraphValidation {
  errors: GraphIssue[];
  warnings: GraphIssue[];
}

/** Closed set, so the UI can group by code and a test can assert exhaustively. */
export type GraphIssueCode =
  | "no_trigger"
  | "unknown_node_type"
  | "inactive_node_type"
  | "duplicate_node_id"
  | "dangling_edge"
  | "missing_required_field"
  | "orphan_node"
  | "unconnected_branch_output"
  | "goto_target_missing"
  | "too_many_nodes"
  | "delay_in_loop"
  | "subject_mismatch"
  /** Raised by the server half only — it needs the database to know. */
  | "unowned_reference"
  | "unreachable_node"
  | "goto_after_split"
  | "merge_never_completes"
  | "no_action"
  | "too_many_triggers"
  | "disabled_node_incomplete"
  | "unknown_variable"
  /** Raised by the publish path only — the name is not part of the graph. */
  | "default_name";

/**
 * Node ids the validator reasons about structurally.
 *
 * Three of these are P6 nodes that do not exist in the registry yet. The rules
 * that reference them are written now and are simply no-ops until the
 * definitions land — which is the point: the rule arrives with the node instead
 * of being remembered later. `MAX_TRIGGERS` mirrors [[wf-08-builder-frontend|§8.7]].
 */
const NODE = {
  goto: "logic.goto",
  loop: "logic.loop",
  delay: "delay.wait",
  split: "split.branch",
  merge: "logic.merge",
} as const;

const MAX_TRIGGERS = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a draft graph.
 *
 * Order matters only in that structural problems are reported before semantic
 * ones — an author with a dangling edge is not helped by also being told the
 * node it points at is unreachable.
 */
export function validateGraph(graph: ValidatableGraph): GraphValidation {
  const issues: GraphIssue[] = [];
  const push = (i: GraphIssue) => issues.push(i);

  const nodeById = new Map<string, ValidatableNode>();
  for (const node of graph.nodes) {
    if (nodeById.has(node.id)) {
      push({
        severity: "error",
        code: "duplicate_node_id",
        message: `Two steps share the same id. Reload the automation — this is a bug, not something you did.`,
        nodeId: node.id,
      });
      continue;
    }
    nodeById.set(node.id, node);
  }

  // ── size ──────────────────────────────────────────────────────────────────
  if (graph.nodes.length > EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW) {
    push({
      severity: "error",
      code: "too_many_nodes",
      message:
        `This automation has ${graph.nodes.length} steps. The limit is ` +
        `${EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW}. Split it into two automations, ` +
        `or use a "Run another automation" step.`,
    });
  }

  // ── definitions ───────────────────────────────────────────────────────────
  // Resolved once. Every later rule reads from here, so an unknown node type is
  // reported exactly once rather than by each rule that trips over it.
  const defByNodeId = new Map<string, NodeDefinition>();
  for (const node of nodeById.values()) {
    const def = getDefinition(node.nodeType);
    if (!def) {
      push({
        severity: "error",
        code: "unknown_node_type",
        message:
          `"${labelOf(node)}" is a kind of step this version of Zaxvio does not ` +
          `recognise. Delete it and add the step again.`,
        nodeId: node.id,
      });
      continue;
    }
    if (!isActive(node.nodeType)) {
      push({
        severity: "error",
        code: "inactive_node_type",
        message:
          `"${labelOf(node)}" is not available yet, so this automation cannot be ` +
          `published. Remove the step to publish the rest.`,
        nodeId: node.id,
      });
      continue;
    }
    defByNodeId.set(node.id, def);
  }

  // ── referential sanity ────────────────────────────────────────────────────
  // `workflow_edges` deliberately has no foreign key to `workflow_nodes` (a
  // whole-graph save deletes and re-inserts in one transaction, and an FK would
  // impose an ordering constraint for no benefit). The schema comment says the
  // validator must therefore check this — the published snapshot needs it too,
  // and a dangling edge is a run that stops without saying why.
  const liveEdges: ValidatableEdge[] = [];
  for (const edge of graph.edges) {
    const sourceMissing = !nodeById.has(edge.sourceNodeId);
    const targetMissing = !nodeById.has(edge.targetNodeId);
    if (sourceMissing || targetMissing) {
      push({
        severity: "error",
        code: "dangling_edge",
        message:
          `A connection points at a step that no longer exists. Delete the ` +
          `connection and reconnect the steps.`,
        nodeId: sourceMissing ? edge.targetNodeId : edge.sourceNodeId,
      });
      continue;
    }
    liveEdges.push(edge);
  }

  const outgoing = new Map<string, ValidatableEdge[]>();
  const incoming = new Map<string, ValidatableEdge[]>();
  for (const edge of liveEdges) {
    pushInto(outgoing, edge.sourceNodeId, edge);
    pushInto(incoming, edge.targetNodeId, edge);
  }

  // ── triggers ──────────────────────────────────────────────────────────────
  const triggerNodes = [...nodeById.values()].filter(
    (n) => defByNodeId.get(n.id)?.category === "trigger",
  );

  if (triggerNodes.length === 0) {
    push({
      severity: "error",
      code: "no_trigger",
      message:
        `Nothing starts this automation. Add a trigger step to say what should ` +
        `set it off.`,
    });
  }

  if (triggerNodes.length > MAX_TRIGGERS) {
    push({
      severity: "warning",
      code: "too_many_triggers",
      message:
        `This automation has ${triggerNodes.length} triggers. That works, but it ` +
        `is hard to follow — consider splitting it up.`,
    });
  }

  const actionNodes = [...nodeById.values()].filter((n) => {
    const def = defByNodeId.get(n.id);
    return def && def.category !== "trigger" && def.category !== "logic";
  });
  if (triggerNodes.length > 0 && actionNodes.length === 0) {
    push({
      severity: "warning",
      code: "no_action",
      message:
        `This automation does not do anything yet — it has a trigger but no ` +
        `action steps.`,
    });
  }

  // ── per-node rules ────────────────────────────────────────────────────────
  for (const node of nodeById.values()) {
    const def = defByNodeId.get(node.id);
    if (!def) continue;
    const parameters = node.nodeConfig.parameters ?? {};

    // Required fields. `getMissingRequiredFields` skips fields hidden by
    // `displayOptions`, so choosing "Plain text" never blocks a publish on the
    // HTML body field the form is not showing.
    const missing = getMissingRequiredFields(def, parameters);
    for (const field of missing) {
      const property = def.properties.find((p) => p.name === field);
      const displayName = property?.displayName ?? field;

      // A disabled step does not run, so an empty field in one cannot break
      // anything — but silently publishing it means re-enabling the step later
      // ships an invalid node with no warning. Downgrade, never drop.
      push({
        severity: node.nodeConfig.disabled ? "warning" : "error",
        code: node.nodeConfig.disabled ? "disabled_node_incomplete" : "missing_required_field",
        message: node.nodeConfig.disabled
          ? `"${labelOf(node)}" is switched off and is missing "${displayName}". ` +
            `Fill it in before switching the step back on.`
          : `"${labelOf(node)}" needs "${displayName}" filled in.`,
        nodeId: node.id,
        field,
      });
    }

    // Orphans. A non-trigger with nothing feeding it can never run, and the
    // usual cause is deleting the step above it.
    if (def.category !== "trigger" && (incoming.get(node.id)?.length ?? 0) === 0) {
      push({
        severity: "error",
        code: "orphan_node",
        message:
          `"${labelOf(node)}" is not connected to anything above it, so it will ` +
          `never run. Connect it, or delete it.`,
        nodeId: node.id,
      });
    }

    // Unconnected branch outputs. Only for nodes with MORE THAN ONE output —
    // a single-output step with nothing after it is just the end of the chain,
    // which is normal and must not be flagged. A branch with a dead end is not:
    // the author chose to split and left one side going nowhere.
    // `outputsFor`, not `def.outputs` — a Do-several-things declares no fixed
    // outputs at all and gets them from its own configuration, so reading the
    // static field here would see zero branches and never flag a dead one.
    const outputs = outputsFor(def, parameters);
    if (outputs.length > 1) {
      const connected = new Set(
        (outgoing.get(node.id) ?? []).map((e) => e.sourceHandle),
      );
      for (const output of outputs) {
        if (!connected.has(output.id)) {
          push({
            severity: "error",
            code: "unconnected_branch_output",
            message:
              `"${labelOf(node)}" has nothing connected to its "${output.label}" ` +
              `branch. Add a step there, or connect it to an existing one.`,
            nodeId: node.id,
            field: output.id,
          });
        }
      }
    }

    // A `goto` whose target was deleted. The target is a node id held in a
    // parameter, so nothing else in the graph refers to it and nothing else
    // would notice.
    if (node.nodeType === NODE.goto) {
      const target = parameters.targetNodeId;
      if (typeof target === "string" && target && !nodeById.has(target)) {
        push({
          severity: "error",
          code: "goto_target_missing",
          message:
            `"${labelOf(node)}" jumps to a step that has been deleted. Pick a new ` +
            `step to jump to.`,
          nodeId: node.id,
          field: "targetNodeId",
        });
      }
    }
  }

  // ── reachability, and the subjects each step can actually receive ─────────
  // One traversal answers two questions: which nodes a trigger can reach, and
  // which subject types arrive there. Doing it per trigger rather than over the
  // whole graph is what makes the subject rule correct when an automation has
  // two triggers on different record types.
  const reachable = new Set<string>();
  const subjectsAt = new Map<string, Set<SubjectType>>();
  /** True when at least one trigger's subject could not be determined. */
  let subjectUnknown = false;

  for (const trigger of triggerNodes) {
    const def = defByNodeId.get(trigger.id);
    if (!def) continue;

    const provided = subjectsProvidedBy(def, trigger.nodeConfig.parameters ?? {});
    if (provided === null) subjectUnknown = true;

    for (const visitedId of walkFrom(trigger.id, outgoing)) {
      reachable.add(visitedId);
      if (provided) {
        let set = subjectsAt.get(visitedId);
        if (!set) subjectsAt.set(visitedId, (set = new Set()));
        for (const s of provided) set.add(s);
      }
    }
  }

  for (const node of nodeById.values()) {
    const def = defByNodeId.get(node.id);
    if (!def) continue;
    const parameters = node.nodeConfig.parameters ?? {};

    if (def.category !== "trigger" && !reachable.has(node.id)) {
      // A warning, not an error: the node may be connected to something that is
      // itself orphaned, and we have already reported that as the real cause.
      push({
        severity: "warning",
        code: "unreachable_node",
        message:
          `Nothing can reach "${labelOf(node)}" from a trigger, so it will never ` +
          `run.`,
        nodeId: node.id,
      });
      continue;
    }

    // "This step needs a job, and your trigger provides a customer."
    //
    // Only fires when the answer is KNOWN and DISJOINT. If any trigger's subject
    // could not be determined, we cannot prove a mismatch and say nothing — a
    // false publish-blocker is far worse than a missed warning, because the
    // author has no way around it.
    if (def.requiresSubject && def.requiresSubject.length > 0 && !subjectUnknown) {
      const available = subjectsAt.get(node.id);
      if (available && available.size > 0) {
        const ok = def.requiresSubject.some((s) => available.has(s));
        if (!ok) {
          push({
            severity: "error",
            code: "subject_mismatch",
            message:
              `"${labelOf(node)}" works on ${listOf(def.requiresSubject)}, but the ` +
              `trigger above it provides ${listOf([...available])}. This step could ` +
              `never run.`,
            nodeId: node.id,
          });
        }
      }
    }

    // ── fields that name a variable rather than hold a value ────────────────
    //
    // Two field types do this: `dateVariable` (a Wait's anchor) and every rule
    // inside a `conditions` field. Both store a bare path, and both fail the
    // same silent way — an unresolvable path is not an error at run time, it is
    // a comparison that cannot be answered, and an unanswerable comparison goes
    // down "No" **by design**, so the automation quietly does nothing forever.
    //
    // `ResolveVariable` names this exact case in its own docstring ("a typo, or
    // one this trigger cannot provide") and nothing upstream was checking for
    // it. Both are answerable here, at publish, with the author looking at the
    // step — which is the only moment anyone can act on it.
    for (const property of def.properties) {
      if (!isPropertyVisible(property, parameters)) continue;

      if (property.type === "dateVariable") {
        checkVariablePath(node, property.name, parameters[property.name], {
          types: property.typeOptions?.variableTypes ?? ["date", "datetime"],
          expected: "a date",
        });
        continue;
      }

      if (property.type === "conditions") {
        const rules = parameters[property.name];
        if (!Array.isArray(rules)) continue;
        for (const rule of rules) {
          if (!rule || typeof rule !== "object") continue;
          // Any type is fine in a comparison — `isEmpty` on a string and
          // `greaterThan` on a number are equally valid.
          checkVariablePath(node, property.name, (rule as { variable?: unknown }).variable);
        }
      }
    }
  }

  /**
   * One path, checked three ways: it exists, it is the right kind of thing, and
   * this trigger actually provides it.
   *
   * Declared here rather than at module scope because it closes over `push`,
   * `subjectsAt` and `subjectUnknown` — passing those through would be four
   * arguments of ceremony around one rule.
   *
   * **Silent on an empty path.** A rule row the author has added but not filled
   * in yet is a normal intermediate state, and `missing_required_field` already
   * covers a field left wholly blank. Reporting both would put two errors on one
   * mistake and block publishing on a half-typed thought.
   */
  function checkVariablePath(
    node: ValidatableNode,
    field: string,
    raw: unknown,
    options: { types?: readonly string[]; expected?: string } = {},
  ): void {
    if (typeof raw !== "string") return;
    const path = raw.trim();
    if (!path) return;

    const variable = VARIABLE_MAP.get(path);
    if (!variable) {
      const [suggestion] = suggestVariables(path, 1);
      push({
        severity: "error",
        code: "unknown_variable",
        message:
          `"${labelOf(node)}" refers to "${path}", which is not something this ` +
          `automation can read.` +
          (suggestion ? ` Did you mean "${suggestion}"?` : ""),
        nodeId: node.id,
        field,
      });
      return;
    }

    if (options.types && !options.types.includes(variable.type)) {
      push({
        severity: "error",
        code: "unknown_variable",
        message:
          `"${labelOf(node)}" needs ${options.expected ?? "a different kind of value"}, ` +
          `but "${variable.label}" is ` +
          `${variable.type === "time" ? "a time of day with no date attached" : `a ${variable.type}`}.`,
        nodeId: node.id,
        field,
      });
      return;
    }

    // Same "known and disjoint" caution as `subject_mismatch`: a variable with
    // no `providedBy` is universal, and an unknown subject proves nothing. A
    // false publish-blocker is far worse than a missed warning, because the
    // author has no way around it.
    if (!variable.providedBy || subjectUnknown) return;
    const available = subjectsAt.get(node.id);
    if (!available || available.size === 0) return;
    if (variable.providedBy.some((s) => available.has(s))) return;

    push({
      severity: "error",
      code: "unknown_variable",
      message:
        `"${labelOf(node)}" uses "${variable.label}", but the trigger above it ` +
        `provides ${listOf([...available])} — so that value is never there to read.`,
      nodeId: node.id,
      field,
    });
  }

  // ── P6 shapes: goto after a split, delay inside a loop ────────────────────
  // Both are no-ops until those node types exist. Written now so the rule ships
  // with the node instead of being remembered afterwards.
  const splitNodes = [...nodeById.values()].filter((n) => n.nodeType === NODE.split);
  if (splitNodes.length > 0) {
    const downstreamOfSplit = new Set<string>();
    for (const split of splitNodes) {
      for (const id of walkFrom(split.id, outgoing)) downstreamOfSplit.add(id);
    }
    for (const node of nodeById.values()) {
      if (node.nodeType === NODE.goto && downstreamOfSplit.has(node.id)) {
        push({
          severity: "warning",
          code: "goto_after_split",
          message:
            `"${labelOf(node)}" jumps to another step from inside a branch. Which ` +
            `branch continues afterwards is hard to predict — consider restructuring.`,
          nodeId: node.id,
        });
      }
    }
  }

  // ── A merge that can never complete ──────────────────────────────────────
  // `logic.merge` is the one node with AND semantics: it waits for EVERY
  // incoming edge. Feed it both sides of an Only if and it waits forever for the
  // branch that did not run — the automation stops with no error and no failed
  // step, which is the worst way for something to fail. An error, not a warning:
  // there is no version of this that works.
  for (const merge of nodeById.values()) {
    if (merge.nodeType !== NODE.merge) continue;

    const feeders = incoming.get(merge.id) ?? [];
    if (feeders.length < 2) continue;

    const clash = exclusiveBranchClash(feeders, outgoing, nodeById);
    if (clash) {
      push({
        severity: "error",
        code: "merge_never_completes",
        message:
          `"${labelOf(merge)}" waits for every branch above it, but two of them ` +
          `come from different sides of "${clash}" — only one of those ever runs, ` +
          `so this step would wait forever. Connect just one side, or remove it.`,
        nodeId: merge.id,
      });
    }
  }

  for (const loop of nodeById.values()) {
    if (loop.nodeType !== NODE.loop) continue;
    // The loop body is whatever hangs off the "loop" handle.
    const bodyStart = (outgoing.get(loop.id) ?? [])
      .filter((e) => e.sourceHandle === "loop")
      .map((e) => e.targetNodeId);
    const body = new Set<string>();
    for (const start of bodyStart) {
      for (const id of walkFrom(start, outgoing, new Set([loop.id]))) body.add(id);
    }
    for (const id of body) {
      const node = nodeById.get(id);
      if (node?.nodeType === NODE.delay) {
        push({
          severity: "error",
          code: "delay_in_loop",
          message:
            `"${labelOf(node)}" is a wait inside a repeating step. A loop that ` +
            `pauses can run for weeks and hold up everything behind it — move the ` +
            `wait outside the loop.`,
          nodeId: id,
        });
      }
    }
  }

  return {
    errors: issues.filter((i) => i.severity === "error"),
    warnings: issues.filter((i) => i.severity === "warning"),
  };
}

/** Convenience for the publish path and the Publish button. */
export function canPublish(graph: ValidatableGraph): boolean {
  return validateGraph(graph).errors.length === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which subject types a trigger hands to the steps beneath it.
 *
 * Three sources, in priority order, because triggers genuinely differ:
 *
 *   1. `requiresSubject` on the definition — `trigger.job.completed` is always
 *      about a job.
 *   2. A `subjectType` **parameter** — `trigger.manual` has no fixed subject;
 *      the author picks one, and it is stored in the node's parameters. Reading
 *      only the definition would make every manual automation look like a
 *      mismatch and block publishing it.
 *   3. The event registry — `WORKFLOW_EVENTS[type].subject`.
 *
 * Returns `null` for "cannot tell", which callers must treat as "prove nothing".
 */
export function subjectsProvidedBy(
  def: NodeDefinition,
  parameters: Record<string, unknown>,
): SubjectType[] | null {
  if (def.requiresSubject && def.requiresSubject.length > 0) {
    return [...def.requiresSubject];
  }

  const chosen = parameters.subjectType;
  if (typeof chosen === "string" && chosen) {
    return [chosen as SubjectType];
  }

  if (def.triggerEvents && def.triggerEvents.length > 0) {
    const subjects = new Set<SubjectType>();
    let sawUnknown = false;
    for (const eventType of def.triggerEvents) {
      const event = getEventDefinition(eventType);
      if (!event || event.subject === null) sawUnknown = true;
      else subjects.add(event.subject);
    }
    // A trigger listening for one event with a subject and one without provides
    // an unknown set, not a partial one.
    if (sawUnknown) return null;
    if (subjects.size > 0) return [...subjects];
  }

  return null;
}

/** Every node reachable from `start`, inclusive. Cycle-safe. */
function walkFrom(
  start: string,
  outgoing: Map<string, ValidatableEdge[]>,
  seed?: Set<string>,
): Set<string> {
  const seen = new Set<string>(seed);
  const out = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.add(id);
    for (const edge of outgoing.get(id) ?? []) queue.push(edge.targetNodeId);
  }
  return out;
}

/**
 * Do two of these edges come from mutually exclusive sides of one branch?
 *
 * Returns the branching node's label if so. The test is per branching node:
 * take the set of nodes reachable from each of its outputs, subtract everything
 * reachable from more than one — a node both sides can reach always runs, so it
 * cannot cause a hang — and see whether two different feeders land in two
 * different remainders.
 *
 * The direct case is checked first and separately: two edges leaving the same
 * node by different handles are exclusive with no reachability analysis at all,
 * and that is also the shape somebody draws by hand.
 */
function exclusiveBranchClash(
  feeders: ValidatableEdge[],
  outgoing: Map<string, ValidatableEdge[]>,
  nodeById: Map<string, ValidatableNode>,
): string | null {
  const label = (id: string) => {
    const node = nodeById.get(id);
    return node ? labelOf(node) : "a branching step";
  };

  /**
   * Does this node pick ONE output, or leave by all of them?
   *
   * A fan-out's branches all run, so two of them meeting at a merge is exactly
   * what a merge is for — not a deadlock. Read off the definition rather than
   * inferred from the output count, because those are different facts and
   * guessing rejected the only publishable merge there is.
   */
  const isExclusive = (nodeId: string) => {
    const node = nodeById.get(nodeId);
    const def = node ? getDefinition(node.nodeType) : undefined;
    return (def?.outputMode ?? "exclusive") === "exclusive";
  };

  // Direct: both wires leave the same step by different outputs.
  const handlesBySource = new Map<string, Set<string>>();
  for (const edge of feeders) {
    const set = handlesBySource.get(edge.sourceNodeId) ?? new Set<string>();
    set.add(edge.sourceHandle || "main");
    handlesBySource.set(edge.sourceNodeId, set);
  }
  for (const [sourceId, handles] of handlesBySource) {
    if (handles.size > 1 && isExclusive(sourceId)) return label(sourceId);
  }

  // Indirect: the feeders sit somewhere downstream of one branching node.
  for (const [branchId, edges] of outgoing) {
    if (!isExclusive(branchId)) continue;
    const byHandle = new Map<string, ValidatableEdge[]>();
    for (const edge of edges) pushInto(byHandle, edge.sourceHandle || "main", edge);
    if (byHandle.size < 2) continue;

    const reachByHandle = new Map<string, Set<string>>();
    for (const [handle, handleEdges] of byHandle) {
      const reached = new Set<string>();
      for (const edge of handleEdges) {
        // Seeded with the branch itself so a cycle back through it terminates.
        for (const id of walkFrom(edge.targetNodeId, outgoing, new Set([branchId]))) {
          reached.add(id);
        }
      }
      reachByHandle.set(handle, reached);
    }

    // A node more than one side can reach always runs, whichever way the branch
    // goes, so it is not what makes a merge hang.
    const shared = new Set<string>();
    const handles = [...reachByHandle.keys()];
    for (let i = 0; i < handles.length; i += 1) {
      for (let j = i + 1; j < handles.length; j += 1) {
        for (const id of reachByHandle.get(handles[i])!) {
          if (reachByHandle.get(handles[j])!.has(id)) shared.add(id);
        }
      }
    }

    const handleOfFeeder = new Map<string, string>();
    for (const edge of feeders) {
      for (const [handle, reached] of reachByHandle) {
        if (reached.has(edge.sourceNodeId) && !shared.has(edge.sourceNodeId)) {
          handleOfFeeder.set(edge.id, handle);
        }
      }
    }
    if (new Set(handleOfFeeder.values()).size > 1) return label(branchId);
  }

  return null;
}

function pushInto<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** The author's name for a step, falling back to the node type. */
function labelOf(node: ValidatableNode): string {
  const label = node.nodeConfig.label;
  if (typeof label === "string" && label.trim()) return label.trim();
  return getDefinition(node.nodeType)?.displayName ?? node.nodeType;
}

/** "jobs", "jobs or invoices", "jobs, invoices or quotes" — for a person to read. */
function listOf(subjects: readonly string[]): string {
  const words = subjects.map((s) => s.replace(/_/g, " ") + "s");
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}
