import {
  buildNodeConfig,
  requireDefinition,
  GRAPH_LAYOUT,
} from "@hvac-saas/workflow-nodes";
import type { GraphEdge, GraphNode } from "@hvac-saas/types";

/**
 * The **one** node constructor.
 *
 * Palette drops, insert-on-edge, paste, and template install all come through
 * here, so a node made one way is byte-identical to a node made another. The
 * moment there are two constructors there are two answers to "what are this
 * node's defaults", and the runtime gets to pick.
 *
 * It delegates the parameters to `buildNodeConfig` in the package rather than
 * seeding them here, because the engine reads that same function. The UI default
 * and the runtime default must be one declaration — the alternative is a
 * dropdown that displays a value as pre-selected and never persists it, leaving
 * the automation to do the opposite of what the editor showed.
 */

/** Client-minted, because the save contract sends the whole graph and diffs by id. */
function newId(): string {
  return crypto.randomUUID();
}

export interface BuildNodeOptions {
  nodeType: string;
  positionX: number;
  positionY: number;
  label?: string;
  parameters?: Record<string, unknown>;
}

export function buildNode(options: BuildNodeOptions): GraphNode {
  // `requireDefinition` throws rather than returning undefined: a palette entry
  // for a node type that is not in the registry is corrupt state, not a user
  // mistake, and continuing would put an unrenderable node on the canvas.
  const def = requireDefinition(options.nodeType);

  return {
    id: newId(),
    nodeType: def.node,
    nodeConfig: buildNodeConfig(def, {
      label: options.label,
      parameters: options.parameters,
    }),
    positionX: Math.round(options.positionX),
    positionY: Math.round(options.positionY),
  };
}

export interface BuildEdgeOptions {
  sourceNodeId: string;
  targetNodeId: string;
  /** A stable handle id (`found`), never the display label. */
  sourceHandle?: string;
}

export function buildEdge(options: BuildEdgeOptions): GraphEdge {
  return {
    id: newId(),
    sourceNodeId: options.sourceNodeId,
    sourceHandle: options.sourceHandle ?? "main",
    targetNodeId: options.targetNodeId,
    label: null,
  };
}

/**
 * Layout: the chain runs **left to right**, branches fan **vertically**.
 *
 * This is the orientation every node editor its users have met uses — n8n,
 * Zapier's newer canvas, Make. With square tiles it is also the cheaper axis:
 * a step's caption is wider than its tile, so vertical space is the scarce one,
 * and stacking downward would make every branch collide with the text of the
 * step beside it.
 *
 * `x` clears the 92px tile, the `+` affordance sitting 40px off its right edge,
 * and enough wire either side to be visibly a connection rather than a seam.
 * `y` clears the tile plus its two-line caption, so branches do not overlap
 * each other's text.
 */
/**
 * Re-exported, not declared.
 *
 * Templates lay themselves out with the same pitch, and they live in the shared
 * package because the server instantiates them. Two copies of these numbers
 * would drift the first time somebody widened the columns, and the symptom is a
 * template that looks subtly foreign beside a hand-drawn automation.
 */
export const NODE_SPACING = { x: GRAPH_LAYOUT.x, y: GRAPH_LAYOUT.y } as const;

/**
 * The height of a node's connectable box, which is **not** the height of the
 * node — the caption hangs below it and is deliberately unmeasured.
 *
 * Every step is the same square tile, so this is one number. It was two while
 * actions were wide cards, and the 18px difference between the two centres put
 * a visible kink in every wire leaving a trigger.
 *
 * Declared here rather than measured, because placement happens before anything
 * renders. Mirrors `TILE` in `automation-node.tsx`; kept beside the spacing it
 * is used with so the two cannot drift.
 */
const BOX_HEIGHT = GRAPH_LAYOUT.tile;

/** The tile's size, for callers placing a node at a pointer. */
export const NODE_TILE = BOX_HEIGHT;

/**
 * Takes a node type it does not currently read.
 *
 * Kept as the seam rather than exporting the constant: every caller already
 * asks "how tall is *this* node", and the day a node kind is a different size
 * again — a note tile, a group — that is a change here and nowhere else.
 */
export function boxHeight(_nodeType: string): number {
  return BOX_HEIGHT;
}

/** Where a node's handles sit, in canvas coordinates. */
function centreOf(node: Pick<GraphNode, "positionY" | "nodeType">): number {
  return node.positionY + boxHeight(node.nodeType) / 2;
}

/**
 * The next step in a linear chain: to the right, **centre-aligned** with its
 * parent so the connection between them is a level straight line.
 */
export function positionAfter(
  parent: Pick<GraphNode, "positionX" | "positionY" | "nodeType">,
  childNodeType: string,
) {
  return {
    positionX: parent.positionX + NODE_SPACING.x,
    positionY: Math.round(centreOf(parent) - boxHeight(childNodeType) / 2),
  };
}

/**
 * Fan branches vertically so two outputs never land on top of each other.
 *
 * Centred on the parent: with two outputs, index 0 goes up and index 1 goes
 * down, which matches the order the handles are drawn in so the wire to the
 * top branch is the one leaving the top handle.
 */
export function positionBranch(
  parent: Pick<GraphNode, "positionX" | "positionY" | "nodeType">,
  childNodeType: string,
  index: number,
  total: number,
) {
  const offset = total <= 1 ? 0 : (index - (total - 1) / 2) * NODE_SPACING.y;
  return {
    positionX: parent.positionX + NODE_SPACING.x,
    positionY: Math.round(centreOf(parent) - boxHeight(childNodeType) / 2 + offset),
  };
}
