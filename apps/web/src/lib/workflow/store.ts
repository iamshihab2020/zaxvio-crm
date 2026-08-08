import { create } from "zustand";
import { getDefinition } from "@hvac-saas/workflow-nodes";
import type { GraphEdge, GraphNode, WorkflowGraph } from "@hvac-saas/types";
import {
  buildEdge,
  buildNode,
  positionAfter,
  positionBranch,
  NODE_SPACING,
} from "./build-node";

/**
 * The builder's state.
 *
 * **Nothing mutates React Flow's state directly.** Every change — drag, connect,
 * delete, rename, a keystroke in a config field — goes through an action here.
 * That single rule is what makes undo/redo, keyboard shortcuts, insert-on-edge
 * and template install all work on one code path instead of four; the moment a
 * component calls React Flow's setters itself, undo silently stops covering
 * whatever it did.
 *
 * React Flow is fed *from* this store on every render. It is a view.
 */

// ─────────────────────────────────────────────────────────────────────────────

interface Snapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * How many steps back undo goes. Bounded because each entry holds a whole graph;
 * fifty 60-node graphs is a few megabytes, which is fine, and unbounded is not.
 */
const MAX_HISTORY = 50;

/**
 * Parameter edits made within this window on the same field collapse into one
 * undo entry.
 *
 * Without it, typing an email subject puts one entry on the stack per keystroke
 * and Ctrl+Z becomes a character-by-character eraser — technically "undo covers
 * parameter changes", uselessly.
 */
const COALESCE_MS = 600;

interface CoalesceKey {
  nodeId: string;
  field: string;
  at: number;
}

/**
 * Which half of the catalogue the palette is showing.
 *
 * The palette opens **contextually**, never as a flat list of everything:
 * clicking `+` after an email step offers actions, an empty canvas offers
 * triggers. A palette that always shows triggers invites dropping a second one
 * onto a graph that already has it — legal, and almost never meant.
 */
export type PaletteMode = "trigger" | "action";

export interface BuilderState {
  nodes: GraphNode[];
  edges: GraphEdge[];

  /** Differs from what was last saved. Drives the Save button, not Publish. */
  dirty: boolean;
  selectedNodeId: string | null;

  // ── palette ───────────────────────────────────────────────────────────────
  // Held in the store rather than in the canvas, because three different
  // components open it: the canvas (`+` handles and edges), the empty-state
  // card, and the toolbar's "Add trigger". Local state would mean passing
  // callbacks down and back up through the builder shell.
  paletteOpen: boolean;
  paletteMode: PaletteMode;
  /** Set when the chosen step should wire itself to an existing output. */
  pendingSource: { nodeId: string; handleId: string } | null;
  /** Set when the chosen step should splice into an existing connection. */
  pendingEdgeId: string | null;
  /**
   * Where to drop the chosen step, in canvas coordinates.
   *
   * Set only by the drag-a-wire-into-empty-space gesture, where the user has
   * already pointed at the spot they want it. Every other path leaves this null
   * and lets `positionAfter` lay the step out, because a click on a `+` says
   * nothing about position.
   */
  pendingPosition: { x: number; y: number } | null;

  past: Snapshot[];
  future: Snapshot[];
  /** Set while a parameter edit is coalescing; not part of the graph. */
  lastEdit: CoalesceKey | null;

  // ── lifecycle ─────────────────────────────────────────────────────────────
  load: (graph: WorkflowGraph) => void;
  markSaved: () => void;
  toGraph: () => WorkflowGraph;

  // ── selection ─────────────────────────────────────────────────────────────
  select: (nodeId: string | null) => void;

  // ── palette ───────────────────────────────────────────────────────────────
  openPaletteForTrigger: () => void;
  openPaletteForAction: (
    sourceNodeId: string,
    sourceHandle: string,
    position?: { x: number; y: number },
  ) => void;
  openPaletteForEdgeInsert: (edgeId: string) => void;
  closePalette: () => void;
  /**
   * Place whatever the palette was opened for.
   *
   * The three cases resolve here rather than at the call site, so the palette
   * component only has to know "the user picked this type" — it never has to
   * work out whether that means append, branch or splice.
   */
  addFromPalette: (nodeType: string) => void;

