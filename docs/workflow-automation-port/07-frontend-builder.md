# 07 — Frontend Builder

Stack: **Next.js 16 App Router + React Flow (`@xyflow/react` ^12.9.3) + Zustand + shadcn/ui**.
~3,700 lines of canvas/node/sidebar/edge components plus a 2,076-line Zustand store and a
~4,100-line config panel.

> **This is n8n's editor, rebuilt in React.** Palette on the left → infinite node canvas in the
> middle → config drawer on the right whose form is *generated from the node's JSON description*.
> Same interaction grammar: drag from the palette, connect handle-to-handle, click a node to
> configure it, run a test and inspect each node's input/output. n8n uses Vue Flow; SiloCRM uses
> React Flow — the underlying library (both descend from the same `reactflow` lineage) and the
> resulting UX are effectively the same.
>
> The CRM-specific departures: contextual palette filtering (triggers vs actions), CRM-bound picker
> field types, variable *pills* instead of raw expression syntax, and an execution replay tied to a
> contact rather than to an items array.
>
> **Implementation rules — node chrome, handle affordances, form generation, validation, and
> performance — are in [`11-frontend-guidelines.md`](11-frontend-guidelines.md).** This chapter
> describes what SiloCRM built; chapter 11 says how to build it.

## 7.1 Composition

```mermaid
graph TB
    PAGE["/automation/[id]/page.tsx"] --> BUILDER["workflow-builder.tsx (268)"]

    BUILDER --> TOOLBAR["workflow-toolbar/<br/>name · save · activate · test<br/>undo/redo · settings · AI"]
    BUILDER --> SIDEBAR["workflow-sidebar/ (321+124+145+87)<br/>node palette: search,<br/>category → subcategory,<br/>'coming soon' greying"]
    BUILDER --> CANVAS["workflow-canvas.tsx (751)<br/>React Flow host"]
    BUILDER --> PANEL["workflow-config-panel/<br/>right drawer"]
    BUILDER --> EB["workflow-error-boundary.tsx"]

    CANVAS --> NODES["workflow-nodes/<br/>trigger-node · action-node<br/>base-workflow-node · node-handles<br/>node-icon · node-context-menu<br/>trigger-placeholder-node"]
    CANVAS --> EDGES["workflow-edges/<br/>workflow-edge (216)<br/>edge-node-selector (109)<br/><i>'+' button inserts a node mid-edge</i>"]
    CANVAS --> CTRLS["workflow-controls · minimap<br/>background · add-trigger-button"]
    CANVAS --> BRANCH["branch-selector-modal (326)<br/>branch-delete-confirm (79)"]

    PANEL --> HEADER["node-info-header<br/>node-how-it-works"]
    PANEL --> RENDER["config-renderer.tsx (187)<br/><b>renders the form from<br/>NodeDefinition.properties</b>"]
    PANEL --> AUTO["auto-generated-config.tsx (154)<br/>generic fallback renderer"]
    PANEL --> CUSTOM["configs/ — 30 bespoke panels<br/>for complex nodes"]
    PANEL --> TEST["test-action-dialog.tsx (354)<br/>run ONE node in isolation"]

    RENDER --> FIELDS["fields/ — 28 field renderers<br/>one per NodePropertyType"]

    STORE[("Zustand store<br/>workflow-store.ts (2,076)<br/>80 actions")]
    TOOLBAR <--> STORE
    SIDEBAR <--> STORE
    CANVAS <--> STORE
    PANEL <--> STORE

    COPILOT["silopilot/<br/>AI workflow copilot"] --> STORE
    STORE -->|"PUT /api/workflows/:id/graph"| API[("API")]

    classDef store fill:#4a2f1a,stroke:#f59e0b,color:#faf0e8
    class STORE store
```

## 7.2 The config panel — the highest-leverage piece

