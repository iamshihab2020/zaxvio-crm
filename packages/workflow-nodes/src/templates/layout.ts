import type { TemplateEdge, TemplateNode, WorkflowTemplate } from "./types.js";

/**
 * Where the steps sit on the canvas.
 *
 * The numbers live here, in the shared package, rather than in the builder that
 * used to own them — a template laid out on its own copy would drift the first
 * time somebody changed the spacing, and the symptom would be templates that
 * look subtly foreign next to a hand-drawn automation. `build-node.ts` imports
 * these now.
 *
 * Flow is left to right: a step's successor is one column to its right.
 */
export const GRAPH_LAYOUT = {
  /** Column pitch. Wide enough for the `+` button that sits between two nodes. */
  x: 210,
  /** Row pitch. */
  y: 150,
  /** The node tile, mirrored by the canvas so wires meet handle centres. */
  tile: 92,
} as const;

export interface PositionedTemplateNode extends TemplateNode {
  positionX: number;
  positionY: number;
}

/**
 * Assign a position to every node in a template.
 *
 * Derived rather than authored, so a template is a graph and not a drawing —
 * an author adding a step should not have to re-number coordinates, and a
 * template with hand-placed positions would overlap the moment the spacing
 * changed.
 *
 * Two passes:
 *
 *  - **Column** is BFS depth from the triggers, so a step always sits to the
 *    right of the step that leads to it.
 *  - **Lane** is inherited from the parent, offset by `branchIndex`. Each
 *    independent trigger chain starts in its own lane, which is what lets one
 *    template hold three separate chase sequences without them overlapping.
 *
 * A final occupancy check pushes a node down if two would land on the same
 * square — cheap insurance, because the alternative is invisible until somebody
 * opens the template and finds one step hidden behind another.
 */
export function layoutTemplate(template: WorkflowTemplate): PositionedTemplateNode[] {
  const byKey = new Map(template.nodes.map((node) => [node.key, node]));
  const outgoing = new Map<string, TemplateEdge[]>();
  const hasParent = new Set<string>();

  for (const edge of template.edges) {
    const list = outgoing.get(edge.from);
    if (list) list.push(edge);
    else outgoing.set(edge.from, [edge]);
    hasParent.add(edge.to);
  }

  // Roots in declaration order, so a template's first-declared trigger is its
  // top chain. Anything with no parent is a root, which covers a stray node an
  // author left unconnected rather than silently dropping it.
  const roots = template.nodes.filter((node) => !hasParent.has(node.key));

  const depth = new Map<string, number>();
  const lane = new Map<string, number>();
  let nextFreeLane = 0;

  for (const root of roots) {
    depth.set(root.key, 0);
    lane.set(root.key, nextFreeLane);
    nextFreeLane += 1;

    const queue: string[] = [root.key];
    const seen = new Set<string>([root.key]);

    while (queue.length > 0) {
      const key = queue.shift()!;
      const parentDepth = depth.get(key) ?? 0;
      const parentLane = lane.get(key) ?? 0;

      for (const edge of outgoing.get(key) ?? []) {
        // A node reachable two ways keeps its first (shallowest) placement —
        // BFS order guarantees that is the leftmost sensible column.
        if (seen.has(edge.to)) continue;
        seen.add(edge.to);

        const child = byKey.get(edge.to);
        const branchOffset = child?.branchIndex ?? 0;

        depth.set(edge.to, parentDepth + 1);
        lane.set(edge.to, parentLane + branchOffset);
        if (parentLane + branchOffset >= nextFreeLane) {
          nextFreeLane = parentLane + branchOffset + 1;
        }
        queue.push(edge.to);
      }
    }
  }

  const taken = new Set<string>();

  return template.nodes.map((node) => {
    const column = depth.get(node.key) ?? 0;
    let row = lane.get(node.key) ?? 0;
    while (taken.has(`${column}:${row}`)) row += 1;
    taken.add(`${column}:${row}`);

    return {
      ...node,
      positionX: column * GRAPH_LAYOUT.x,
      positionY: row * GRAPH_LAYOUT.y,
    };
  });
}
