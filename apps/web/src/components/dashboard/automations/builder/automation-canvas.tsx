"use client";

import { useCallback, useEffect, useMemo } from "react";
import { IconPlus } from "@tabler/icons-react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
  type NodeMouseHandler,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  CATEGORIES,
  getDefinition,
  getMissingRequiredFields,
  resolveNodeColor,
} from "@hvac-saas/workflow-nodes";
import { useBuilderStore } from "@/lib/workflow/store";
import { NODE_TILE } from "@/lib/workflow/build-node";
import { CanvasControls } from "./canvas-controls";
import { summariseNode } from "@/lib/workflow/node-summary";
import {
  AutomationNode,
  type AutomationFlowNode,
} from "./automation-node";
import {
  AutomationEdge,
  type AutomationFlowEdge,
} from "./automation-edge";

/**
 * The graph editor.
 *
 * React Flow is a **view over the Zustand store**, never the source of truth.
 * The one exception is node position *during a drag*: React Flow owns those
 * frames locally and the store is written once on drag stop. Committing every
 * frame would push a history entry per pixel and make Ctrl+Z useless — "undo
 * covers node changes" has to mean the move, not the animation.
 *
 * Must be loaded with `dynamic(..., { ssr: false })`. React Flow measures the
 * DOM on mount and there is no server render worth having here (P-7).
 */

// Declared at module scope. Passing a fresh object literal to `nodeTypes` on
// each render makes React Flow tear down and rebuild every node — a documented
// footgun and a visible one, because node state resets as you type.
const NODE_TYPES = { automation: AutomationNode };
const EDGE_TYPES = { automation: AutomationEdge };

interface Props {
  readOnly?: boolean;
}