```mermaid
flowchart LR
    SEL["user selects a node"] --> DEF["nodeRegistry.getDefinition(node_type)"]
    DEF --> CUSTOM{"a bespoke panel exists<br/>in configs/ for this type?"}
    CUSTOM -->|yes| BESPOKE["render e.g. condition-if-config.tsx<br/>(branch builder UI)"]
    CUSTOM -->|no| LOOP["for each definition.properties[]"]

    LOOP --> VIS{"displayOptions.show / hide<br/>satisfied by sibling values?"}
    VIS -->|no| SKIP["render nothing"]
    VIS -->|yes| TYPE["switch on property.type"]

    TYPE --> F1["field-string / -number / -boolean<br/>-json / -datetime / -time"]
    TYPE --> F2["field-options / -multi-options"]
    TYPE --> F3["field-user-select / -agent-select<br/>-tag-select / -multi-tag-select<br/>-pipeline-select / -stage-select<br/>-custom-field-select / -workflow-select<br/>-account-select / -conversion-action-select"]
    TYPE --> F4["field-email-list / -phone-list<br/>-key-value / -custom-field-list<br/>-contact-field-update-list"]
    TYPE --> F5["field-notice (display only)<br/>field-rich-text (Lexical)<br/>field-string-with-suggestions"]

    F1 --> WRITE
    F2 --> WRITE
    F3 --> WRITE
    F4 --> WRITE
    F5 --> WRITE
    BESPOKE --> WRITE

    WRITE["updateNode — merge into<br/>node_config.parameters<br/>→ Zustand → dirty flag"]

    VAR["variable-pill-input / -textarea<br/>+ variable-selector"] -.->|"variable insertion<br/>into any text field"| F1
```

