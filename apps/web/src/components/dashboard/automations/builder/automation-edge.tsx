"use client";

import { memo, useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getStraightPath,
  type EdgeProps,
  type Edge,
} from "@xyflow/react";
import { IconPlus, IconX } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

/**
 * A connection between two steps.
 *
 * **Straight, not curved and not stepped.** An automation here is a dispatch
 * rule — the thing a contractor already draws on a whiteboard as boxes and
 * arrows. Bezier curves are what every node editor ships with and they turn a
 * branching graph into loose spaghetti past four steps; stepped paths add a
 * corner wherever two nodes are a few pixels out of line, which reads as
 * structure that is not there. With the chain running left to right and node
 * centres aligned, a straight segment is both the simplest and the most honest
 * picture of "this step, then that one".
 *
 * Three things ride on the wire rather than on the node:
 *
 *   - the **branch label**, because "Not found" belongs to the connection, not
 *     to the step it leaves. Most editors hang it off the handle, where it
 *     collides with the node's own text at any zoom.
 *   - **insert** (H-2). Adding a step between two existing ones is the most
 *     common edit to an automation that already works, and the alternative —
 *     delete the connection, add the node, redraw two connections — passes
 *     through a severed automation on the way.
 *   - **delete**, because a connection is a thing the user made and every
 *     thing the user made needs a visible way to unmake it. Delete-the-key
 *     works, but a keyboard shortcut nobody is told about is not an affordance.
 */

export type AutomationEdgeData = {
  onInsert: (edgeId: string) => void;
  onDelete: (edgeId: string) => void;
  /** The source handle's display label. Only set on multi-output steps. */
  branchLabel?: string | null;
};

export type AutomationFlowEdge = Edge<AutomationEdgeData, "automation">;

function AutomationEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<AutomationFlowEdge>) {
  const [hovered, setHovered] = useState(false);

  // A straight segment between the two handles. Steps and curves both add
  // visual work the graph does not need: with the chain running left to right
  // and node centres aligned, the shortest path between two steps IS the
  // clearest picture of the relationship.
  const [path, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const branchLabel = data?.branchLabel;
  // Selected keeps the controls up so they can be clicked without holding the
  // pointer steady on a 1px line; hover is what makes them discoverable.
  const showControls = hovered || !!selected;

  return (
    <>
      {/*
        No draw-in animation.

        It used `stroke-dasharray: 1` on the assumption that `BaseEdge`
        normalises `pathLength` to 1. It does not — so "1" meant one user unit,
        every wire rendered as a dotted line, and `animation-fill-mode: forwards`
        left the dashes applied permanently after the animation finished. A
        connection that looks dashed reads as provisional or broken, which is
        the opposite of what it is.
      */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          strokeWidth: showControls ? 2 : 1.25,
          // The tokens are raw HSL triplets, so they need wrapping — a bare
          // `var(--border)` is not a colour and the wire renders black.
          stroke: showControls ? "hsl(var(--brand))" : "hsl(var(--border))",
          transition: "stroke 120ms, stroke-width 120ms",
        }}
      />

      {/*
        The hit area.

        An SVG stroke 1.25px wide is essentially impossible to point at, which
        is why the controls previously appeared on ANY canvas hover — every
        edge showed its `+` at once, which is noise rather than an affordance.
        A transparent 24px stroke over the same path gives the edge a real
        target without changing how it looks. `pointerEvents: "stroke"` is what
        keeps the fill area of a curve from swallowing clicks meant for nodes.
      */}
      <path
        d={path}
        fill="none"
        strokeWidth={24}
        stroke="transparent"
        style={{ pointerEvents: "stroke", cursor: "pointer" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <EdgeLabelRenderer>
        {branchLabel && (
          <span
            // Mono, because a branch name is a route marker read as data, not
            // as prose. Sentence case, not tracked caps: this project retired
            // the mono-caps eyebrow as the loudest generic signal it had.
            className="nodrag nopan absolute rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 18}px)`,
            }}
          >
            {branchLabel}
          </span>
        )}

        {/* One pill holding both actions, so the two live together instead of
            the destructive one being a keyboard shortcut nobody mentions. */}
        <div
          className={cn(
            "nodrag nopan absolute flex items-center gap-px rounded-full border border-border bg-card p-0.5 shadow-sm",
            "transition-opacity duration-150 motion-reduce:transition-none",
            showControls ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: showControls ? "all" : "none",
          }}
          // Keeps the pill up while the pointer travels from the line onto it —
          // without this it disappears in the gap and cannot be clicked.
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data?.onInsert(id);
            }}
            aria-label="Insert a step here"
            title="Insert a step here"
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <IconPlus className="h-3 w-3" />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data?.onDelete(id);
            }}
            aria-label="Delete this connection"
            title="Delete this connection"
            className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
          >
            <IconX className="h-3 w-3" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const AutomationEdge = memo(AutomationEdgeComponent);
