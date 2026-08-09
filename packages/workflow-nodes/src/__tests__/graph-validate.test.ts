import { describe, expect, it } from "vitest";

import { EXECUTION_LIMITS } from "../limits.js";
import { getMissingRequiredFields, type NodeDefinition } from "../node-definition.js";
import {
  subjectsProvidedBy,
  validateGraph,
  type GraphIssueCode,
  type ValidatableEdge,
  type ValidatableGraph,
  type ValidatableNode,
} from "../graph/validate.js";

/**
 * Graph validation — docs/workflow-automation/wf-08 §8.7.
 *
 * These rules decide whether Publish is allowed, and they run in two places
 * that must agree: the browser (to disable the button) and the API (to refuse
 * the request). This file tests the shared implementation both call.
 *
 * The bias throughout is that a **false block is worse than a missed warning**.
 * A warning the author never sees costs them a debugging session; an error they
 * cannot clear makes the feature unusable and there is no way around it from
 * inside the product.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Builders — real registry node types, so a definition change breaks these
// ─────────────────────────────────────────────────────────────────────────────

let seq = 0;
/** Deterministic ids: readable in failure output, and stable across runs. */
const uid = (label: string) => `${label}-${(seq++).toString().padStart(4, "0")}`;

function node(
  nodeType: string,
  overrides: Partial<ValidatableNode> & {
    parameters?: Record<string, unknown>;
    label?: string;
    disabled?: boolean;
  } = {},
): ValidatableNode {
  return {
    id: overrides.id ?? uid("n"),
    nodeType,
    nodeConfig: {
      label: overrides.label ?? nodeType,
      parameters: overrides.parameters ?? {},
      ...(overrides.disabled !== undefined ? { disabled: overrides.disabled } : {}),
    },
  };
}

function edge(
  source: ValidatableNode,
  target: ValidatableNode,
  handle = "main",
): ValidatableEdge {
  return {
    id: uid("e"),
    sourceNodeId: source.id,
    sourceHandle: handle,
    targetNodeId: target.id,
  };
}

const graph = (
  nodes: ValidatableNode[],
  edges: ValidatableEdge[] = [],
): ValidatableGraph => ({ nodes, edges });

const codes = (issues: { code: GraphIssueCode }[]) => issues.map((i) => i.code);

/** A manual trigger on jobs, plus a note step. The minimum valid automation. */
function validJobAutomation() {
  const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
  const action = node("customer.addNote", { parameters: { content: "Hello" } });
  return { trigger, action, graph: graph([trigger, action], [edge(trigger, action)]) };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("a valid automation", () => {
  it("publishes with no errors", () => {
    const { graph: g } = validJobAutomation();
    const result = validateGraph(g);
    expect(result.errors).toEqual([]);
  });
});

describe("rules that block a publish", () => {
  it("refuses a graph with no trigger", () => {
    const action = node("customer.addNote", { parameters: { content: "x" } });
    const result = validateGraph(graph([action]));
    expect(codes(result.errors)).toContain("no_trigger");
  });

  it("names the step and the field when a required value is empty", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    // `content` is required on customer.addNote and is not supplied.
    const action = node("customer.addNote", { label: "Log the visit", parameters: {} });
    const result = validateGraph(graph([trigger, action], [edge(trigger, action)]));

    const issue = result.errors.find((e) => e.code === "missing_required_field");
    expect(issue).toBeDefined();
    // S-4: every error must be able to select its node, or the dialog is a
    // list the user cannot navigate to.
    expect(issue!.nodeId).toBe(action.id);
    expect(issue!.field).toBe("content");
    expect(issue!.message).toContain("Log the visit");
  });

  it("refuses a step nothing connects to", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const orphan = node("customer.addNote", { parameters: { content: "x" } });
    const result = validateGraph(graph([trigger, orphan]));   // no edge
    expect(codes(result.errors)).toContain("orphan_node");
  });

  it("refuses an edge pointing at a deleted step", () => {
    const { trigger, action, graph: g } = validJobAutomation();
    const dangling: ValidatableEdge = {
      id: uid("e"),
      sourceNodeId: action.id,
      sourceHandle: "main",
      targetNodeId: "00000000-0000-0000-0000-000000000000",
    };
    const result = validateGraph(graph([trigger, action], [...g.edges, dangling]));
    expect(codes(result.errors)).toContain("dangling_edge");
  });

  it("refuses an unknown node type", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const bogus = node("nope.doesNotExist");
    const result = validateGraph(graph([trigger, bogus], [edge(trigger, bogus)]));
    expect(codes(result.errors)).toContain("unknown_node_type");
  });

  it("refuses more steps than the engine will run", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const many = Array.from({ length: EXECUTION_LIMITS.MAX_NODES_PER_WORKFLOW + 1 }, () =>
      node("customer.addNote", { parameters: { content: "x" } }),
    );
    const result = validateGraph(
      graph([trigger, ...many], many.map((n) => edge(trigger, n))),
    );
    expect(codes(result.errors)).toContain("too_many_nodes");
  });

  it("reports a duplicated node id rather than silently keeping one", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const a = node("customer.addNote", { id: "dup", parameters: { content: "x" } });
    const b = node("customer.addNote", { id: "dup", parameters: { content: "y" } });
    const result = validateGraph(graph([trigger, a, b], [edge(trigger, a)]));
    expect(codes(result.errors)).toContain("duplicate_node_id");
  });
});

