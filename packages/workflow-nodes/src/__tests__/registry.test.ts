import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { NODE_DEFINITIONS } from "../registry/index.js";
import { ACTIVE_NODES, RELEASED_NODE_IDS } from "../active-nodes.js";
import {
  NODE_CATEGORIES,
  NODE_ID_PATTERN,
  NODE_PROPERTY_TYPES,
  FILTER_OPERATORS,
  SUBJECT_TYPES,
  isPropertyVisible,
  isBlank,
  getMissingRequiredFields,
} from "../node-definition.js";
import { SUBCATEGORIES } from "../categories.js";
import { buildNodeConfig, getDefinition, requireDefinition } from "../catalog.js";

/**
 * Registry invariants — docs/workflow-automation/wf-04-node-catalog.md §4.3.
 *
 * These are cheap and mechanical, and they are the difference between "we must
 * never rename a node id" being a convention and it being a build failure.
 * Every one of them corresponds to a documented defect in the system this was
 * ported from.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = join(HERE, "..", "registry");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("node ids", () => {
  it("are unique", () => {
    const ids = NODE_DEFINITIONS.map((d) => d.node);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
  });

  it("match domain.verb in lowerCamel", () => {
    // The reference implementation froze one snake_case id among dotted ones
    // forever, because saved workflows referenced it and ids are immutable.
    const bad = NODE_DEFINITIONS.filter((d) => !NODE_ID_PATTERN.test(d.node));
    expect(bad.map((d) => d.node)).toEqual([]);
  });

  it("only ever grow — a released id is never removed or renamed", () => {
    // Every saved automation stores this string. Removing one orphans a
    // customer's work, and there is no migration that fixes it after the fact.
    const present = new Set(NODE_DEFINITIONS.map((d) => d.node));
    const missing = RELEASED_NODE_IDS.filter((id) => !present.has(id));
    expect(missing).toEqual([]);
  });
});

describe("definitions", () => {
  it("declare a known category", () => {
    for (const def of NODE_DEFINITIONS) {
      expect(NODE_CATEGORIES).toContain(def.category);
    }
  });

  it("declare a known subcategory when they declare one", () => {
    const known = new Set(SUBCATEGORIES.map((s) => s.id));
    for (const def of NODE_DEFINITIONS) {
      if (def.subcategory) expect(known.has(def.subcategory)).toBe(true);
    }
  });

  it("give every output a stable id and a separate label", () => {
    // An edge stores the id. If the id were the label, renaming "Found" to
    // "Match" would break routing on every saved automation.
    for (const def of NODE_DEFINITIONS) {
      const ids = def.outputs.map((o) => o.id);
      expect(new Set(ids).size, `${def.node} has duplicate output ids`).toBe(ids.length);
      for (const out of def.outputs) {
        expect(out.id, `${def.node} output id`).toMatch(/^[a-z][a-z0-9_]*$/);
        expect(out.label.length, `${def.node} output ${out.id} needs a label`).toBeGreaterThan(0);
      }
    }
  });

  it("give a trigger no inputs, and everything else at least one", () => {
    for (const def of NODE_DEFINITIONS) {
      if (def.category === "trigger") {
        expect(def.inputs, `${def.node} is a trigger and cannot have inputs`).toEqual([]);
      } else {
        expect(def.inputs.length, `${def.node} needs an input`).toBeGreaterThan(0);
      }
    }
  });

  it("give every trigger at least one event, and nothing else any", () => {
    for (const def of NODE_DEFINITIONS) {
      if (def.category === "trigger") {
        expect(def.triggerEvents?.length ?? 0, `${def.node}`).toBeGreaterThan(0);
      } else {
        expect(def.triggerEvents, `${def.node} is not a trigger`).toBeUndefined();
      }
    }
  });

  it("declare only known subject types", () => {
    for (const def of NODE_DEFINITIONS) {
      for (const s of def.mutates ?? []) expect(SUBJECT_TYPES).toContain(s);
      for (const s of def.requiresSubject ?? []) expect(SUBJECT_TYPES).toContain(s);
    }
  });

  it("declare a side effect for anything that mutates", () => {
    // The engine reads this to decide whether re-entering a node after a crash
    // is safe. A mutating node with no declaration would default to re-runnable.
    for (const def of NODE_DEFINITIONS) {
      if (def.mutates?.length) {
        expect(def.sideEffect, `${def.node} mutates and must declare sideEffect`)
          .toBeDefined();
        expect(def.sideEffect).not.toBe("none");
      }
    }
  });

  it("write a description and a display name", () => {
    for (const def of NODE_DEFINITIONS) {
      expect(def.displayName.length, def.node).toBeGreaterThan(0);
      expect(def.description.length, def.node).toBeGreaterThan(0);
    }
  });
});

describe("properties", () => {
  it("have unique names within a node", () => {
    for (const def of NODE_DEFINITIONS) {
      const names = def.properties.map((p) => p.name);
      expect(new Set(names).size, `${def.node} has duplicate property names`)
        .toBe(names.length);
    }
  });

  it("declare a known type", () => {
    for (const def of NODE_DEFINITIONS) {
      for (const p of def.properties) {
        expect(NODE_PROPERTY_TYPES, `${def.node}.${p.name}`).toContain(p.type);
      }
    }
  });

  it("give options-typed properties options, and a valid default", () => {
    for (const def of NODE_DEFINITIONS) {
      for (const p of def.properties) {
        if (p.type !== "options" && p.type !== "multiOptions") continue;
        expect(p.options?.length, `${def.node}.${p.name} needs options`)
          .toBeGreaterThan(0);
        if (p.default === undefined) continue;
        const values = p.options!.map((o) => o.value);
        const defaults = Array.isArray(p.default) ? p.default : [p.default];
        for (const d of defaults) {
          expect(values, `${def.node}.${p.name} default is not an option`).toContain(d);
        }
      }
    }
  });

  it("give every required property a default or a placeholder", () => {
    // Not a correctness rule, a usability one: a required field with neither is
    // a form that opens broken with no hint about what belongs in it.
    for (const def of NODE_DEFINITIONS) {
      for (const p of def.properties) {
        if (!p.required || p.type === "notice") continue;
        const guided =
          p.default !== undefined || p.placeholder !== undefined || p.description !== undefined;
        expect(guided, `${def.node}.${p.name} is required with no guidance`).toBe(true);
      }
    }
  });

  it("reference a real sibling in displayOptions", () => {
    // A displayOptions key naming a property that does not exist means the
    // field either never renders or always does, silently.
    for (const def of NODE_DEFINITIONS) {
      const names = new Set(def.properties.map((p) => p.name));
      for (const p of def.properties) {
        for (const key of Object.keys(p.displayOptions?.show ?? {})) {
          expect(names.has(key), `${def.node}.${p.name} shows on unknown "${key}"`).toBe(true);
        }
        for (const key of Object.keys(p.displayOptions?.hide ?? {})) {
          expect(names.has(key), `${def.node}.${p.name} hides on unknown "${key}"`).toBe(true);
        }
      }
    }
  });

  it("reference a real sibling in typeOptions.dependsOn", () => {
    for (const def of NODE_DEFINITIONS) {
      const names = new Set(def.properties.map((p) => p.name));
      for (const p of def.properties) {
        const dep = p.typeOptions?.dependsOn;
        if (dep) expect(names.has(dep), `${def.node}.${p.name} depends on "${dep}"`).toBe(true);
      }
    }
  });

  it("declare a known filter operator, on triggers only", () => {
    for (const def of NODE_DEFINITIONS) {
      for (const p of def.properties) {
        if (!p.filter) continue;
        expect(FILTER_OPERATORS, `${def.node}.${p.name}`).toContain(p.filter.operator);
        expect(p.filter.path.length, `${def.node}.${p.name} filter path`).toBeGreaterThan(0);
        expect(def.category, `${def.node}.${p.name} filters but is not a trigger`)
          .toBe("trigger");
      }
    }
  });
});

describe("the active whitelist", () => {
  it("only lists nodes that exist", () => {
    for (const id of ACTIVE_NODES) {
      expect(getDefinition(id), `${id} is whitelisted but has no definition`).toBeDefined();
    }
  });

  it("has no duplicates", () => {
    expect(new Set(ACTIVE_NODES).size).toBe(ACTIVE_NODES.length);
  });

  it("never whitelists a devOnly node", () => {
    for (const id of ACTIVE_NODES) {
      expect(getDefinition(id)?.devOnly ?? false, id).toBe(false);
    }
  });

  // The executor half of this assertion is asserted from apps/api, which is
  // where executors live — a package cannot import an app. Without both halves
  // the whitelist is decoration.
});

describe("the barrel", () => {
  it("imports every registry module explicitly", () => {
    // Enforces "no globs" without using one at runtime. A glob import here is
    // what OOMed the reference implementation's hosted build during page
    // collection, and a hosted build is the worst place to find that out.
    const barrelPath = join(REGISTRY_DIR, "index.ts");
    const barrel = readFileSync(barrelPath, "utf8");

    const modules = walk(REGISTRY_DIR)
      .filter((f) => f.endsWith(".ts") && f !== barrelPath)
      .map((f) => relative(REGISTRY_DIR, f).split(sep).join("/").replace(/\.ts$/, ""));

    const missing = modules.filter((m) => !barrel.includes(`./${m}.js`));
    expect(missing, "registry modules not imported by index.ts").toEqual([]);
    expect(NODE_DEFINITIONS.length).toBe(modules.length);
  });

  it("contains no glob or dynamic import", () => {
    // Comments stripped first — the barrel's own header *names* these
    // constructs to explain why they are banned, and a test that fails on its
    // own documentation is a test nobody keeps.
    const code = readFileSync(join(REGISTRY_DIR, "index.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).not.toMatch(/import\.meta\.glob/);
    expect(code).not.toMatch(/require\.context/);
    expect(code).not.toMatch(/await import\(/);
  });
});

describe("helpers", () => {
  it("treats 0 and false as values, not blanks", () => {
    // The bug this prevents: a "minimum total: 0" filter being read as unset,
    // so it either matches everything or nothing.
    expect(isBlank(0)).toBe(false);
    expect(isBlank(false)).toBe(false);
    expect(isBlank("")).toBe(true);
    expect(isBlank("  ")).toBe(true);
    expect(isBlank([])).toBe(true);
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });

  it("hides a property when hide matches, even if show also matches", () => {
    const prop = {
      displayName: "x", name: "x", type: "string" as const,
      displayOptions: { show: { mode: ["a"] }, hide: { locked: [true] } },
    };
    expect(isPropertyVisible(prop, { mode: "a", locked: false })).toBe(true);
    expect(isPropertyVisible(prop, { mode: "a", locked: true })).toBe(false);
    expect(isPropertyVisible(prop, { mode: "b", locked: false })).toBe(false);
  });

  it("reports missing required fields, ignoring notices", () => {
    const def = requireDefinition("logic.stop");
    expect(getMissingRequiredFields(def, {})).toContain("outcome");
    expect(getMissingRequiredFields(def, { outcome: "completed" })).toEqual([]);
  });

  it("seeds every default into parameters at construction", () => {
    // The UI default and the runtime default must be one declaration. The
    // reference implementation had a dropdown showing a pre-selected value it
    // never persisted, so the runtime had to guess — and guessing wrong made
    // the automation do the opposite of what the editor said.
    for (const def of NODE_DEFINITIONS) {
      const built = buildNodeConfig(def);
      for (const p of def.properties) {
        if (p.type === "notice" || p.default === undefined) continue;
        expect(built.parameters[p.name], `${def.node}.${p.name}`).toEqual(p.default);
      }
      expect(built.label).toBe(def.displayName);
    }
  });

  it("lets overrides win over defaults", () => {
    const def = requireDefinition("logic.stop");
    const built = buildNodeConfig(def, { label: "Stop chasing", parameters: { outcome: "cancelled" } });
    expect(built.label).toBe("Stop chasing");
    expect(built.parameters.outcome).toBe("cancelled");
  });

  it("throws on an unknown node type rather than returning undefined", () => {
    expect(() => requireDefinition("job.doesNotExist")).toThrow(/Unknown node type/);
  });
});
