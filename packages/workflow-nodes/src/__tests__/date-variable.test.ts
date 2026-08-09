import { describe, expect, it } from "vitest";

import { getDefinition } from "../catalog.js";
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

/** Every `dateVariable` property across the whole registry. */
function dateVariableProperties(): { node: string; property: NodeProperty }[] {
  const found: { node: string; property: NodeProperty }[] = [];
  for (const nodeType of ["delay.wait"]) {
    const def = getDefinition(nodeType);
    if (!def) continue;
    for (const property of def.properties) {
      if (property.type === "dateVariable") found.push({ node: nodeType, property });
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

describe("the validator catches what only this field type can get wrong", () => {
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
      edges: [{ id: "e", source: "t", target: "w", sourceHandle: "main" }],
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
    const issues = validateGraph(graphWith({ ...base, dateField: "booking.dat" }));
    const issue = issues.find((i) => i.code === "unknown_variable");
    expect(issue).toBeDefined();
    // The suggestion is the whole point — a typo'd path is otherwise a wait
    // that never fires and no way to see why.
    expect(issue?.message).toContain("booking.date");
  });

  it("rejects a date the trigger above it does not provide", () => {
    // Well-formed, real, and unreachable: a booking trigger carries no invoice.
    const issues = validateGraph(graphWith({ ...base, dateField: "invoice.dueDate" }));
    expect(issues.some((i) => i.code === "unknown_variable")).toBe(true);
  });

  it("rejects a time-of-day where a date is required", () => {
    // `booking.startTime` is provided by this exact trigger and is still wrong:
    // it names an hour with no day attached, so there is no moment to wait for.
    const issues = validateGraph(graphWith({ ...base, dateField: "booking.startTime" }));
    expect(issues.some((i) => i.code === "unknown_variable")).toBe(true);
  });

  it("accepts a date the trigger really provides", () => {
    const issues = validateGraph(graphWith({ ...base, dateField: "booking.date" }));
    expect(issues.filter((i) => i.code === "unknown_variable")).toHaveLength(0);
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
});
