# 11 — Frontend Guidelines

Implementation rules for building the builder UI. This is **n8n's editor model applied to a CRM** —
if you've used n8n, you already know the shape: a node palette on one side, an infinite canvas in the
middle, and a config drawer whose form is *generated from the node's JSON schema*. SiloCRM's builder
is that, with n8n's generic "items flowing through nodes" replaced by CRM-native pickers (pipelines,
stages, tags, users, custom fields) and a contact/lead as the subject of every run.

Where this doc says "MUST", it's a rule that caused a real bug in SiloCRM when broken.

---

## 11.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Canvas | **`@xyflow/react` v12** (React Flow) | The only mature React graph editor. Handles pan/zoom, handles, minimap, selection box, connection dragging. n8n uses its own Vue Flow equivalent. |
| State | **Zustand**, one store | React Flow's own `onNodesChange`/`onEdgesChange` plug straight into it. Redux is overkill; Context re-renders the whole canvas. |
| Forms | **Generated from node JSON** | See §11.4. Do not reach for react-hook-form per node — the whole point is that nodes don't have hand-written forms. |
| Components | shadcn/ui + Tailwind | Whatever your CRM already uses. Consistency with the rest of the app beats builder-specific styling. |
| Rich text | Lexical | Only for the email-body field. Don't use it for plain inputs. |
| Icons | Explicit imports or a curated name→component map | **Never wildcard-import an icon library** (§11.10) |

---

## 11.2 Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR   ← name (inline-editable) · Save · Active toggle · Test ·       │
│             Undo/Redo · Settings · AI                                    │
├────────────┬────────────────────────────────────────────┬────────────────┤
│            │                                            │                │
│  PALETTE   │              CANVAS                         │  CONFIG PANEL  │
│  (left)    │                                            │  (right drawer)│
│            │   ┌──────────┐        ┌──────────┐         │                │
│  search    │   │ ▶ Trigger│───────▶│ Send SMS │──╌╌ +   │  node header   │
│  ────────  │   └──────────┘        └──────────┘         │  ──────────    │
│  ▾ Triggers│                                            │  generated     │
│    Lead    │                                            │  form fields   │
│    Contact │              [minimap]      [zoom controls]│  ──────────    │
│  ▾ Actions │                                            │  Test action   │
│            │                                            │                │
├────────────┴────────────────────────────────────────────┴────────────────┤
```

Rules:

- **The palette opens contextually, not permanently.** A user clicking `+` after an SMS node should
  see *actions*, never triggers. SiloCRM does this with `openSidebarForTrigger()` /
  `openSidebarForAction(nodeId, handleId)` / `openSidebarForEdgeInsert()` — three entry points, one
  sidebar, filtered differently.
- **The config panel is a drawer over the canvas, not a modal.** Users need to see the graph while
  editing a node. A modal breaks the mental model.
- **Nothing mutates React Flow state directly.** Every change goes through the store. This is what
  makes undo/redo, keyboard shortcuts, and an AI copilot all work on one code path.

---

## 11.3 The node component

SiloCRM's `base-workflow-node.tsx` is 134 lines and worth copying nearly literally.

```tsx
<div
  className={cn(
    "relative rounded-lg border bg-card p-4 shadow-lg transition-all hover:shadow-xl",
    selected            && "border-primary shadow-primary/20 ring-2 ring-primary/20",
    hasMissingFields    && "border-amber-500/50",
    isExecuting         && "node-executing border-primary",
    isSpotlighted       && "ring-4 ring-amber-400 animate-pulse",   // AI just added/changed this
  )}
  style={{ minWidth: 220, maxWidth: 320 }}
>
  <NodeHandles inputs={def.inputs} outputs={def.outputs} outputLabels={def.outputLabels} />

  <div className="flex items-center gap-3">
    {/* icon tile tinted with the node's colour at 12% alpha */}
    <div className="flex h-10 w-10 items-center justify-center rounded-lg"
         style={{ backgroundColor: `${nodeColor}20` }}>
      <NodeIcon icon={def.icon} color={nodeColor} size={20} iconLibrary={def.iconLibrary} />
    </div>

    <div className="flex-1 min-w-0">
      <div className="truncate text-sm font-semibold">{label}</div>       {/* user's label */}
      <div className="text-xs text-muted-foreground">{def.displayName}</div> {/* node type */}
    </div>
  </div>

  {/* corner badge: ✓ success · ✕ error · ⚠ missing required fields */}
