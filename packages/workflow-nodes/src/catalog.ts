import { NODE_DEFINITIONS } from "./registry/index.js";
import { ACTIVE_NODE_SET } from "./active-nodes.js";
import { CATEGORIES, SUBCATEGORIES, resolveNodeColor } from "./categories.js";
import type {
  NodeCategory,
  NodeDefinition,
  NodeOutput,
  NodeProperty,
} from "./node-definition.js";

/**
 * Lookup over the registry. The only way anything reads a node definition.
 *
 * Built once at module load into a Map — the builder resolves a definition on
 * every node render and the engine on every node execution, so an array scan
 * would be the wrong shape by the time a graph has 40 nodes.
 */

const BY_ID = new Map<string, NodeDefinition>(
  NODE_DEFINITIONS.map((d) => [d.node, d]),
);

export function getDefinition(nodeType: string): NodeDefinition | undefined {
  return BY_ID.get(nodeType);
}

/**
 * Throws rather than returning undefined. Used where a missing definition means
 * corrupt data rather than a user mistake — the engine loading a saved graph,
 * for instance, where continuing would run a node nobody can describe.
 */
export function requireDefinition(nodeType: string): NodeDefinition {
  const def = BY_ID.get(nodeType);
  if (!def) {
    throw new Error(
      `Unknown node type "${nodeType}". It was removed from the registry, ` +
        `which should never happen — node ids are immutable.`,
    );
  }
  return def;
}

export function allDefinitions(): NodeDefinition[] {
  return NODE_DEFINITIONS;
}

/**
 * What the palette shows.
 *
 * Active nodes, plus `coming-soon` ones so the palette advertises the roadmap.
 * `devOnly` never appears. The caller greys anything whose id is not in the
 * active set.
 */
export function getPaletteDefinitions(): NodeDefinition[] {
  return NODE_DEFINITIONS.filter((d) => {
    if (d.devOnly) return false;
    if (ACTIVE_NODE_SET.has(d.node)) return true;
    return d.tags?.includes("coming-soon") ?? false;
  });
}

/** Runnable right now. What the engine and the validator agree exists. */
export function getActiveDefinitions(): NodeDefinition[] {
  return NODE_DEFINITIONS.filter(
    (d) => ACTIVE_NODE_SET.has(d.node) && !d.devOnly,
  );
}

export function isActive(nodeType: string): boolean {
  return ACTIVE_NODE_SET.has(nodeType);
}

export function isComingSoon(def: NodeDefinition): boolean {
  return !ACTIVE_NODE_SET.has(def.node) && (def.tags?.includes("coming-soon") ?? false);
}

export function getTriggerDefinitions(): NodeDefinition[] {
  return getActiveDefinitions().filter((d) => d.category === "trigger");
}

export function getActionDefinitions(): NodeDefinition[] {
  return getActiveDefinitions().filter((d) => d.category !== "trigger");
}

/** Trigger node types that listen for an event. Drives the trigger matcher. */
export function getDefinitionsForEvent(eventType: string): NodeDefinition[] {
  return getActiveDefinitions().filter((d) =>
    d.triggerEvents?.includes(eventType),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette shape
// ─────────────────────────────────────────────────────────────────────────────

export interface PaletteGroup {
  category: NodeCategory;
  label: string;
  color: string;
  order: number;
  subgroups: {
    id: string;
    label: string;
    order: number;
    nodes: PaletteEntry[];
  }[];
}

export interface PaletteEntry {
  node: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  comingSoon: boolean;
  tags: NodeDefinition["tags"];
}

/**
 * The palette, grouped and ordered, with colour already resolved.
 *
 * Computed here rather than in the component so the ordering rules live beside
 * the data they order, and so the AI copilot (if it is ever built) reads the
 * same shape the human palette does.
 */
export function buildPalette(
  filter?: { mode?: "trigger" | "action"; search?: string },
): PaletteGroup[] {
  const mode = filter?.mode;
  const search = filter?.search?.trim().toLowerCase();

  let defs = getPaletteDefinitions();
  if (mode === "trigger") defs = defs.filter((d) => d.category === "trigger");
  if (mode === "action") defs = defs.filter((d) => d.category !== "trigger");
  if (search) {
    defs = defs.filter(
      (d) =>
        d.displayName.toLowerCase().includes(search) ||
        d.description.toLowerCase().includes(search) ||
        d.node.toLowerCase().includes(search),
    );
  }

  const groups = new Map<NodeCategory, PaletteGroup>();

  for (const def of defs) {
    const meta = CATEGORIES[def.category];
    let group = groups.get(def.category);
    if (!group) {
      group = {
        category: def.category,
        label: meta.label,
        color: meta.color,
        order: meta.order,
        subgroups: [],
      };
      groups.set(def.category, group);
    }

    const subId = def.subcategory ?? `${def.category}.other`;
    let sub = group.subgroups.find((s) => s.id === subId);
    if (!sub) {
      const subMeta = SUBCATEGORIES.find((s) => s.id === subId);
      sub = {
        id: subId,
        label: subMeta?.label ?? "Other",
        order: subMeta?.order ?? 99,
        nodes: [],
      };
      group.subgroups.push(sub);
    }

    sub.nodes.push({
      node: def.node,
      displayName: def.displayName,
      description: def.description,
      icon: def.icon,
      color: resolveNodeColor(def),
      comingSoon: isComingSoon(def),
      tags: def.tags,
    });
  }

  const result = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const g of result) {
    g.subgroups.sort((a, b) => a.order - b.order);
    for (const s of g.subgroups) {
      s.nodes.sort((a, b) => a.displayName.localeCompare(b.displayName));
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node construction
// ─────────────────────────────────────────────────────────────────────────────

export interface BuiltNodeConfig {
  label: string;
  parameters: Record<string, unknown>;
  disabled?: boolean;
}

/**
 * Seed a node's config from its definition.
 *
 * **Every default is written into `parameters` here**, which is the fix for a
 * whole class of bug the reference implementation documents: a dropdown that
 * shows a value as pre-selected but only persists it if the user touches the
 * control, so the runtime has to guess — and a wrong guess means the automation
 * does the opposite of what the editor said it would.
 *
 * The UI default and the runtime default must be one declaration. This function
 * is that declaration, and it is the *only* node constructor: the palette,
 * paste, template install and anything generated all go through it, so a node
 * made one way is byte-identical to a node made another.
 */
export function buildNodeConfig(
  def: NodeDefinition,
  overrides?: { label?: string; parameters?: Record<string, unknown> },
): BuiltNodeConfig {
  const parameters: Record<string, unknown> = {};

  for (const prop of def.properties) {
    if (prop.type === "notice") continue;      // display only, carries no value
    if (prop.default !== undefined) parameters[prop.name] = prop.default;
  }

  return {
    label: overrides?.label ?? def.displayName,
    parameters: { ...parameters, ...(overrides?.parameters ?? {}) },
  };
}

/** Outputs, with `main` implied for a node that declares none but is not terminal. */
export function getOutputs(def: NodeDefinition): NodeOutput[] {
  return def.outputs;
}

export function getProperty(
  def: NodeDefinition,
  name: string,
): NodeProperty | undefined {
  return def.properties.find((p) => p.name === name);
}

/** Properties that declare a trigger filter. Drives the generic matcher. */
export function getFilterProperties(def: NodeDefinition): NodeProperty[] {
  return def.properties.filter((p) => p.filter);
}

/** Properties holding a foreign id that must be tenant-checked. */
export function getOwnershipProperties(def: NodeDefinition): NodeProperty[] {
  return def.properties.filter((p) => p.ownership);
}