  // ── nodes ─────────────────────────────────────────────────────────────────
  addNode: (nodeType: string, position: { positionX: number; positionY: number }) => string;
  /** Add a node and wire it to `sourceNodeId`'s given output in one step. */
  addNodeFromHandle: (sourceNodeId: string, sourceHandle: string, nodeType: string) => string;
  /** Drop a node onto an existing edge, splicing it between the two ends. */
  insertOnEdge: (edgeId: string, nodeType: string) => string;
  moveNode: (nodeId: string, positionX: number, positionY: number) => void;
  renameNode: (nodeId: string, label: string) => void;
  setNodeParameter: (nodeId: string, field: string, value: unknown) => void;
  toggleNodeDisabled: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;

  // ── edges ─────────────────────────────────────────────────────────────────
  connect: (sourceNodeId: string, sourceHandle: string, targetNodeId: string) => void;
  deleteEdge: (edgeId: string) => void;

  // ── history ───────────────────────────────────────────────────────────────
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

/**
 * Every node reachable from `startId`, inclusive.
 *
 * Used to move a whole downstream branch when a step is spliced in ahead of it.
 * Cycle-safe, because `logic.goto` and `logic.loop` make the graph a real graph
 * rather than a tree — without the `seen` set an inserted step in a loop would
 * hang the browser rather than misplace a node.
 */
function collectDownstream(
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  startId: string,
): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = outgoing.get(edge.sourceNodeId);
    if (list) list.push(edge.targetNodeId);
    else outgoing.set(edge.sourceNodeId, [edge.targetNodeId]);
  }

  const seen = new Set<string>();
  const queue = [startId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of outgoing.get(id) ?? []) queue.push(next);
  }
  return seen;
}