</div>
```

### Rules

| # | Rule |
|---|---|
| FE-N1 | **Fixed width band (220–320px).** Variable-width nodes make graphs look chaotic and break auto-layout. |
| FE-N2 | **Two lines of text: the user's label on top, the node type beneath.** Users rename nodes ("Text the lead"), and without the second line they lose track of what the node actually *is*. |
| FE-N3 | **Colour comes from the subcategory, falling back to the category, falling back to the node's own colour.** SiloCRM's `getNodeColor()` does exactly this. Per-node colours produce a rainbow; per-category is too coarse to distinguish an SMS from an email. |
| FE-N4 | **Show a ⚠ badge when required fields are empty**, with a tooltip listing them. This is the cheapest possible "why won't this work" affordance. |
| FE-N5 | **Show ✓/✕ execution badges after a test run.** |
| FE-N6 | **`memo` with a custom comparator.** SiloCRM compares `id`, `selected`, `label`, `definition.node`, and `JSON.stringify(parameters)`. Without it, every store update re-renders every node and the canvas stutters past ~30 nodes. |
| FE-N7 | **A disabled node must look disabled** (reduced opacity + a strikethrough or "Disabled" chip). It's the primary debugging tool; users need to see at a glance what's off. |

---

## 11.4 Handles and the `+` affordance

This is the single highest-ROI piece of the whole builder. From `node-handles.tsx`:

- Handles are 12px circles, `-6px` outside the node edge, with `cursor-crosshair` and a
  `hover:scale-125` micro-interaction.
- Multi-output nodes distribute handles vertically: `top = (index + 1) / (outputs.length + 1) * 100%`.
- **Every unconnected output renders a dashed connector line ending in a `+` button.** Clicking it
  opens the palette in action mode, pre-wired to that node and handle. Users build linearly by
  clicking `+`, not by dragging.
- Branch outputs get a small label badge (`Found` / `Not Found`) positioned beside the handle, and
  the `+` shifts right to make room for it.

```
   ┌──────────────┐
   │  Lead Lookup │◉╌╌╌╌ [Found]    ╌╌╌ (+)
   │              │◉╌╌╌╌ [Not Found]╌╌╌ (+)
   └──────────────┘
```

| # | Rule |
|---|---|
| FE-H1 | **MUST** render a `+` on every unconnected output. |
| FE-H2 | **MUST** render a `+` on the midpoint of every edge, to insert a node between two existing ones. |
| FE-H3 | **MUST** label multi-output handles. An unlabelled two-output node is unusable. |
| FE-H4 | **Handle ids are stable strings, never the display label.** SiloCRM stores the *label* in `sourceHandle`, so renaming "Found" would break routing on every saved workflow. Use `found` / `not_found` with a separate `outputLabels`. |
| FE-H5 | When a user drags a connection *from* a multi-output node, open a branch-selector modal rather than guessing the handle. |

---

## 11.5 The config panel — generated forms

**The whole architecture rests on this: a node's form is rendered from its JSON, not hand-written.**

```
selectNode
   → nodeRegistry.getDefinition(node_type)
   → is there a bespoke panel in configs/ for this type?
        yes → lazy-load it
        no  → for each definition.properties[]:
                 evaluate displayOptions.show / .hide against sibling values
                 switch (property.type) → the matching field renderer
   → onChange → store.updateNode(id, { parameters: { ...next } })