describe("the subject rule — the one most likely to block wrongly", () => {
  it("reads a manual trigger's subject from its PARAMETERS, not its definition", () => {
    // trigger.manual declares no `requiresSubject` — the author picks the record
    // type and it is stored in the node's parameters. Reading only the
    // definition would make every manual automation look like a mismatch, and
    // no manual automation could ever be published.
    const def: NodeDefinition = {
      node: "trigger.manual",
      version: 1,
      displayName: "Run Manually",
      description: "",
      icon: "IconPlayerPlay",
      category: "trigger",
      inputs: [],
      outputs: [{ id: "main", label: "Then" }],
      properties: [],
      triggerEvents: ["manual.run"],
    };
    expect(subjectsProvidedBy(def, { subjectType: "invoice" })).toEqual(["invoice"]);
  });

  it("says nothing when the trigger's subject cannot be determined", () => {
    const def: NodeDefinition = {
      node: "trigger.unknown",
      version: 1,
      displayName: "",
      description: "",
      icon: "x",
      category: "trigger",
      inputs: [],
      outputs: [],
      properties: [],
    };
    // null means "prove nothing" — not "provides nothing".
    expect(subjectsProvidedBy(def, {})).toBeNull();
  });

  it("does not block a manual job automation feeding a customer step", () => {
    // customer.addNote accepts every subject type, so this must publish. A
    // naive implementation that compared against the trigger's own
    // `requiresSubject` would refuse it.
    const { graph: g } = validJobAutomation();
    expect(codes(validateGraph(g).errors)).not.toContain("subject_mismatch");
  });
});

describe("rules that warn but do not block", () => {
  it("warns, and does not block, when a step is switched off and incomplete", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const off = node("customer.addNote", { parameters: {}, disabled: true });
    const result = validateGraph(graph([trigger, off], [edge(trigger, off)]));

    // A disabled step cannot break a run, so it must not block Publish — but
    // dropping the issue entirely means re-enabling it later ships an invalid
    // node with no warning at all.
    expect(codes(result.errors)).not.toContain("missing_required_field");
    expect(codes(result.warnings)).toContain("disabled_node_incomplete");
  });

  it("warns when an automation has a trigger but does nothing", () => {
    const trigger = node("trigger.manual", { parameters: { subjectType: "job" } });
    const result = validateGraph(graph([trigger]));
    expect(codes(result.warnings)).toContain("no_action");
    expect(result.errors).toEqual([]);
  });
});

describe("getMissingRequiredFields respects displayOptions", () => {
  const def: NodeDefinition = {
    node: "test.node",
    version: 1,
    displayName: "Test",
    description: "",
    icon: "x",
    category: "crm",
    inputs: [{ id: "main" }],
    outputs: [{ id: "main", label: "Then" }],
    properties: [
      { displayName: "Mode", name: "mode", type: "options", default: "plain" },
      {
        displayName: "HTML body",
        name: "htmlBody",
        type: "text",
        required: true,
        displayOptions: { show: { mode: ["html"] } },
      },
    ],
  };

  it("does not report a required field the form is not showing", () => {
    // The concrete bug this guards: choosing "Plain text" hides the HTML body,
    // and a validator ignoring displayOptions blocks Publish forever on a field
    // that appears nowhere on screen.
    expect(getMissingRequiredFields(def, { mode: "plain" })).toEqual([]);
  });

  it("reports it once the field is visible", () => {
    expect(getMissingRequiredFields(def, { mode: "html" })).toEqual(["htmlBody"]);
  });

  it("still treats 0 and false as supplied values", () => {
    const numeric: NodeDefinition = {
      ...def,
      properties: [
        { displayName: "Minimum", name: "min", type: "number", required: true },
      ],
    };
    expect(getMissingRequiredFields(numeric, { min: 0 })).toEqual([]);
    expect(getMissingRequiredFields(numeric, { min: false })).toEqual([]);
    expect(getMissingRequiredFields(numeric, {})).toEqual(["min"]);
  });
});