function Canvas({ readOnly = false }: Props) {
  const { screenToFlowPosition } = useReactFlow();
  const storeNodes = useBuilderStore((s) => s.nodes);
  const storeEdges = useBuilderStore((s) => s.edges);
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);

  const select = useBuilderStore((s) => s.select);
  const moveNode = useBuilderStore((s) => s.moveNode);
  const connect = useBuilderStore((s) => s.connect);
  const requestDeleteNode = useBuilderStore((s) => s.requestDeleteNode);
  const deleteEdge = useBuilderStore((s) => s.deleteEdge);
  const undo = useBuilderStore((s) => s.undo);
  const redo = useBuilderStore((s) => s.redo);

  // The palette lives in the store, so the canvas, the empty-state card and the
  // toolbar all open the same one without callbacks threaded through the shell.
  const openForTrigger = useBuilderStore((s) => s.openPaletteForTrigger);
  const openForAction = useBuilderStore((s) => s.openPaletteForAction);
  const openForEdgeInsert = useBuilderStore((s) => s.openPaletteForEdgeInsert);

  // ── store → React Flow ────────────────────────────────────────────────────

  const derived = useMemo(() => {
    const incoming = new Map<string, number>();
    const handles = new Map<string, string[]>();
    for (const edge of storeEdges) {
      incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
      const list = handles.get(edge.sourceNodeId);
      if (list) list.push(edge.sourceHandle);
      else handles.set(edge.sourceNodeId, [edge.sourceHandle]);
    }

    const nodes: AutomationFlowNode[] = storeNodes.map((node) => {
      const def = getDefinition(node.nodeType);
      return {
        id: node.id,
        type: "automation" as const,
        position: { x: node.positionX, y: node.positionY },
        selected: node.id === selectedNodeId,
        data: {
          label: node.nodeConfig.label,
          nodeType: node.nodeType,
          disabled: node.nodeConfig.disabled ?? false,
          // The same pure function the publish validator uses, so the ⚠ badge
          // and the Publish dialog can never disagree about what is missing.
          missingFields: def
            ? getMissingRequiredFields(def, node.nodeConfig.parameters ?? {})
            : [],
          // Derived here rather than in the node so the memo comparator can see
          // it as a plain string — comparing parameters object-by-object would
          // mean serialising every node's config on every store change.
          summary: def
            ? summariseNode(def, node.nodeConfig.parameters ?? {})
            : null,
          connectedHandles: handles.get(node.id) ?? [],
          incomingCount: incoming.get(node.id) ?? 0,
          onAddFromHandle: (handleId: string) => openForAction(node.id, handleId),
        },
      };
    });

    const edges: AutomationFlowEdge[] = storeEdges.map((edge) => {
      // The branch name rides on the wire, so it is resolved here rather than
      // in the node. Only for steps that actually branch — labelling the single
      // output of every step "Then" is noise on every connection in the graph.
      const sourceDef = getDefinition(
        storeNodes.find((n) => n.id === edge.sourceNodeId)?.nodeType ?? "",
      );
      const branching = (sourceDef?.outputs.length ?? 0) > 1;

      return {
        id: edge.id,
        type: "automation" as const,
        source: edge.sourceNodeId,
        sourceHandle: edge.sourceHandle,
        target: edge.targetNodeId,
        data: {
          onInsert: openForEdgeInsert,
          onDelete: deleteEdge,
          branchLabel: branching
            ? (sourceDef?.outputs.find((o) => o.id === edge.sourceHandle)?.label ?? null)
            : null,
        },
      };
    });

    return { nodes, edges };
  }, [
    storeNodes,
    storeEdges,
    selectedNodeId,
    openForAction,
    openForEdgeInsert,
    deleteEdge,
  ]);

  const [nodes, setNodes, onNodesChange] = useNodesState<AutomationFlowNode>(derived.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<AutomationFlowEdge>(derived.edges);

  // Re-seed the view whenever the store's graph changes. During a drag the store
  // is untouched, so this does not fight the pointer.
  useEffect(() => setNodes(derived.nodes), [derived.nodes, setNodes]);
  useEffect(() => setEdges(derived.edges), [derived.edges, setEdges]);

  // ── React Flow → store ────────────────────────────────────────────────────

  // Typed as React Flow's own `OnNodeDrag`, whose event is a DOM
  // `MouseEvent | TouchEvent` — not a React synthetic event.
  const onNodeDragStop: OnNodeDrag<AutomationFlowNode> = useCallback(
    (_event, node) => {
      moveNode(node.id, node.position.x, node.position.y);
    },
    [moveNode],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      connect(connection.source, connection.sourceHandle ?? "main", connection.target);
    },
    [connect],
  );

  const onNodeClick: NodeMouseHandler<AutomationFlowNode> = useCallback(
    (_event, node) => select(node.id),
    [select],
  );

  /**
   * F-5: drag a wire into empty space to add the next step there.
   *
   * The one gesture a graph editor's users try unprompted, and without it
   * dropping a connection into nothing is silent failure — the wire vanishes and
   * nothing explains why. Here it opens the palette already wired to the handle
   * it came from, and places the chosen step where the pointer was let go.
   *
   * `isValid` is false both for "dropped on nothing" and for "dropped somewhere
   * illegal", so `toNode` is checked too: releasing over an existing node that
   * refused the connection should not conjure a second one on top of it.
   */
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      if (readOnly) return;
      // `FinalConnectionState` is a union: the no-connection branch has no
      // `fromNode`, so narrowing on that first makes the rest safe to read.
      if (!connectionState.fromNode) return;
      if (connectionState.isValid || connectionState.toNode) return;

      const from = connectionState.fromNode;
      const handleId = connectionState.fromHandle?.id;
      if (!handleId) return;

      // `changedTouches` because a touch event's `touches` list is empty by the
      // time it ends — the finger has already left the screen.
      const point =
        "changedTouches" in event ? event.changedTouches[0] : (event as MouseEvent);
      const dropped = screenToFlowPosition({ x: point.clientX, y: point.clientY });

      // Centred on the pointer rather than starting at it, so the step lands
      // where the user was looking instead of hanging below and right of it.
      openForAction(from.id, handleId, {
        x: Math.round(dropped.x - NODE_TILE / 2),
        y: Math.round(dropped.y - NODE_TILE / 2),
      });
    },
    [readOnly, screenToFlowPosition, openForAction],
  );

  // ── keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (readOnly) return;

    function handler(event: KeyboardEvent) {
      // Never steal a key from a field the user is typing in — the config panel
      // is a form, and Delete there means "delete a character".
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }

      if (event.key !== "Delete" && event.key !== "Backspace") return;

      // Edges first: React Flow's own delete key is switched off (so a node
      // deletion goes through the store and gets X-1's relink), which means
      // nothing else would remove a connection at all.
      const selectedEdges = edges.filter((edge) => edge.selected);
      if (selectedEdges.length > 0) {
        event.preventDefault();
        selectedEdges.forEach((edge) => deleteEdge(edge.id));
        return;
      }

      if (selectedNodeId) {
        event.preventDefault();
        requestDeleteNode(selectedNodeId);
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [readOnly, undo, redo, requestDeleteNode, deleteEdge, selectedNodeId, edges]);

  // ── derived canvas state ──────────────────────────────────────────────────

  const isEmpty = storeNodes.length === 0;

  // Whether anything can start this automation yet. Drives which of the two
  // trigger affordances shows: an empty canvas gets one centred card and
  // nothing else to misread; a populated one gets a quiet corner button.
  const hasTrigger = useMemo(
    () => storeNodes.some((n) => getDefinition(n.nodeType)?.category === "trigger"),
    [storeNodes],
  );

  return (
    <div className="relative h-full w-full">
      <ReactFlow<AutomationFlowNode, AutomationFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onNodeDragStop={readOnly ? undefined : onNodeDragStop}
        onConnect={readOnly ? undefined : onConnect}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={() => select(null)}
        onEdgesDelete={
          readOnly ? undefined : (deleted) => deleted.forEach((e) => deleteEdge(e.id))
        }
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        // A 10px handle is a small thing to hit with a mouse and an impossible
        // one on a trackpad. React Flow's default snap radius is 20px; this
        // lets a wire released anywhere near a node find its handle.
        connectionRadius={60}
        // The canvas owns Delete/Backspace itself, above, so that a node and its
        // relink happen in one store action. Left to React Flow, the node would
        // be removed without X-1's relink and the automation would be severed.
        deleteKeyCode={null}
        fitView
        // Generous padding because a trigger carries a label above it and its
        // name below it, neither of which React Flow measures — a tight fit
        // clips both.
        fitViewOptions={{ padding: 0.35, maxZoom: 1 }}
        proOptions={{ hideAttribution: false }}
        // `--surface-alt` is the recessed step of the elevation ramp, so cards
        // sitting on it genuinely lift. React Flow's own default is a flat grey
        // that belongs to no theme and inverts wrongly in dark mode.
        className="bg-surface-alt"
      >
        {/* Keyed off `muted-foreground` at low alpha rather than `--border`:
            in dark mode the border token is barely separable from the canvas
            ground, so the grid vanished entirely and the canvas read as a flat
            void with no sense of being pannable. */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1.5}
          color="hsl(var(--muted-foreground) / 0.28)"
        />
        {/* Controls live outside <ReactFlow> — see below. */}
        {/* `bgColor` and `maskColor` are SVG attributes on the minimap's own
            canvas — a Tailwind class on the wrapper does not reach them, which
            is why it rendered as a light panel sitting in a dark UI. */}
        <MiniMap
          pannable
          zoomable
          bgColor="hsl(var(--card))"
          maskColor="hsl(var(--surface-alt) / 0.7)"
          nodeColor={(node) => {
            const def = getDefinition(
              (node.data as { nodeType?: string })?.nodeType ?? "",
            );
            return def ? resolveNodeColor(def) : "hsl(var(--muted-foreground))";
          }}
          nodeStrokeWidth={0}
          nodeBorderRadius={3}
          className="!bottom-4 !right-4 !m-0 !rounded-md !border !border-border !shadow-sm"
        />
      </ReactFlow>

      {/* O-3: an empty canvas gets ONE card asking the only question that can be
          answered first — not an empty grid and a blinking cursor. The blank
          canvas is the biggest adoption risk in the whole feature.

          It is drawn as the step it will become: same width, same spine, same
          radius, with a stub of wire running out of the bottom. Clicking it
          replaces it with a real node in the same place, so the first action
          teaches the shape of every action after it. */}
      {isEmpty && !readOnly && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="pointer-events-auto flex items-center">
            {/* Drawn as the trigger it will become — same 92px square, same
                rounded-left silhouette. Clicking it replaces it with a real
                trigger in the same place, so the first action teaches the shape
                of the thing being built rather than being a generic CTA. */}
            <button
              type="button"
              onClick={openForTrigger}
              className="group flex h-[92px] w-[92px] animate-placeholder-breathe items-center justify-center rounded-l-[28px] rounded-r-xl border border-dashed border-input bg-card shadow-md transition-colors hover:border-brand focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              aria-label="Choose what starts this automation"
            >
              <span
                className="flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                style={{
                  backgroundColor: `${CATEGORIES.trigger.color}22`,
                  color: CATEGORIES.trigger.color,
                }}
              >
                <IconPlus className="h-6 w-6" />
              </span>
            </button>

            {/* The wire that is not there yet, running the way the flow runs. */}
            <span
              aria-hidden
              className="h-px w-16 bg-gradient-to-r from-border to-transparent"
            />

            <div className="max-w-[220px]">
              <p className="font-heading text-sm font-semibold">
                Choose what starts this
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground font-body">
                A job finishing, an invoice being paid — pick the event and the
                rest follows from it.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* F-4: once something starts this automation, the way to add a SECOND
          trigger is a quiet corner button rather than the centred card — which
          would then be competing with the graph for attention. Without this
          there is no way to add a second trigger at all, even though the data
          model and the validator both allow up to three. */}
      {/* Ours rather than React Flow's `<Controls>`: the built-in buttons snap
          the viewport in one frame, and its `onZoomIn`/`onZoomOut` props run in
          addition to that default rather than replacing it, so they cannot be
          used to ease the change. See `canvas-controls.tsx`. */}
      <CanvasControls />

      {hasTrigger && !readOnly && (
        <button
          type="button"
          onClick={openForTrigger}
          className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-md border border-dashed border-input bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-brand hover:text-brand focus-visible:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 font-body"
        >
          <IconPlus className="h-3.5 w-3.5" />
          Add trigger
        </button>
      )}
    </div>
  );
}

/**
 * `ReactFlowProvider` is required for the hooks React Flow uses internally, and
 * must sit outside the component that calls them.
 */
export function AutomationCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