```

### Field renderer contract

One component per `NodePropertyType`, all with the same props:

```tsx
interface FieldProps<T = unknown> {
  property: NodeProperty;          // the JSON declaration
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  nodeId: string;                  // some pickers need workflow/org context
}
```

Wrap them all in one `<FieldWrapper>` that renders label, required marker, description, hint, and
error consistently — so a new field type is ~30 lines, not 80.

### Build order for field types

| Phase | Types | Notes |
|---|---|---|
| P1 (10) | `string`, `number`, `boolean`, `options`, `multiOptions`, `json`, `dateTime`, `time`, `keyValue`, `notice` | Covers most logic/data/integration nodes |
| P4 (12) | `userSelect`, `tagSelect`, `multiTagSelect`, `pipelineSelect`, `stageSelect`, `customFieldSelect`, `workflowSelect`, `emailList`, `phoneList`, `contactFieldUpdateList`, `richText`, `stringWithSuggestions` | **These are what make it feel CRM-native rather than an embedded Zapier** |

| # | Rule |
|---|---|
| FE-C1 | **MUST** implement `displayOptions.show`/`.hide`. Without conditional fields, a 19-property node like Send Email is an unusable wall of inputs. |
| FE-C2 | **MUST** lazy-load bespoke config panels (`React.lazy`) — SiloCRM has 30 of them; eagerly importing all would bloat the builder bundle. Declare `lazy()` **outside** the component or Suspense re-mounts the fallback on every render. |
| FE-C3 | **Resist bespoke panels.** Every one is a place where the JSON stops being the source of truth. Write one only when the UX genuinely can't be declared (if/else branch builder, delay mode switcher, HTTP request tabs, rich-text email). |
| FE-C4 | Dependent pickers cascade — choosing a pipeline must filter the stage list. Pass `nodeId` so a field can read sibling parameter values. |
| FE-C5 | Debounce parameter writes (~300ms) but mark dirty immediately, so the Save button lights up without a store write per keystroke. |
| FE-C6 | Show a "Test this action" button in the panel footer for action nodes. |
| FE-C7 | Show a short "How it works" blurb per node (SiloCRM's `node-how-it-works.tsx`). Users open the panel not knowing what the node does. |

---

## 11.6 The variable picker

Text inputs must accept `{{variable}}` tokens, and the tokens must not look like code.

| # | Rule |
|---|---|
| FE-V1 | **MUST** render inserted variables as **removable pills**, not raw `{{contact.email}}`. Raw braces read as "this is for developers." |
| FE-V2 | **MUST** scope the picker to what the workflow's **trigger** actually provides. Offering `{{call.recordingUrl}}` in a form-triggered workflow guarantees a blank output and a support ticket. |
| FE-V3 | Picker is searchable, grouped by namespace (Contact / Lead / User / Organization / Trigger / Previous steps / System). |
| FE-V4 | Show each variable's **description and a sample value** in the picker. |
| FE-V5 | Expose previous nodes' outputs as a namespace (`Previous steps → HTTP Request → body`). |
| FE-V6 | Provide both an insert button and typeahead on `{{`. |
| FE-V7 | Flag an unknown variable **inline in the editor** (red pill + tooltip), not only at runtime. |

---

## 11.7 Canvas interactions

| # | Rule | Priority |
|---|---|---|
| FE-X1 | **Relink on delete** — deleting a mid-chain node reconnects its neighbours. Without this, users silently sever their workflow. | MUST |
| FE-X2 | Undo/redo (`Cmd/Ctrl+Z`, `Cmd/Ctrl+Shift+Z`) covering node/edge/parameter changes | MUST |
| FE-X3 | Multi-select (drag box + `Shift`-click), copy/cut/paste, bulk delete, bulk disable | MUST |
| FE-X4 | Deleting a branching node prompts about its branches (`branch-delete-confirm`) | SHOULD |
| FE-X5 | Auto-layout button — essential once an AI copilot generates graphs | SHOULD |
| FE-X6 | Align / distribute / tidy selection | COULD |
| FE-X7 | Snap-to-grid toggle | COULD |
| FE-X8 | Minimap + zoom controls + fit-to-view | SHOULD |
| FE-X9 | Node lock (prevent accidental drags) | COULD |
| FE-X10 | Right-click context menu: rename, duplicate, disable, delete, test | SHOULD |

**Keyboard shortcuts to ship:** `Cmd+S` save · `Cmd+Z`/`Cmd+Shift+Z` undo/redo ·
`Cmd+C`/`X`/`V` clipboard · `Delete` remove selection · `Cmd+A` select all · `Escape` close
panel/deselect · `Cmd+D` duplicate · `Tab` open palette.

---

## 11.8 Validation

Two layers, both required.

**Live (per node):** a ⚠ badge when required fields are empty, from a pure
`getMissingRequiredFields(node)` derived from `properties[].required`.

**On save (whole graph):** block the save and show a dialog listing every problem —

- no trigger node
- orphaned nodes (no incoming edge, not a trigger)
- unreachable nodes
- required fields empty
- a branching node with an unconnected output
- a `goto` pointing at a deleted node
- exceeds `MAX_NODES_PER_WORKFLOW`

| # | Rule |
|---|---|
| FE-VL1 | **MUST** make each error in the dialog **clickable**, focusing and selecting the offending node. A list of errors you can't navigate to is barely better than no list. |
| FE-VL2 | Warnings (unreachable node) are non-blocking; errors (no trigger) block. |
| FE-VL3 | Validation is a pure function of the graph, shared with the backend if possible — the API should reject an invalid graph too. |

---

## 11.9 Execution feedback

| Moment | UI |
|---|---|
| Test run in progress | The executing node pulses; traversed edges animate; a live log panel streams node results |
| Test run finished | ✓/✕ badges persist on nodes; clicking one opens its input/output |
| Viewing a past execution | The graph re-renders in "replay mode": each node shows its real status; a timeline scrubs through node order |
| Inspecting a node in a past run | A context inspector showing the exact input context and output at that node |
| Re-running from a node | "Run from here" in the replay view, forking a new execution seeded with the stored context |

| # | Rule |
|---|---|
| FE-E1 | **MUST** ship the replay viewer with v1. Without it every failure becomes a support ticket. |
| FE-E2 | **MUST** render failure reasons in plain language, not stack traces or error codes. "This contact replied STOP, so we can't text them" — not `SMS_SEND_FAILED`. |
| FE-E3 | Reuse the *same* canvas component for editing and replay, in a read-only mode. Two canvases will diverge. |

---

## 11.10 Performance

Learned the hard way in SiloCRM's Vercel builds.

| # | Rule |
|---|---|
| FE-P1 | **NEVER wildcard-import from an icon library.** `import * as Icons from "lucide-react"` OOMs the Next.js build during "Collecting page data". Node definitions reference icons by *name string*, so you need a resolver — make it a curated explicit map (SiloCRM's `workflow-icon-map.ts`), not a namespace import. |
| FE-P2 | **NEVER glob-import the node registry.** Keep explicit `import x from "./registry/y.json"` lines — same OOM cause. |
| FE-P3 | `memo` every node component with a custom comparator (FE-N6). |
| FE-P4 | Lazy-load bespoke config panels. |
| FE-P5 | Load the builder's reference data (pipelines, stages, tags, users, custom fields) **in parallel**, client-side, not through sequential server actions. Next.js serializes concurrent server-action calls per client, turning five parallel queries into a five-deep waterfall. |
| FE-P6 | Use skeletons, never spinners, for the builder's initial load. |
| FE-P7 | Virtualize the palette if you exceed ~150 node types. |

---

## 11.11 Empty states and onboarding

The blank-canvas problem is the biggest adoption risk in the entire feature.

| # | Rule |
|---|---|
| FE-O1 | **Never open a blank canvas.** Show a template gallery, or a single "Choose a trigger" card. |
| FE-O2 | Ship 8–12 templates for your vertical at launch (speed-to-lead text, no-reply follow-up, appointment reminder, review request, stale-lead reactivation, missed-call text-back). |
| FE-O3 | Grey out "coming soon" nodes in the palette rather than hiding them — it signals a roadmap and prevents "does this tool even do X?" |
| FE-O4 | Every node in the palette shows its one-line description on hover. |
| FE-O5 | An inactive workflow must say so unmissably. Users build a workflow, never activate it, and report it as broken. |

---

## 11.12 Accessibility & responsive

Be honest about what's achievable: a node-graph editor is inherently mouse-and-large-screen.

| # | Rule |
|---|---|
| FE-A1 | Config panel forms are fully keyboard-navigable with proper labels — that's where the real work happens |
| FE-A2 | Canvas: at minimum, keyboard node selection and delete |
| FE-A3 | **Never encode meaning in colour alone** — the ⚠/✓/✕ badges carry shape as well as colour |
| FE-A4 | Respect `prefers-reduced-motion` for the executing-node pulse |
| FE-A5 | Mobile: ship **view + activate/deactivate + execution history**. Do not ship mobile graph editing; it's a bad experience users will blame on the product |
| FE-A6 | Support light and dark themes — the canvas background, edges, and node chrome all need both |

---

## 11.13 Definition of done for the builder

- [ ] A new node type requires **zero** frontend code — drop the JSON in and it renders
- [ ] `displayOptions` conditional fields work
- [ ] `+` on unconnected outputs **and** on edges
- [ ] Deleting a mid-chain node relinks its neighbours
- [ ] Undo/redo covers node, edge, and parameter changes
- [ ] Variables render as pills and the picker is trigger-scoped
- [ ] Missing-required-field badges appear live
- [ ] Save is blocked on invalid graphs, with clickable errors
- [ ] A single node can be tested from its config panel
- [ ] A past execution can be replayed on the canvas with per-node context
- [ ] No wildcard icon imports; builder bundle measured and budgeted
- [ ] Templates gallery replaces the blank canvas
- [ ] 60fps pan/zoom at 50 nodes