describe("fan-out, and the merge rule that nearly banned it", () => {
  /** Manual ─▶ split ─┬─▶ note ─┐ */
  /**                  └─▶ note ─┴─▶ merge ─▶ note */
  function fanOutIntoMerge(branchCount = 2) {
    const trigger = node("trigger.manual", { parameters: { subjectType: "customer" } });
    const split = node("split.branch", { parameters: { branchCount } });
    const branches = Array.from({ length: branchCount }, (_u, i) =>
      node("customer.addNote", { parameters: { content: `Branch ${i + 1}` } }),
    );
    const merge = node("logic.merge");
    const after = node("customer.addNote", { parameters: { content: "After" } });

    return graph(
      [trigger, split, ...branches, merge, after],
      [
        edge(trigger, split),
        ...branches.map((b, i) => edge(split, b, `branch${i + 1}`)),
        ...branches.map((b) => edge(b, merge)),
        edge(merge, after),
      ],
    );
  }

  it("publishes a merge fed by a split", () => {
    // The regression that mattered. `merge_never_completes` looked for two
    // feeders leaving one node by different handles — true of an Only if, where
    // one side never runs, and equally true of a fan-out, where both always do.
    // So the first fan-out anyone drew could not be published, and the rule
    // banned the only shape a merge exists for.
    const result = validateGraph(fanOutIntoMerge());
    expect(codes(result.errors)).not.toContain("merge_never_completes");
    expect(result.errors).toEqual([]);
  });

  it("publishes a three-way fan-out into a merge", () => {
    const result = validateGraph(fanOutIntoMerge(3));
    expect(result.errors).toEqual([]);
  });

  it("still refuses a merge fed by both sides of an Only if", () => {
    // The rule has to keep working. This shape really does hang: only one side
    // of a condition runs, and a merge waits for every incoming edge.
    const trigger = node("trigger.manual", { parameters: { subjectType: "customer" } });
    const iff = node("condition.if", {
      parameters: {
        combinator: "and",
        rules: [{ path: "customer.email", operator: "isNotEmpty", value: "" }],
      },
    });
    const yes = node("customer.addNote", { parameters: { content: "Yes" } });
    const no = node("customer.addNote", { parameters: { content: "No" } });
    const merge = node("logic.merge");
    const after = node("customer.addNote", { parameters: { content: "After" } });

    const result = validateGraph(
      graph(
        [trigger, iff, yes, no, merge, after],
        [
          edge(trigger, iff),
          edge(iff, yes, "true"),
          edge(iff, no, "false"),
          edge(yes, merge),
          edge(no, merge),
          edge(merge, after),
        ],
      ),
    );
    expect(codes(result.errors)).toContain("merge_never_completes");
  });

  it("flags a branch left dangling, using the outputs the config produces", () => {
    // `unconnected_branch_output` reads `outputsFor`, so a Do-several-things
    // configured for three branches must report the third as dead even though
    // the definition declares no outputs at all.
    const trigger = node("trigger.manual", { parameters: { subjectType: "customer" } });
    const split = node("split.branch", { parameters: { branchCount: 3 } });
    const a = node("customer.addNote", { parameters: { content: "A" } });
    const b = node("customer.addNote", { parameters: { content: "B" } });

    const result = validateGraph(
      graph(
        [trigger, split, a, b],
        [edge(trigger, split), edge(split, a, "branch1"), edge(split, b, "branch2")],
      ),
    );

    const dead = result.errors.filter((i) => i.code === "unconnected_branch_output");
    expect(dead).toHaveLength(1);
    expect(dead[0].field).toBe("branch3");
  });
});
