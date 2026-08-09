import { describe, expect, it } from "vitest";

import { getDefinition } from "../catalog.js";
import { NODE_DEFINITIONS } from "../registry/index.js";
import { VARIABLE_MAP, variablesForSubject } from "../variables/index.js";
import { isPropertyVisible, type NodeProperty } from "../node-definition.js";
import { validateGraph, type ValidatableGraph } from "../graph/validate.js";
import { WORKFLOW_TEMPLATES } from "../templates/catalogue.js";

/**
 * `dateVariable` fields — the seam between a node's config and the variable
 * table.
 *
 * A `dateVariable` stores a **path**, not a value, so it fails in a way no
 * other field type can: the path can be perfectly well-formed, save cleanly,
 * publish cleanly, and resolve to nothing at run time because the trigger above
 * it never provided that subject. The symptom is a wait that silently never
 * happens, which is indistinguishable from an automation nobody triggered.
 *
 * That is the same shape as the defects the last three audits found — a value
 * declared in one place and consumed in another with nothing asserting the two
 * agree — so the round trip is asserted here rather than assumed.
 */

/**
 * Every `dateVariable` property across the whole registry.
 *
 * Walks `NODE_DEFINITIONS` rather than a hardcoded list, so the second node to
 * grow one of these is covered without anybody remembering to come back here.
 */
function dateVariableProperties(): { node: string; property: NodeProperty }[] {
  const found: { node: string; property: NodeProperty }[] = [];
  for (const def of NODE_DEFINITIONS) {
    for (const property of def.properties) {
      if (property.type === "dateVariable") found.push({ node: def.node, property });
    }
  }
  return found;
}

describe("dateVariable fields", () => {
  it("declare only variable types that exist and are dates", () => {
    const properties = dateVariableProperties();
    expect(properties.length).toBeGreaterThan(0);

    for (const { node, property } of properties) {
      const allowed = property.typeOptions?.variableTypes ?? ["date", "datetime"];
      // Not a tautology: `variableTypes` is a free-text union in the definition
      // and the picker filters `VARIABLES` by it. A type nobody declares means
      // an empty dropdown and a step that can never be configured.
      const offered = [...VARIABLE_MAP.values()].filter((v) =>
        (allowed as readonly string[]).includes(v.type),
      );
      expect(offered.length, `${node}.${property.name} offers nothing`).toBeGreaterThan(0);
    }
  });

  it("are reachable from at least one trigger subject", () => {
    // A field nothing can fill is worse than a missing field: the form renders,
    // the required marker shows, and there is no way to satisfy it.
    for (const { node, property } of dateVariableProperties()) {
      const allowed = property.typeOptions?.variableTypes ?? ["date", "datetime"];
      const reachable = (["booking", "job", "invoice", "quote"] as const).some(
        (subject) =>
          variablesForSubject(subject).some((v) =>
            (allowed as readonly string[]).includes(v.type),
          ),
      );
      expect(reachable, `${node}.${property.name}`).toBe(true);
    }
  });
});

describe("delay.wait untilField mode", () => {
  const def = getDefinition("delay.wait");

  it("shows the record-date fields only in untilField mode", () => {
    expect(def).toBeDefined();
    if (!def) return;

    const params = { mode: "untilField" };
    const visible = def.properties
      .filter((p) => isPropertyVisible(p, params))
      .map((p) => p.name);

    expect(visible).toContain("dateField");
    expect(visible).toContain("offsetDirection");
    expect(visible).toContain("ifPassed");
    // The other two modes' fields must be hidden, or `getMissingRequiredFields`
    // reports a required `duration` the form is not showing and Publish is
    // blocked on a control that appears nowhere on screen.
    expect(visible).not.toContain("duration");
    expect(visible).not.toContain("untilDate");
  });

  it("hides the offset when the wait lands on the date itself", () => {
    if (!def) return;
    const visible = def.properties
      .filter((p) => isPropertyVisible(p, { mode: "untilField", offsetDirection: "on" }))
      .map((p) => p.name);
    expect(visible).not.toContain("offset");
  });

  it("does not offer a working-hours deferral, because the author named an hour", () => {
    if (!def) return;
    const visible = def.properties
      .filter((p) => isPropertyVisible(p, { mode: "untilField" }))
      .map((p) => p.name);
    expect(visible).not.toContain("resumeDuring");
  });
});

