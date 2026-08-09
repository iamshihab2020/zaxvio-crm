"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { IconAlertTriangle, IconBolt, IconPlus } from "@tabler/icons-react";
import { getDefinition, resolveNodeColor, type NodeOutput } from "@hvac-saas/workflow-nodes";
import { resolveNodeIcon } from "@/lib/workflow/icon-map";
import { cn } from "@/lib/utils";

/**
 * One step on the canvas.
 *
 * ## Every step is a square tile with its name underneath
 *
 * Not a wide card. A card sized to hold a name is mostly empty for a short one
 * and truncates a long one, and a row of them turns a five-step automation into
 * a horizontal scroll. A fixed tile makes the graph a row of evenly spaced
 * marks — the shape a person reads as a sequence — and moves the text into a
 * caption, which can be wider than the thing it labels without affecting
 * spacing.
 *
 * **The only visual difference between a trigger and an action is the left
 * edge.** A trigger is rounded off on that side; an action is square. That is
 * doing real work rather than decorating: a trigger has no input, and a shape
 * with nothing to connect to on its left says so before you go looking for a
 * handle. Everything else — size, caption, badges — is identical, so the
 * difference reads as meaning rather than as styling.
 *
 * Flow runs **left to right**: inputs on the left edge, outputs on the right.
 *
 * A `type`, not an `interface`: React Flow's `Node<T>` constrains `T` to
 * `Record<string, unknown>`, and an interface gets no implicit index signature.
 */
export type AutomationNodeData = {
  label: string;
  nodeType: string;
  disabled: boolean;
  /** Required properties with no value — drives the "needs setting up" line. */
  missingFields: string[];
  /**
   * One line describing what this step is configured to do — the email's
   * subject, the note's text, the chosen option. Derived from the definition,
   * so no node needs code here.
   */
  summary: string | null;
  /**
   * The step's outputs, already resolved.
   *
   * Derived in the canvas rather than here for the same reason as `summary`:
   * a Do-several-things' outputs come from its *parameters*, and putting the
   * parameters in `data` would make the memo comparator serialise every node's
   * config on every store change. The canvas already holds both halves.
   */
  outputs: NodeOutput[];
  /** Output handle ids that already have an edge, so `+` shows on the rest. */
  connectedHandles: string[];
  /** More than one means a join, which the node has to explain (N-8). */
  incomingCount: number;
  onAddFromHandle: (handleId: string) => void;
};

export type AutomationFlowNode = Node<AutomationNodeData, "automation">;

/** The tile. Mirrored by `BOX_HEIGHT` in `build-node.ts`, which centres wires. */
const TILE = 92;
/** Wider than the tile, so a real name is not cut to three characters. */
const CAPTION = 170;

/**
 * `pointer-events-auto` is load-bearing.
 *
 * The handle layer covers the tile and is `pointer-events: none` so clicks pass
 * through to the node body — otherwise selecting a step by clicking it would
 * stop working. Children inherit that, so everything interactive in the layer
 * opts back in. Without this, no wire can be dragged from any node.
 */
const HANDLE_CLASS =
  // 14px, up from 10. A connection point is the smallest thing on the canvas
  // that has to be hit precisely, and 10px was under the ~9mm touch target
  // guidance before the hover growth even applies. The base size does the work;
  // hover only confirms it, so the growth is smaller now that the dot is bigger.
  "!pointer-events-auto !h-3.5 !w-3.5 !rounded-full !border-2 !border-card " +
  "!bg-muted-foreground !transition-transform hover:!scale-125 hover:!bg-brand";

