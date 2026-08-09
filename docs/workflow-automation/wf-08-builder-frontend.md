# WF-08 — Builder Frontend

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-04-node-catalog]] | [[wf-07-variables]] | [[wf-09-api-surface]] | [[design]] | [[strict-rules]] | [[frontend-nextjs]]

Implementation rules for the builder UI. [[11-frontend-guidelines|The source guide's chapter 11]] is
the best chapter in that document and most of it is adopted verbatim; this file is that, resolved
against Zaxvio's actual stack, component conventions and [[decisions|ADR-002]].

Where this says **MUST**, it is a rule that caused a real bug in the source system when broken.

---

## 8.1 Stack

| Concern | Choice | Status |
|---|---|---|
| Canvas | `@xyflow/react` v12 | ➕ new dependency |
| Builder state | `zustand` | ➕ new dependency |
| Components | shadcn/ui + Radix + Tailwind | ✅ already the repo's |
| Icons | `@tabler/icons-react` via a **curated name → component map** | ✅ already the repo's |
| Forms | **generated from `properties[]`** | — not react-hook-form per node |
| Data | `api-fetch` → server action → TanStack Query ([[decisions\|ADR-002]]) | ✅ |
| Toasts | `sonner` | ✅ |
| Rich text | **none** — see [[wf-01-gap-analysis\|§7]] | — |

Two dependencies. That is the whole delta.

**Component placement** ([[strict-rules|§3]]): everything lives in
`components/dashboard/automations/`. **Never** inside `app/(dashboard)/automations/` — route folders
hold `page.tsx` and `*-page-client.tsx` only.

---

## 8.2 Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR  ‹ Back · Name (inline edit) · [Draft ● unpublished] ·             │
│          Save · Publish · Active ⏻ · Test · Undo/Redo · ⋯                  │
├───────────┬──────────────────────────────────────────────┬─────────────────┤
│           │                                              │                 │
│  PALETTE  │                  CANVAS                      │  CONFIG DRAWER  │
│  (sheet)  │                                              │  (right, over   │
│           │    ┌────────────┐        ┌────────────┐      │   the canvas)   │
│  search   │    │ ⚡ Job      │───────▶│ ✉ Send      │╌╌ + │                 │
│  ───────  │    │  Completed │        │   Email    │      │  node header    │
│ ▾ Triggers│    └────────────┘        └────────────┘      │  how it works   │
│   Job     │                                              │  ─────────      │
│   Quote   │                          [minimap]  [±  ⤢]   │  generated form │
│ ▾ Actions │                                              │  ─────────      │
│ ▾ Logic   │                                              │  Test this step │
└───────────┴──────────────────────────────────────────────┴─────────────────┘
```

| # | Rule |
|---|---|
| L-1 | **The palette opens contextually, not permanently.** Clicking `+` after an email node shows *actions*, never triggers. One sheet, three entry points: `openForTrigger()`, `openForAction(nodeId, handleId)`, `openForEdgeInsert(edgeId)` |
| L-2 | **The config panel is a drawer over the canvas, not a modal.** Users need to see the graph while editing a node |
| L-3 | **Nothing mutates React Flow state directly.** Every change goes through the Zustand store — that is what makes undo/redo, keyboard shortcuts and template install all work on one code path |
| L-4 | Uses `Sheet` and `Drawer` from `components/ui/` — no hand-rolled overlays ([[strict-rules\|§5]]) |

---

## 8.3 The node component

```
   ┌───────────────────────────────┐
   │ ┌───┐  Text the customer      │◉╌╌╌ (+)
   │ │ ✉ │  Send Email             │
   │ └───┘                    ⚠    │
   └───────────────────────────────┘
       ▲        ▲            ▲
   icon tile   user label   badge
   category    node type    (missing fields / ✓ ran / ✕ failed)
   colour @12%
```

| # | Rule |
|---|---|
| N-1 | **Fixed width band, 240–320px.** Variable-width nodes make graphs look chaotic and break auto-layout |
| N-2 | **Two lines: the user's label on top, the node type beneath.** Users rename nodes ("Text the customer") and without the second line lose track of what the node *is* |
| N-3 | **Colour: subcategory → category → node.** Per-node is a rainbow; per-category cannot distinguish an email from an internal notification |
| N-4 | **⚠ badge when required fields are empty**, tooltip lists them. The cheapest possible "why won't this work" affordance |
| N-5 | **✓ / ✕ badges after a test run**, clickable to open that node's input/output |
| N-6 | **`memo` with a custom comparator** on `id`, `selected`, `label`, `nodeType`, `JSON.stringify(parameters)`. Without it every store update re-renders every node and the canvas stutters past ~30 nodes |
| N-7 | **A disabled node must look disabled** — reduced opacity plus a "Disabled" chip. It is the primary debugging tool |
| N-8 | ➕ **A node with >1 incoming edge shows a join badge** — *"Runs when any branch reaches it"* / *"Waits for all 3 branches"*. Fixes [[10-audit-findings\|B-15]] |
| N-9 | ➕ **Meaning is never carried by colour alone** — every badge has a shape ([[11-frontend-guidelines\|FE-A3]]) |

Light and dark themes both, using the repo's existing token ramp (`--card`, `--surface`,
`--surface-alt`) — the landing-page work already fixed a dark-mode elevation inversion in those
tokens and the canvas must sit inside that system, not beside it.

---

## 8.4 Handles and the `+` affordance

The single highest-ROI piece of the whole builder ([[10-audit-findings|A-11]]).

```
   ┌────────────────┐
   │  Find Job      │◉╌╌╌╌ [Found]      ╌╌╌ (+)
   │                │◉╌╌╌╌ [Not found]  ╌╌╌ (+)
   └────────────────┘
```

| # | Rule |
|---|---|
| H-1 | **MUST** render a `+` on every **unconnected** output. Users build linearly by clicking, not by dragging |
| H-2 | **MUST** render a `+` at the midpoint of every edge, to insert a node between two existing ones |
| H-3 | **MUST** label multi-output handles. An unlabelled two-output node is unusable |
| H-4 | **Handle ids are stable strings, never the display label** ([[wf-00-decisions\|D-07]]) |
| H-5 | Dragging a connection *from* a multi-output node opens a branch selector rather than guessing |
| H-6 | Multi-output handles distribute vertically: `top = (i + 1) / (n + 1) × 100%` |

---

## 8.5 The config panel — generated forms

**The whole architecture rests on this: a node's form is rendered from its definition, not
hand-written.**

```
select a node
  → getDefinition(node_type)
  → is there a bespoke panel for this type?
       yes → React.lazy() it
       no  → for each definition.properties[]:
                evaluate displayOptions.show / .hide against sibling values
                switch (property.type) → the matching field renderer
  → onChange → store.updateNode(id, { parameters }) → dirty flag
```

### The field contract

```tsx
interface FieldProps<T = unknown> {
  property: NodeProperty;
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Siblings, so a stageSelect can read the pipelineId next to it. */
  siblings: Record<string, unknown>;
  nodeId: string;
}
```

All wrapped in one `<FieldWrapper>` rendering label, required marker, description, hint and error —
so a new field type is ~30 lines, not 80.

| # | Rule |
|---|---|
| C-1 | **MUST** implement `displayOptions.show` / `.hide`. Without conditional fields, an 8-property email node is an unusable wall of inputs |
| C-2 | **MUST** lazy-load bespoke panels, and declare `lazy()` **outside** the component or Suspense remounts the fallback every render |
| C-3 | **Resist bespoke panels.** Every one is a place where the definition stops being the source of truth. v1 has exactly **four**: `condition.if` (the branch/condition-group builder), `delay.wait` (mode switcher), `logic.switch` (route table), `email.send` (body + preview) |
| C-4 | Dependent pickers cascade — choosing a pipeline filters the stage list, and each stage shows its lifecycle chip |
| C-5 | Debounce parameter writes ~300ms, but mark dirty **immediately**, so Save lights up without a store write per keystroke |
| C-6 | A **"Test this step"** button in the panel footer for every action node ([[10-audit-findings\|A-10]]) |
| C-7 | A short **"How it works"** blurb per node, from `definition.howItWorks`. Users open the panel not knowing what the node does |
| C-8 | ➕ Fields with `ownership` render only rows this tenant owns, from the batch context endpoint |

---

## 8.6 Save, Publish, and the draft state

This is the piece of UX that [[wf-00-decisions|D-06]] obliges, and it has to be unmissable.

```
┌──────────────────────────────────────────────────────────────────┐
│  Quote follow-up          ● 3 unpublished changes                │
│                           ┌──────┐  ┌─────────────┐              │
│                           │ Save │  │  Publish ▸  │   Active ⏻   │
│                           └──────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

| State | Meaning | UI |
|---|---|---|
| Clean, published, active | running | green dot, "Live · v3" |
| Clean, published, inactive | drawn, published, switched off | amber banner: **"This automation is off. It will not run."** |
| Dirty | draft differs from the active version | "● N unpublished changes", Publish is primary |
| Never published | no version exists | Active toggle is **disabled** with a tooltip: "Publish first" |

| # | Rule |
|---|---|
| S-1 | **Save** persists the draft graph. It never changes what runs |
| S-2 | **Publish** snapshots the draft, bumps the version, points `active_version_id` at it. Runs in flight keep their pinned version |
| S-3 | **Publish is blocked on validation errors**, with a dialog listing every problem |
| S-4 | **MUST** make each error in the dialog **clickable**, focusing and selecting the offending node. A list of errors you cannot navigate to is barely better than no list |
| S-5 | An inactive automation says so unmissably ([[11-frontend-guidelines\|FE-O5]]) — users build one, never activate it, and report it as broken |
| S-6 | Save sends `expectedUpdatedAt`; a **409** shows "Someone else edited this automation" with a Reload action, never a silent clobber ([[10-audit-findings\|B-10]]) |
| S-7 | Version history is readable, with "Restore this version" |

---

## 8.7 Validation

Two layers, both required, **one implementation** shared with the API
([[11-frontend-guidelines|FE-VL3]] — the server must reject an invalid graph too). The validator
lives in `services/workflow/graph/validate.ts` and is imported by the browser through
`packages/workflow-nodes`… which means it must be pure and dependency-free. It is.

**Live, per node:** a ⚠ badge from a pure `getMissingRequiredFields(node, definition)`.

**On publish, whole graph:**

| Blocks publish | Warning only |
|---|---|
| no trigger node | an unreachable node |
| a required field is empty | a `logic.goto` downstream of a `split.branch` ([[wf-05-execution-engine\|§5.3]]) |
| an orphaned node (no incoming edge, not a trigger) | an automation with no action node |
| a branching node with an unconnected output | more than 3 triggers |
| a `goto` pointing at a deleted node | |
| more than `MAX_NODES_PER_WORKFLOW` (60) | |
| **a `delay.wait` inside a loop body** ([[wf-00-decisions\|D-21]]) | |
| **an action whose `requiresSubject` no trigger provides** | |
| **a node config referencing a row this tenant does not own** | |

The last two are Zaxvio-specific and both are real: "Move Job Stage" in an automation triggered by
`customer.created` can never run, and the user should be told at publish time rather than discovering
it in a failed run.

---

## 8.8 Canvas interactions

| # | Rule | Priority |
|---|---|---|
| X-1 | **Relink on delete** — deleting a mid-chain node reconnects its neighbours. Without it users silently sever their automation | MUST |
| X-2 | Undo/redo (`Cmd/Ctrl+Z`, `+Shift+Z`) covering node, edge **and parameter** changes | MUST |
| X-3 | Multi-select (drag box + Shift-click), copy/cut/paste, bulk delete, bulk disable | MUST |
| X-4 | Deleting a branching node prompts about its branches | SHOULD |
| X-5 | Auto-layout button | SHOULD |
| X-6 | Minimap, zoom controls, fit-to-view | SHOULD |
| X-7 | Right-click menu: rename · duplicate · disable · test · delete | SHOULD |
| X-8 | Align / distribute / snap-to-grid | COULD |

**Keyboard:** `Cmd+S` save · `Cmd+Z` / `Cmd+Shift+Z` · `Cmd+C/X/V` · `Delete` · `Cmd+A` ·
`Escape` close the panel · `Cmd+D` duplicate · `Tab` open the palette.

---

## 8.9 Execution feedback

| Moment | UI |
|---|---|
| Test run in progress | the executing node pulses, traversed edges animate, a live log panel streams results — **over the existing SSE stream**, channel `"workflows"` |
| Test run finished | ✓ / ✕ badges persist; clicking one opens its resolved parameters and output |
| Viewing a past run | the **same canvas component** in read-only replay mode, each node showing its real status |
| Inspecting a node | resolved parameters + output always; the full context for failed nodes and test runs ([[wf-00-decisions\|D-19]]) |
| Re-running from a node | "Run from here", forking a new execution seeded with the stored context |

| # | Rule |
|---|---|
| E-1 | **MUST** ship the replay viewer with v1. Without it every failure is a support ticket |
| E-2 | **MUST** render failure reasons in plain language, never a stack or a code. *"This customer has unsubscribed, so we didn't email them"* — not `EMAIL_SEND_FAILED` |
| E-3 | **Reuse the same canvas component** for editing and replay, in read-only mode. Two canvases will diverge |
| E-4 | Respect `prefers-reduced-motion` for the pulse |

The SSE channel is a one-line change: add `"workflows"` to the `EventChannel` union in
`lib/event-bus.ts` and subscribe with the existing `use-event-stream.ts` hook.

---

## 8.10 Empty states and onboarding

The blank-canvas problem is the biggest adoption risk in the entire feature.

| # | Rule |
|---|---|
| O-1 | **Never open a blank canvas.** A new automation opens on the **template gallery**, with "Start from scratch" as a secondary option |
| O-2 | Ship the 10 templates ([[wf-00-decisions\|D-27]]), installed **inactive** so nothing sends before the tenant reviews it |
| O-3 | Starting from scratch opens a single "Choose what starts this" card, not an empty grid |
| O-4 | "Coming soon" nodes are **greyed in the palette, not hidden** — it signals a roadmap and prevents "does this even do X?" |
| O-5 | Every palette entry shows its one-line description on hover |
| O-6 | The list page's empty state names three concrete automations this business could turn on today |

---

## 8.11 Performance

| # | Rule |
|---|---|
| P-1 | **NEVER wildcard-import an icon library.** `import * as Icons from "@tabler/icons-react"` OOMs the Next build during "Collecting page data". Definitions reference icons by *name string*, so a resolver is required — make it a curated explicit map (`lib/workflow/icon-map.ts`) |
| P-2 | **NEVER glob-import the node registry.** Explicit static imports in the barrel; enforced by registry test N-9 |
| P-3 | `memo` every node component with a custom comparator (N-6) |
| P-4 | Lazy-load the four bespoke config panels |
| P-5 | The builder's reference data arrives in **one** batch request (`GET /workflows/:id/builder-context`), not five sequential server actions ([[wf-01-gap-analysis\|§6]]) |
| P-6 | Skeletons, never spinners, for the initial load — the repo convention |
| P-7 | React Flow is `dynamic(() => …, { ssr: false })`; the canvas has no server render worth having |
| P-8 | Target 60fps pan/zoom at 50 nodes |

P-1 and P-2 are the two failures the source system hit in production, and both only appear in a
hosted build — which is the worst place to find them. This repo has its own history there: three
consecutive `main` builds failed, each hiding the next ([[todo|Production Build Repair]]).

---

## 8.12 Responsive and mobile

A node-graph editor is inherently mouse-and-large-screen. Be honest about it.

| Viewport | What ships |
|---|---|
| ≥ 1280px | the full builder |
| 768–1279px | the full builder, palette and config as sheets rather than panels |
| < 768px | **view only** — the list, the run history, activate/deactivate, and a read-only graph. Editing shows "Open on a larger screen to edit" |

Do not ship mobile graph editing. It is a bad experience users will blame on the product
([[11-frontend-guidelines|FE-A5]]).

Config panel forms are fully keyboard-navigable with proper labels — that is where the real work
happens. The canvas gets keyboard node selection and delete at minimum.

---

## 8.13 Definition of done for the builder

- [ ] A new node type requires **zero** frontend code — add the definition and it renders
- [ ] `displayOptions` conditional fields work
- [ ] `+` on unconnected outputs **and** on edge midpoints
- [ ] Deleting a mid-chain node relinks its neighbours
- [ ] Undo/redo covers node, edge and parameter changes
- [ ] Variables render as pills; the picker is trigger-scoped; unknown variables are flagged inline
- [ ] Missing-required-field badges appear live
- [ ] Publish is blocked on invalid graphs, with clickable errors
- [ ] Draft-vs-published state is unmissable; an inactive automation says so
- [ ] A concurrent edit 409s with a Reload action, never a silent clobber
- [ ] A single node can be tested from its config panel
- [ ] A past run replays on the canvas with per-node detail
- [ ] No wildcard icon imports; no glob registry imports; builder bundle measured
- [ ] The template gallery replaces the blank canvas
- [ ] Light and dark both correct; 390px viewport has no horizontal scroll
- [ ] 60fps pan/zoom at 50 nodes