export const useBuilderStore = create<BuilderState>((set, get) => {
  /**
   * Push the current graph onto the undo stack and apply a change.
   *
   * Every mutating action goes through here, so "did I remember to record
   * history for this one" is not a question anyone has to ask per action.
   */
  function commit(
    mutate: (draft: Snapshot) => Snapshot,
    options?: { coalesce?: CoalesceKey },
  ) {
    set((state) => {
      const current: Snapshot = { nodes: state.nodes, edges: state.edges };
      const next = mutate(current);

      // Coalescing replaces the top of the stack instead of growing it, so a
      // burst of keystrokes in one field is one undo step.
      const sameField =
        options?.coalesce &&
        state.lastEdit &&
        state.lastEdit.nodeId === options.coalesce.nodeId &&
        state.lastEdit.field === options.coalesce.field &&
        options.coalesce.at - state.lastEdit.at < COALESCE_MS;

      const past = sameField
        ? state.past
        : [...state.past, current].slice(-MAX_HISTORY);

      return {
        nodes: next.nodes,
        edges: next.edges,
        past,
        // Any new change invalidates the redo branch — standard, and the
        // alternative (keeping it) lets redo reapply a change to a graph that
        // no longer has the node it referred to.
        future: [],
        dirty: true,
        lastEdit: options?.coalesce ?? null,
      };
    });
  }

  return {
    nodes: [],
    edges: [],
    dirty: false,
    selectedNodeId: null,
    paletteOpen: false,
    paletteMode: "trigger",
    pendingSource: null,
    pendingEdgeId: null,
    pendingPosition: null,
    past: [],
    future: [],
    lastEdit: null,

    load: (graph) =>
      set({
        nodes: graph.nodes,
        edges: graph.edges,
        // A fresh load is not an edit and must not be undoable — undoing past
        // the loaded state would leave the canvas showing a graph that was
        // never saved and cannot be reached again.
        past: [],
        future: [],
        dirty: false,
        selectedNodeId: null,
        lastEdit: null,
        // Reset the palette too. Loading a different automation while it is
        // open would otherwise leave it holding a `pendingSource` pointing at a
        // node id from the previous graph — and the next pick would wire itself
        // to nothing.
        paletteOpen: false,
        paletteMode: "trigger",
        pendingSource: null,
        pendingEdgeId: null,
        pendingPosition: null,
      }),

    markSaved: () => set({ dirty: false, lastEdit: null }),

    toGraph: () => ({ nodes: get().nodes, edges: get().edges }),

    select: (nodeId) => set({ selectedNodeId: nodeId }),

    // ── palette ─────────────────────────────────────────────────────────────

    openPaletteForTrigger: () =>
      set({
        paletteOpen: true,
        paletteMode: "trigger",
        pendingSource: null,
        pendingEdgeId: null,
        pendingPosition: null,
      }),

    openPaletteForAction: (sourceNodeId, sourceHandle, position) =>
      set({
        paletteOpen: true,
        paletteMode: "action",
        pendingSource: { nodeId: sourceNodeId, handleId: sourceHandle },
        pendingEdgeId: null,
        pendingPosition: position ?? null,
      }),

    openPaletteForEdgeInsert: (edgeId) =>
      set({
        paletteOpen: true,
        paletteMode: "action",
        pendingSource: null,
        pendingEdgeId: edgeId,
        pendingPosition: null,
      }),

    // Clears the pending target as well as closing. A palette dismissed with
    // Escape and reopened from somewhere else must not still be holding the
    // handle it was opened from three clicks ago.
    closePalette: () =>
      set({
        paletteOpen: false,
        pendingSource: null,
        pendingEdgeId: null,
        pendingPosition: null,
      }),

    addFromPalette: (nodeType) => {
      const state = get();
      let addedId: string;

      if (state.pendingEdgeId) {
        addedId = state.insertOnEdge(state.pendingEdgeId, nodeType);
      } else if (state.pendingSource && state.pendingPosition) {
        // Dropped in empty space: the user pointed at the spot, so place it
        // there rather than where the layout would have put it. Wiring it up is
        // still the same edge — only the position is user-chosen.
        const node = buildNode({
          nodeType,
          positionX: state.pendingPosition.x,
          positionY: state.pendingPosition.y,
        });
        const edge = buildEdge({
          sourceNodeId: state.pendingSource.nodeId,
          sourceHandle: state.pendingSource.handleId,
          targetNodeId: node.id,
        });
        commit((draft) => ({
          nodes: [...draft.nodes, node],
          edges: [...draft.edges, edge],
        }));
        set({ selectedNodeId: node.id });
        addedId = node.id;
      } else if (state.pendingSource) {
        addedId = state.addNodeFromHandle(
          state.pendingSource.nodeId,
          state.pendingSource.handleId,
          nodeType,
        );
      } else {
        // A free-standing step: the first trigger, or an additional one. Placed
        // clear of what is already there rather than at the origin, where it
        // would land on top of an existing trigger.
        const lowest = state.nodes.reduce((max, n) => Math.max(max, n.positionY), -200);
        const offset = state.nodes.length === 0 ? 0 : lowest + 200;
        addedId = state.addNode(nodeType, { positionX: 0, positionY: offset });
      }

      // **The next pick chains off the step just added.**
      //
      // Without this the panel stays open with no pending target, so every
      // subsequent choice drops a disconnected node in the middle of the canvas
      // — which is exactly what happened: three steps, no connections, and no
      // hint that anything was wrong. Picking twice in a row now builds a
      // chain, which is what "the panel stays open" was for.
      //
      // Chains from the node's FIRST output. A branching step is the exception
      // and deliberately clears instead: guessing which branch the user meant is
      // worse than making them click the branch they want.
      const added = get().nodes.find((n) => n.id === addedId);
      const outputs = added ? (getDefinition(added.nodeType)?.outputs ?? []) : [];
      const chainable = outputs.length === 1;

      set({
        pendingSource: chainable ? { nodeId: addedId, handleId: outputs[0].id } : null,
        pendingEdgeId: null,
        // Cleared unconditionally: the position belonged to one drop gesture,
        // and leaving it set would stack every subsequent pick on that spot.
        pendingPosition: null,
        // Once something starts the automation, the panel is offering what
        // happens next — never another trigger.
        paletteMode: "action",
      });
    },

    // ── nodes ───────────────────────────────────────────────────────────────

    addNode: (nodeType, position) => {
      const node = buildNode({ nodeType, ...position });
      commit((draft) => ({ ...draft, nodes: [...draft.nodes, node] }));
      set({ selectedNodeId: node.id });
      return node.id;
    },

    addNodeFromHandle: (sourceNodeId, sourceHandle, nodeType) => {
      const state = get();
      const parent = state.nodes.find((n) => n.id === sourceNodeId);
      const def = parent ? getDefinition(parent.nodeType) : undefined;

      // A single output continues the row; several fan vertically. Both align
      // the new step's centre with its parent's, so the connection is level.
      const outputs = def?.outputs ?? [];
      const index = Math.max(0, outputs.findIndex((o) => o.id === sourceHandle));
      const position = parent
        ? outputs.length > 1
          ? positionBranch(parent, nodeType, index, outputs.length)
          : positionAfter(parent, nodeType)
        : { positionX: 0, positionY: 0 };

      const node = buildNode({ nodeType, ...position });
      const edge = buildEdge({ sourceNodeId, sourceHandle, targetNodeId: node.id });

      commit((draft) => ({
        nodes: [...draft.nodes, node],
        edges: [...draft.edges, edge],
      }));
      set({ selectedNodeId: node.id });
      return node.id;
    },

    insertOnEdge: (edgeId, nodeType) => {
      const state = get();
      const edge = state.edges.find((e) => e.id === edgeId);
      if (!edge) return "";

      const source = state.nodes.find((n) => n.id === edge.sourceNodeId);
      const target = state.nodes.find((n) => n.id === edge.targetNodeId);

      /**
       * The new step takes its own column, and everything downstream moves
       * right to make room.
       *
       * Placing it at the *midpoint* of the two ends is the obvious idea and it
       * is wrong: the gap between two adjacent steps is one column of spacing,
       * and half a column is narrower than a node — so the inserted step landed
       * on top of the one it was inserted before. It looked like nothing had
       * been added, or like two steps had merged.
       *
       * Shifting the downstream is what makes the insert *look* like an insert.
       * The alternative — leaving the graph to overlap and expecting the user to
       * drag things apart — is asking them to clean up after the tool.
       */
      const position = source
        ? positionAfter(source, nodeType)
        : { positionX: 0, positionY: 0 };

      const node = buildNode({ nodeType, ...position });

      // Everything reachable from the edge's target, so a whole downstream
      // branch travels together rather than the next node alone.
      const shifted = target ? collectDownstream(state, target.id) : new Set<string>();

      commit((draft) => ({
        nodes: [
          ...draft.nodes.map((n) =>
            shifted.has(n.id)
              ? { ...n, positionX: n.positionX + NODE_SPACING.x }
              : n,
          ),
          node,
        ],
        edges: [
          // The original edge is replaced by two, and the first keeps the
          // original `sourceHandle` — inserting a step into the "Not found"
          // branch must leave it in that branch.
          ...draft.edges.filter((e) => e.id !== edgeId),
          buildEdge({
            sourceNodeId: edge.sourceNodeId,
            sourceHandle: edge.sourceHandle,
            targetNodeId: node.id,
          }),
          buildEdge({ sourceNodeId: node.id, targetNodeId: edge.targetNodeId }),
        ],
      }));
      set({ selectedNodeId: node.id });
      return node.id;
    },

    moveNode: (nodeId, positionX, positionY) =>
      commit((draft) => ({
        ...draft,
        nodes: draft.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, positionX: Math.round(positionX), positionY: Math.round(positionY) }
            : n,
        ),
      })),

    renameNode: (nodeId, label) =>
      commit(
        (draft) => ({
          ...draft,
          nodes: draft.nodes.map((n) =>
            n.id === nodeId ? { ...n, nodeConfig: { ...n.nodeConfig, label } } : n,
          ),
        }),
        { coalesce: { nodeId, field: "__label", at: Date.now() } },
      ),

    setNodeParameter: (nodeId, field, value) =>
      commit(
        (draft) => ({
          ...draft,
          nodes: draft.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  nodeConfig: {
                    ...n.nodeConfig,
                    parameters: { ...n.nodeConfig.parameters, [field]: value },
                  },
                }
              : n,
          ),
        }),
        { coalesce: { nodeId, field, at: Date.now() } },
      ),

    toggleNodeDisabled: (nodeId) =>
      commit((draft) => ({
        ...draft,
        nodes: draft.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, nodeConfig: { ...n.nodeConfig, disabled: !n.nodeConfig.disabled } }
            : n,
        ),
      })),

    /**
     * Delete a node and **relink its neighbours** (X-1).
     *
     * Without the relink, deleting a middle step silently severs the automation:
     * everything below it becomes unreachable, the graph still looks connected
     * at a glance, and the user finds out when it stops running.
     *
     * Only the simple case is relinked — one way in, one way out. A branching
     * node has no single successor to promote, so its edges are dropped and the
     * validator's "unconnected branch output" / orphan rules report the result
     * rather than this guessing which branch the user meant to keep.
     */
    deleteNode: (nodeId) => {
      commit((draft) => {
        const incoming = draft.edges.filter((e) => e.targetNodeId === nodeId);
        const outgoing = draft.edges.filter((e) => e.sourceNodeId === nodeId);

        const kept = draft.edges.filter(
          (e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId,
        );

        const relinked =
          incoming.length === 1 && outgoing.length === 1
            ? [
                buildEdge({
                  sourceNodeId: incoming[0].sourceNodeId,
                  // The surviving edge keeps the *incoming* handle, so a step
                  // deleted from inside a branch leaves that branch intact.
                  sourceHandle: incoming[0].sourceHandle,
                  targetNodeId: outgoing[0].targetNodeId,
                }),
              ]
            : [];

        return {
          nodes: draft.nodes.filter((n) => n.id !== nodeId),
          edges: [...kept, ...relinked],
        };
      });
      if (get().selectedNodeId === nodeId) set({ selectedNodeId: null });
    },

    // ── edges ───────────────────────────────────────────────────────────────

    connect: (sourceNodeId, sourceHandle, targetNodeId) =>
      commit((draft) => {
        // A node may not feed itself, and the same handle may not be wired to
        // the same target twice — React Flow will happily emit both.
        if (sourceNodeId === targetNodeId) return draft;
        const exists = draft.edges.some(
          (e) =>
            e.sourceNodeId === sourceNodeId &&
            e.sourceHandle === sourceHandle &&
            e.targetNodeId === targetNodeId,
        );
        if (exists) return draft;

        return {
          ...draft,
          edges: [
            ...draft.edges,
            buildEdge({ sourceNodeId, sourceHandle, targetNodeId }),
          ],
        };
      }),

    deleteEdge: (edgeId) =>
      commit((draft) => ({
        ...draft,
        edges: draft.edges.filter((e) => e.id !== edgeId),
      })),

    // ── history ─────────────────────────────────────────────────────────────

    undo: () =>
      set((state) => {
        const previous = state.past[state.past.length - 1];
        if (!previous) return state;
        return {
          nodes: previous.nodes,
          edges: previous.edges,
          past: state.past.slice(0, -1),
          future: [{ nodes: state.nodes, edges: state.edges }, ...state.future],
          dirty: true,
          lastEdit: null,
        };
      }),

    redo: () =>
      set((state) => {
        const [next, ...rest] = state.future;
        if (!next) return state;
        return {
          nodes: next.nodes,
          edges: next.edges,
          past: [...state.past, { nodes: state.nodes, edges: state.edges }].slice(-MAX_HISTORY),
          future: rest,
          dirty: true,
          lastEdit: null,
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});