function AutomationNodeComponent({ data, selected }: NodeProps<AutomationFlowNode>) {
  const def = getDefinition(data.nodeType);
  const Icon = resolveNodeIcon(def?.icon ?? "");
  const color = def ? resolveNodeColor(def) : "hsl(var(--muted-foreground))";
  const isTrigger = def?.category === "trigger";
  // The one node in the catalogue with AND semantics — see the traverser's
  // `isReady`. Read off the definition rather than a flag on the data, so the
  // canvas and the engine cannot disagree about which node joins.
  const isJoin = def?.node === "logic.merge";
  const outputs = data.outputs;
  const incomplete = data.missingFields.length > 0 && !data.disabled;

  /**
   * The caption's second line, in priority order.
   *
   *   1. "Needs setting up" — the one thing stopping this from working.
   *   2. What it is configured to do — the subject, the note, the choice.
   *   3. The step's type, but only if the user renamed it.
   *
   * Never the type when the label already IS the type: a new step is created
   * with `label = displayName`, so that would render "Add a Note" over "Add a
   * Note", which reads as a rendering bug rather than as structure.
   */
  const typeName = def?.displayName ?? data.nodeType;
  const renamed = data.label.trim() !== typeName;

  const detail: { text: string; tone: "warning" | "muted" } | null = incomplete
    ? { text: "Needs setting up", tone: "warning" }
    : data.summary
      ? { text: data.summary, tone: "muted" }
      : renamed
        ? { text: typeName, tone: "muted" }
        : null;

  return (
    // `animate-node-enter` runs once on mount — when the step is placed. React
    // Flow keeps mounted nodes across drags and pans, so this fires on arrival
    // and never again, which is the only moment the motion means anything.
    <div className="relative animate-node-enter" style={{ width: TILE }}>
      {/* Only a trigger is labelled by role. An action needs no word for
          "action" — it is the unmarked case, and labelling both would make the
          canvas twice as noisy to say half as much. */}
      {isTrigger && (
        <div
          className="absolute -top-5 left-0 flex items-center gap-1 whitespace-nowrap text-[10px] font-medium font-body"
          style={{ color }}
        >
          <IconBolt className="h-3 w-3" />
          Trigger
        </div>
      )}

      <div className="relative" style={{ height: TILE }}>
        {/*
          The handle layer sits over the tile, not inside it. The tile is a
          centring flexbox; handles placed inside became flex items, which is
          how the trigger and the action ended up positioning their connection
          points in two different layout contexts from identical code.
        */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Actions take an input on the left. Triggers have none — nothing
              runs before the thing that starts it, and the shape says so. */}
          {!isTrigger && (
            <Handle
              type="target"
              position={Position.Left}
              className={HANDLE_CLASS}
              style={{ top: "50%" }}
            />
          )}

          {outputs.map((output, index) => {
            // H-6: distribute vertically so two outputs never overlap. Branch
            // labels ride on the WIRE — see automation-edge.tsx.
            const top =
              outputs.length === 1
                ? "50%"
                : `${((index + 1) / (outputs.length + 1)) * 100}%`;
            const connected = data.connectedHandles.includes(output.id);

            return (
              <div key={output.id}>
                <Handle
                  id={output.id}
                  type="source"
                  position={Position.Right}
                  style={{ top }}
                  className={HANDLE_CLASS}
                />

                {/* H-1: a `+` on every UNCONNECTED output. People build by
                    clicking, not by dragging a wire into empty space — the
                    single highest-return affordance in the builder. */}
                {!connected && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      data.onAddFromHandle(output.id);
                    }}
                    aria-label={
                      outputs.length === 1
                        ? "Add the next step"
                        : `Add a step to the ${output.label} branch`
                    }
                    className={cn(
                      "nodrag pointer-events-auto absolute z-10 flex h-6 w-6 -translate-y-1/2",
                      "items-center justify-center rounded-full border border-dashed",
                      "border-input bg-card text-muted-foreground shadow-sm",
                      "transition-colors hover:border-brand hover:text-brand",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                    )}
                    style={{ top, right: -40 }}
                  >
                    <IconPlus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* The tile. */}
        <div
          className={cn(
            "relative flex h-full w-full items-center justify-center border bg-card",
            "transition-[border-color,box-shadow] duration-150",
            // The one shape difference: a trigger's left edge is rounded off.
            isTrigger ? "rounded-l-[28px] rounded-r-xl" : "rounded-xl",
            selected
              ? "border-brand shadow-[0_0_0_3px_hsl(var(--brand)/0.15)]"
              : incomplete
                ? "border-amber-500/50 shadow-md hover:border-amber-500"
                : "border-border shadow-md hover:border-input",
            // N-7: a switched-off step must LOOK switched off. It is the primary
            // debugging tool — "turn this off and see".
            data.disabled && "opacity-45",
          )}
        >
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${color}22`, color }}
          >
            <Icon className="h-6 w-6" />
          </div>

          {/* A state of the whole step rather than a description of it, so it
              stays on the tile where the caption cannot swallow it. */}
          {data.disabled && (
            <span className="absolute -right-1.5 -top-1.5 rounded-full border border-border bg-muted px-1.5 py-px font-mono text-[10px] leading-none text-muted-foreground">
              off
            </span>
          )}
        </div>
      </div>

      {/*
        The caption.

        Absolutely positioned and centred on the tile, so a long name grows in
        both directions instead of widening the node and shoving the next one
        along. Outside React Flow's measured box on purpose — the graph's
        spacing is decided by the tiles, not by how anyone chose to name them.
      */}
      <div
        className="absolute left-1/2 mt-2 -translate-x-1/2"
        style={{ width: CAPTION }}
      >
        <p className="truncate text-center font-heading text-xs font-semibold leading-tight">
          {data.label}
        </p>
        {detail && (
          <p
            className={cn(
              "mt-0.5 flex items-center justify-center gap-1 text-[10px] leading-tight font-body",
              detail.tone === "warning" ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {detail.tone === "warning" && (
              <IconAlertTriangle className="h-2.5 w-2.5 shrink-0" />
            )}
            <span className="truncate">{detail.text}</span>
          </p>
        )}

        {/* N-8: semantics you cannot see are semantics you get wrong. A step
            with several inputs runs on the FIRST branch to reach it, which is
            the opposite of what most people assume — except on the one node
            whose whole purpose is to wait for all of them. Stating it on both
            is what makes the difference visible; a line that appeared only on
            the unusual case would read as decoration on the node it is on and
            leave the common case silently misunderstood. */}
        {data.incomingCount > 1 && (
          <p className="mt-0.5 text-center text-[10px] leading-tight text-muted-foreground font-body">
            {isJoin ? "Waits for every branch" : "Runs on the first branch to arrive"}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * N-6: memo with a custom comparator.
 *
 * Without it every store update re-renders every node — and the store changes on
 * every drag frame — so the canvas visibly stutters past about thirty nodes.
 */
export const AutomationNode = memo(AutomationNodeComponent, (prev, next) => {
  return (
    prev.id === next.id &&
    prev.selected === next.selected &&
    prev.data.label === next.data.label &&
    prev.data.nodeType === next.data.nodeType &&
    prev.data.disabled === next.data.disabled &&
    prev.data.summary === next.data.summary &&
    prev.data.incomingCount === next.data.incomingCount &&
    prev.data.missingFields.join("|") === next.data.missingFields.join("|") &&
    // Joined rather than compared by reference: the canvas rebuilds this array
    // on every store change, so identity always differs and the node would
    // re-render constantly. Adding a branch changes the string; nothing else does.
    prev.data.outputs.map((o) => `${o.id}:${o.label}`).join("|") ===
      next.data.outputs.map((o) => `${o.id}:${o.label}`).join("|") &&
    prev.data.connectedHandles.join("|") === next.data.connectedHandles.join("|")
  );
});