describe("the validator catches what only a path-valued field can get wrong", () => {
  function graphWith(parameters: Record<string, unknown>): ValidatableGraph {
    return {
      nodes: [
        {
          id: "t",
          nodeType: "trigger.booking.created",
          nodeConfig: { label: "A booking is made", parameters: {} },
        },
        {
          id: "w",
          nodeType: "delay.wait",
          nodeConfig: { label: "Wait", parameters },
        },
      ],
      edges: [
        { id: "e", sourceNodeId: "t", sourceHandle: "main", targetNodeId: "w" },
      ],
    };
  }

  /** The same graph, but the second node is an Only if with one rule. */
  function graphWithRule(rule: Record<string, unknown>): ValidatableGraph {
    return {
      nodes: [
        {
          id: "t",
          nodeType: "trigger.booking.created",
          nodeConfig: { label: "A booking is made", parameters: {} },
        },
        {
          id: "c",
          nodeType: "condition.if",
          nodeConfig: {
            label: "Only if",
            parameters: { combinator: "and", rules: [rule] },
          },
        },
        { id: "y", nodeType: "logic.stop", nodeConfig: { parameters: {} } },
        { id: "n", nodeType: "logic.stop", nodeConfig: { parameters: {} } },
      ],
      edges: [
        { id: "e1", sourceNodeId: "t", sourceHandle: "main", targetNodeId: "c" },
        { id: "e2", sourceNodeId: "c", sourceHandle: "true", targetNodeId: "y" },
        { id: "e3", sourceNodeId: "c", sourceHandle: "false", targetNodeId: "n" },
      ],
    };
  }

  const base = {
    mode: "untilField",
    offsetDirection: "before",
    offset: { amount: 1, unit: "days" },
    atTime: "09:00",
    ifPassed: "skip",
  };

  it("rejects a path that is not a declared variable", () => {
    const { errors } = validateGraph(graphWith({ ...base, dateField: "booking.dat" }));
    const issue = errors.find((i) => i.code === "unknown_variable");
    expect(issue).toBeDefined();
    // The suggestion is the whole point — a typo'd path is otherwise a wait
    // that never fires and no way to see why.
    expect(issue?.message).toContain("booking.date");
  });

  it("rejects a date the trigger above it does not provide", () => {
    // Well-formed, real, and unreachable: a booking trigger carries no invoice.
    const { errors } = validateGraph(graphWith({ ...base, dateField: "invoice.dueDate" }));
    expect(errors.some((i) => i.code === "unknown_variable")).toBe(true);
  });

  it("rejects a time-of-day where a date is required", () => {
    // `booking.startTime` is provided by this exact trigger and is still wrong:
    // it names an hour with no day attached, so there is no moment to wait for.
    const { errors } = validateGraph(graphWith({ ...base, dateField: "booking.startTime" }));
    expect(errors.some((i) => i.code === "unknown_variable")).toBe(true);
  });

  it("accepts a date the trigger really provides", () => {
    const { errors } = validateGraph(graphWith({ ...base, dateField: "booking.date" }));
    expect(errors.filter((i) => i.code === "unknown_variable")).toHaveLength(0);
  });

  // The same rule, on the field type that has been shipping since P6 with
  // nothing checking it. An unresolvable path in a condition is not an error at
  // run time — it is a comparison that cannot be answered, and those go down
  // "No" by design, so the Yes branch silently never runs.
  it("rejects a condition rule naming a variable that does not exist", () => {
    const { errors } = validateGraph(
      graphWithRule({ variable: "booking.stauts", operator: "equals", value: "confirmed" }),
    );
    const issue = errors.find((i) => i.code === "unknown_variable");
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("booking.status");
  });

  it("rejects a condition rule the trigger cannot provide", () => {
    const { errors } = validateGraph(
      graphWithRule({ variable: "invoice.balanceDue", operator: "greaterThan", value: 0 }),
    );
    expect(errors.some((i) => i.code === "unknown_variable")).toBe(true);
  });

  it("accepts a condition rule on any type, not only dates", () => {
    const { errors } = validateGraph(
      graphWithRule({ variable: "booking.status", operator: "equals", value: "confirmed" }),
    );
    expect(errors.filter((i) => i.code === "unknown_variable")).toHaveLength(0);
  });

  it("says nothing about a rule row that has not been filled in yet", () => {
    // Adding a rule and not yet choosing a variable is a normal intermediate
    // state. Reporting it here would put two errors on one mistake, since
    // `missing_required_field` already covers a wholly empty field.
    const { errors } = validateGraph(graphWithRule({ variable: "", operator: "equals" }));
    expect(errors.filter((i) => i.code === "unknown_variable")).toHaveLength(0);
  });
});

