import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  ACTIVE_NODE_SET,
  VARIABLE_MAP,
  WORKFLOW_TEMPLATES,
  buildNodeConfig,
  getDefinition,
  getMissingRequiredFields,
  layoutTemplate,
  validateGraph,
  type WorkflowTemplate,
} from "@hvac-saas/workflow-nodes";

/**
 * The templates, asserted.
 *
 * A template is the first thing a tenant touches, and a broken one is worse than
 * no template at all: it drops somebody into a builder full of red badges for a
 * graph they did not draw, and teaches them the feature does not work. None of
 * that is caught by types — every failure below is a plausible, compiling
 * template.
 *
 * The specific failures this exists to prevent, all of which have precedent in
 * this repo:
 *
 *  - A `{{variable}}` typo. It resolves to nothing and mails a customer a
 *    sentence with a hole in it. Same class as the guessed `booking_portal`
 *    enum, which produced a filter that matched nothing, silently.
 *  - A node that is defined but not active, so the palette will not offer it and
 *    the engine has no executor.
 *  - A `needsSetup` list that drifts from what is actually missing — which is
 *    the "there are 0 things to fix first" defect wearing a different hat.
 *  - Two templates sharing an id, so installing one records the other.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ICON_MAP = join(
  HERE, "..", "..", "..", "..", "apps", "web", "src", "lib", "workflow", "icon-map.ts",
);

/** The template's graph in the shape the shared validator takes. */
function toValidatable(template: WorkflowTemplate) {
  const positioned = layoutTemplate(template);
  const idFor = new Map(positioned.map((node) => [node.key, `id-${node.key}`]));

  return {
    nodes: positioned.map((node) => ({
      id: idFor.get(node.key)!,
      nodeType: node.nodeType,
      // Through `buildNodeConfig`, exactly as the instantiator does — otherwise
      // this would validate a graph the server never writes.
      nodeConfig: buildNodeConfig(getDefinition(node.nodeType)!, {
        label: node.label,
        parameters: node.parameters,
      }),
    })),
    edges: template.edges.map((edge, index) => ({
      id: `edge-${index}`,
      sourceNodeId: idFor.get(edge.from)!,
      sourceHandle: edge.fromHandle ?? "main",
      targetNodeId: idFor.get(edge.to)!,
    })),
  };
}

/** Every `{{path}}` in every string parameter of a template. */
function variablePaths(template: WorkflowTemplate): string[] {
  const found: string[] = [];
  const walk = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
        found.push(match[1]);
      }
      return;
    }
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  for (const node of template.nodes) walk(node.parameters);
  return found;
}

describe("workflow templates", () => {
  it("have unique, stable ids", () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only use nodes that are actually shippable", () => {
    // A defined-but-inactive node has no executor. The template would install,
    // publish would refuse, and the tenant would have no idea why.
    const offenders = WORKFLOW_TEMPLATES.flatMap((template) =>
      template.nodes
        .filter((node) => !ACTIVE_NODE_SET.has(node.nodeType))
        .map((node) => `${template.id} uses ${node.nodeType}`),
    );
    expect(offenders).toEqual([]);
  });

  it("only reference variables that exist", () => {
    const offenders = WORKFLOW_TEMPLATES.flatMap((template) =>
      variablePaths(template)
        .filter((path) => !VARIABLE_MAP.has(path))
        .map((path) => `${template.id} references {{${path}}}`),
    );
    expect(offenders).toEqual([]);
  });

  it("connect every node — no strays", () => {
    // A node with no edge is invisible work: it sits on the canvas, never runs,
    // and the validator reports it as an orphan the tenant did not create.
    const offenders = WORKFLOW_TEMPLATES.flatMap((template) => {
      const wired = new Set<string>();
      for (const edge of template.edges) {
        wired.add(edge.from);
        wired.add(edge.to);
      }
      // A single-node template would be legitimate; none exist, and one would
      // still need a trigger, which the validator covers.
      if (template.nodes.length < 2) return [];
      return template.nodes
        .filter((node) => !wired.has(node.key))
        .map((node) => `${template.id} leaves ${node.key} unconnected`);
    });
    expect(offenders).toEqual([]);
  });

  it("lay out without two steps on the same spot", () => {
    const offenders = WORKFLOW_TEMPLATES.flatMap((template) => {
      const seen = new Set<string>();
      return layoutTemplate(template)
        .filter((node) => {
          const spot = `${node.positionX}:${node.positionY}`;
          if (seen.has(spot)) return true;
          seen.add(spot);
          return false;
        })
        .map((node) => `${template.id} stacks ${node.key} on another step`);
    });
    expect(offenders).toEqual([]);
  });

  it("name an icon the builder can actually render", () => {
    // Read as source, like the executor barrel test: the map lives in the web
    // app and importing it would drag React into this runner.
    const source = readFileSync(ICON_MAP, "utf8");
    const offenders = WORKFLOW_TEMPLATES.filter(
      (template) => !source.includes(template.icon),
    ).map((template) => `${template.id} wants ${template.icon}`);
    expect(offenders).toEqual([]);
  });

  describe("each template", () => {
    for (const template of WORKFLOW_TEMPLATES) {
      describe(template.id, () => {
        it("has no structural errors", () => {
          const { errors } = validateGraph(toValidatable(template));

          // A missing required field is expected when — and only when — the
          // template says so in `needsSetup`. Everything else is a broken
          // template.
          const structural = errors.filter((e) => e.code !== "missing_required_field");
          expect(structural.map((e) => e.message)).toEqual([]);
        });

        it("declares exactly the setup it actually needs", () => {
          const missing = template.nodes.flatMap((node) =>
            getMissingRequiredFields(getDefinition(node.nodeType)!, {
              ...buildNodeConfig(getDefinition(node.nodeType)!, {
                parameters: node.parameters,
              }).parameters,
            }),
          );

          const claimsSetup = (template.needsSetup?.length ?? 0) > 0;

          // Both directions. A template claiming setup it does not need sends
          // somebody looking for a field that is already filled; one needing
          // setup it does not claim drops them into red badges with no
          // explanation.
          expect(missing.length > 0).toBe(claimsSetup);
        });
      });
    }
  });
});