**Two-tier rendering is the key idea.** A generic renderer covers ~126 of 156 nodes purely from
JSON; 30 nodes with genuinely complex UX (`condition.if`'s branch/condition-group builder,
`delay.wait`'s duration-vs-datetime-vs-business-hours modes, `email.send`'s rich-text editor and
preview modal, `http.request`'s multi-tab request builder) get a bespoke panel.

**Port advice:** build the generic renderer first and resist writing bespoke panels until a node
genuinely can't be expressed declaratively. Every bespoke panel is a place the JSON contract stops
being the source of truth.

### The variable-pill input

`fields/variable-pill-input.tsx` / `-textarea.tsx` / `lexical/` — text inputs where `{{contact.name}}`
renders as a removable **pill** rather than raw braces, backed by Lexical for the rich-text case.
Paired with `variable-selector/` (searchable, **trigger-scoped**) and `smart-value-input.tsx`.

This is the difference between "power users can do it" and "anyone can do it." Budget real time
for it.

## 7.3 The store — 80 actions

`apps/web/src/lib/workflow/store/workflow-store.ts` (2,076 lines). Grouped:

| Group | Actions |
|---|---|
| Workflow meta | `setWorkflow`, `updateWorkflowMetadata`, `updateWorkflowName`, `toggleWorkflowStatus`, `deleteWorkflow`, `updateWorkflowSettings`, `setScope` |
| Graph edits | `onNodesChange`, `addNode`, `updateNode`, `deleteNode`, `onEdgesChange`, `onConnect`, `addEdgeWithData`, `deleteEdge`, `insertNodeOnEdge` |
| Selection | `selectNode(s)`, `addToSelection`, `removeFromSelection`, `selectAllNodes`, `clearSelection` |
| Clipboard | `copySelectedNodes`, `cutSelectedNodes`, `pasteNodes`, `deleteSelectedNodes` |
| Enable/lock | `toggleSelectedNodesDisabledStatus`, `areAllSelectedNodesDisabled`, `toggleNodeLock`, `lockSelectedNodes`, `unlockSelectedNodes`, `toggleGlobalLock` |
| Layout | `applyAutoLayout`, `alignSelectedNodes`, `distributeSelectedNodes`, `tidySelectedNodes`, `toggleSnapToGrid` |
| History | `undo`, `redo`, `pushHistory` |
| Persistence | `saveWorkflow`, `loadWorkflow`, `markAsSaved`, `reset` |
| Testing | `openTestModal`, `closeTestModal`, `setTestRunning`, `setTestResults`, `clearTestResults` |
| Live run visuals | `setExecutingNode`, `addExecutedNode`, `setExecutingEdges`, `clearExecutionVisuals` |
| Palette flow | `setSidebarFilterMode`, `setPendingNodeSource`, `openSidebarForTrigger`, `openSidebarForAction`, `openSidebarForEdgeInsert`, `requestAddNode`, `clearPendingAddNode` |
| Branching | `setPendingConnection`, `openBranchSelector`, `closeBranchSelector`, `confirmBranchDelete`, `cancelBranchDelete` |

**Everything goes through the store; nothing mutates React Flow state directly.** That's what makes
undo/redo, the AI copilot, and keyboard shortcuts all work on the same code path.

## 7.4 UX inventory

Features SiloCRM shipped that materially affect whether users adopt the builder:

| Feature | Where | Worth it? |
|---|---|---|
| Insert node **on an edge** (a `+` on the connector) | `edge-node-selector.tsx` | **Yes — highest ROI single feature.** Users build linearly. |
| Context-aware palette (`openSidebarForTrigger` vs `ForAction`) | store + sidebar | Yes — never offers a trigger where an action belongs |
| Branch selector modal when connecting from a multi-output node | `branch-selector-modal.tsx` | Yes — otherwise handle routing is invisible |
| Auto-layout / align / distribute / tidy | `utils/auto-layout.ts`, `alignment.ts` | Nice-to-have; `applyAutoLayout` earns its keep on AI-generated graphs |
| **Relink on delete** — deleting a mid-chain node reconnects its neighbours | `utils/relink-on-delete.ts` (256) | **Yes.** Without it, deleting a node silently breaks the chain |
| Undo/redo with history stack | store | Yes |
| Copy/cut/paste nodes | store | Yes |
| Node lock (individual + global) | store | Marginal |
| Disable a node without deleting it | `node_config.disabled` → engine skips + logs `skipped` | **Yes** — the debugging primitive |
| Client-side validation before save | `utils/validate-workflow.ts` (213) + `validation-error-dialog.tsx` | Yes |
| Test a **single node** in isolation | `test-action-dialog.tsx` + `POST /api/workflows/test-action` | **Yes** — the difference between 30s and 10min feedback loops |
| Test the whole workflow with sample data | `test-workflow/` + `workflow-sample-data.tsx` | Yes |
| **Live execution visuals** (node pulses as it runs) | `setExecutingNode` / `setExecutingEdges` | High delight, low cost |
| Execution replay viewer | `execution-replay/`, `/automation/[id]/replay/[executionId]` | **Yes** — support burden without it is severe |
| Run-from-node replay | `POST /:id/executions/:executionId/run-from-node` | Yes, for debugging production runs |
| Enrollment history (who's in this workflow) | `enrollment-history.tsx`, `/automation/enrollments` | Yes |
| Folders | `workflow-folders` routes + table | Yes past ~20 workflows |
| Duplicate workflow | `duplicate-workflow-dialog/` | Yes |
| Mobile variants | `workflow-builder/_mobile`, `workflow-toolbar/_mobile` | Marginal — graph editing on a phone is inherently rough |
| **AI copilot** | `silopilot/` | See §7.6 |

## 7.5 Preloading

`automation-preloader.tsx` + `automation-loading-skeleton.tsx`. The builder needs the node registry,
the tenant's pipelines/stages/tags/users/custom fields (for the picker property types), and the
workflow graph. Preloading and skeletons — not spinners — are the repo convention.

## 7.6 The AI copilot (SiloPilot)

An LLM assistant embedded in the builder that can **construct and modify the graph**, not just chat.

```mermaid
sequenceDiagram
    participant U as user
    participant W as builder
    participant P as SiloPilot backend
    participant M as model

    W->>P: buildWorkflowContext()<br/>current nodes, edges, selection,<br/>trigger-scoped variable list
    P->>P: buildWorkflowAdvisorAddendum()<br/>appended to the base system prompt
    Note over P: injects REAL config schemas for<br/>node types already in the workflow<br/>(capped: 60 nodes, 100 edges,<br/>120 vars, 8 injected schemas)
    P->>M: prompt + tools:<br/>list_node_types · get_node_schema · validate_workflow
    U->>M: "text them 3 days after they book"
    M->>P: WORKFLOW_CHANGE ops v2:<br/>add / connect / update / delete
    P->>W: ops
    W->>W: applyWorkflowChange() →<br/>buildNodeFromDefinition() (SAME constructor<br/>as palette drag-and-drop)
    W->>U: nodes appear on the canvas
```

Three design choices that make it work:

1. **It reads the same node registry the editor does**, filtered by `getActiveNodeDefinitions()` —
   so it can never propose a coming-soon or wrong-scope node.
2. **It calls `get_node_schema` rather than guessing parameter names.** Real schemas are injected
   for node types already present; everything else is fetched on demand.
3. **It applies changes through `buildNodeFromDefinition()`** — the identical constructor used by
   drag-and-drop. An AI-created node is byte-identical to a hand-created one.

**Port advice:** this is a genuine differentiator and much cheaper than it looks *once the
declarative node registry exists* — the registry doubles as the model's tool schema. Build it after
the registry, not before.

## 7.7 Build-time gotcha to carry over

`apps/web`'s Vercel build is OOM-sensitive during "Collecting page data". Two rules from the repo:

- **Never wildcard-import from an icon library** (`import * as Icons from "lucide-react"`). Use
  explicit imports or a curated map — SiloCRM keeps `workflow-icon-map.ts` for exactly this, since
  node definitions reference icons by *name string* and something must resolve name → component
  without pulling in the whole library.
- **Never glob-import the node registry.** Keep the ~120 explicit `import x from "./registry/y.json"`
  lines.

A node registry that references icons by string is otherwise a natural place to reach for a
wildcard import. Don't.