describe("the appointment reminder template", () => {
  const template = WORKFLOW_TEMPLATES.find((t) => t.id === "remind-before-appointment");

  it("exists and waits on a date its own trigger provides", () => {
    expect(template).toBeDefined();
    if (!template) return;

    const wait = template.nodes.find((n) => n.nodeType === "delay.wait");
    expect(wait?.parameters.mode).toBe("untilField");

    const path = wait?.parameters.dateField;
    expect(typeof path).toBe("string");
    if (typeof path !== "string") return;

    const variable = VARIABLE_MAP.get(path);
    expect(variable, `${path} is not a declared variable`).toBeDefined();
    expect(variable?.providedBy).toContain("booking");
  });

  it("stops rather than sending a reminder whose moment has passed", () => {
    // Not a style preference. Carrying on would email "we are visiting
    // tomorrow" to somebody whose appointment is in two hours.
    const wait = template?.nodes.find((n) => n.nodeType === "delay.wait");
    expect(wait?.parameters.ifPassed).toBe("skip");
  });

  it("checks the booking is still on before sending", () => {
    // The wait's resume time is fixed when the run reaches it, so a booking
    // cancelled or moved during the pause still wakes this run up. Re-reading
    // the record on resume is what makes the check meaningful; having the check
    // is what makes the re-read matter.
    const check = template?.nodes.find((n) => n.nodeType === "condition.if");
    expect(check, "no guard between the wait and the email").toBeDefined();

    const rules = check?.parameters.rules;
    expect(Array.isArray(rules)).toBe(true);
    if (!Array.isArray(rules)) return;

    const guarded = new Set(
      rules.map((r) => (r as { variable?: unknown }).variable),
    );
    expect(guarded).toContain("booking.status");
    expect(guarded).toContain("booking.date");

    // Every rule names a real variable — a typo here resolves to nothing and
    // an unanswerable comparison goes down No, so the reminder would silently
    // never send.
    for (const rule of rules) {
      const path = (rule as { variable?: unknown }).variable;
      expect(typeof path).toBe("string");
      if (typeof path === "string") expect(VARIABLE_MAP.has(path)).toBe(true);
    }
  });

  it("gives the No branch somewhere to go", () => {
    // A two-output node with a dead side is `unconnected_branch_output`, an
    // error — a template that cannot publish as delivered is worse than none.
    if (!template) return;
    const check = template.nodes.find((n) => n.nodeType === "condition.if");
    if (!check) return;

    const handles = template.edges
      .filter((e) => e.from === check.key)
      .map((e) => e.fromHandle);
    expect(handles).toContain("true");
    expect(handles).toContain("false");
  });
});
