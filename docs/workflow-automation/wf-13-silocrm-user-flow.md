# WF-13 — SiloCRM's builder, traced as a user flow

> Related: [[wf-08-builder-frontend]] | [[wf-PROGRESS]] | [[workflow-automation-port/07-frontend-builder|Port §07]] | [[workflow-automation-port/11-frontend-guidelines|Port §11]] | [[wf-00-decisions]]

[[workflow-automation-port/07-frontend-builder|Port §07]] inventories SiloCRM's
builder — components, store, config panel. This file answers a different
question: **what does a person actually do, click by click, to get from an empty
list to a running automation.** Read from the live source at
`C:\Users\Shihab\Documents\GitHub\SiloCRM` on 2026-08-08.

The distinction matters because the inventory and the journey disagree about
what is important. The 2,076-line store is the biggest thing in the inventory
and barely appears below; the thing that most shapes the experience is a
decision that takes four lines — *no name dialog*.

---

## 13.1 The journey

```
/automation                     list · tabs: Workflows | Enrollment Log · folders
   │
   │ Create
   ▼
/automation/create              ← blank builder, IMMEDIATELY. no dialog, no server row
   │
   │  canvas is empty → one centred card: "Add a Trigger · Click to start"
   ▼
   openSidebarForTrigger()      ← persistent LEFT sidebar, filtered to triggers
   │
   │  pick a trigger → node lands
   ▼
   canvas now has a trigger     → "Add Trigger" button appears pinned top-left
   │                              (multiple triggers are legal)
   │
   ├── click node          → config panel opens on the RIGHT
   ├── `+` on a handle     → openSidebarForAction(nodeId, handleId)
   ├── `+` on an edge      → openSidebarForEdgeInsert(edgeId)
   └── drag wire to empty  → "Release to add node" → sidebar opens,
                              drop position remembered
   │
   ▼
   name it INLINE in the toolbar   ← Save refuses while the name is still a default
   │
   ▼
   Save                        ← persists. There is NO publish step.
   │
   ▼
   status pill → Active        ← click to toggle; also validates + saves
```

Then: **Test** (popover, trial run), **Enrollment Log** (list tab), and replay at
`/automation/[id]/replay/[executionId]`.

---

## 13.2 The seven moves worth stealing

| # | What SiloCRM does | Why it is right |
|---|---|---|
| **F-1** | **No name dialog.** Create goes straight into the builder on `Untitled Workflow`; the name is edited inline in the toolbar | Naming a thing you have not built yet is the least answerable question you can be asked first. Ours asks it before the user has seen a single step |
| **F-2** | **Save refuses a default name.** `isValidWorkflowName()` rejects "Untitled Workflow" and friends, and the *activate* path runs the same check | The clever half of F-1. Deferring the question is only safe if something later insists on it — otherwise every workspace fills with "Untitled Workflow" |
| **F-3** | **Persistent, collapsible left sidebar** for the palette, with search + categories — not a modal | You pick a step, see it land, pick the next. A sheet that closes on every choice makes building a five-step automation five open/close cycles |
| **F-4** | **"Add Trigger" pinned top-left, but only once a trigger exists** | Two states, two affordances: the empty canvas gets one centred card and nothing else to misread; a populated canvas gets a quiet corner button. Ours has no way to add a second trigger at all |
| **F-5** | **Drag a wire into empty space → palette opens at the drop point**, with a "Release to add node" cursor hint while dragging | The one gesture a graph editor's users try unprompted. Dropping a connection into nothing is otherwise silent failure |
| **F-6** | **Branch selector modal** when connecting *from* a multi-output node, rather than guessing the handle | Our [[wf-08-builder-frontend\|H-5]] specifies this and we did not build it |
| **F-7** | **Branch-keep prompt** when deleting a node with several outgoing branches | Our [[wf-08-builder-frontend\|X-4]]. Relink handles one-in-one-out; this covers the case relink deliberately refuses to guess |

Two smaller ones: the config panel takes an **unsaved-changes snapshot** so
switching nodes mid-edit can warn, and the list page carries an **Enrollment
Log** tab beside the workflows table — "what has this actually done" one click
from "what have I built".

---

## 13.3 Independently arrived at the same answer

Worth recording, because it raises confidence in choices made here without
seeing their code:

- **`deleteKeyCode={null}`** — set for exactly our reason, with a comment saying
  so: React Flow's own delete skips the relink logic and the branch prompt.
- **Three sidebar entry points** — `openSidebarForTrigger` /
  `openSidebarForAction(nodeId, handleId)` / `openSidebarForEdgeInsert(edgeId)`,
  matching [[wf-08-builder-frontend|L-1]] exactly.
- **Insert-on-edge** as a first-class action.
- **Mobile at 768px** with a separate header, matching [[wf-08-builder-frontend|§8.12]].

---

## 13.4 What NOT to take

| Their design | Why we deliberately differ |
|---|---|
| **No publish. Save is live.** `status: draft \| active`, no versions | [[wf-00-decisions\|D-06]]. Editing a running automation would change it under an in-flight run. Our `workflow_versions` snapshot plus a pinned `version_id` is the whole reason a three-day delay resumes against the graph it started on |
| **Client-minted id** (`workflow-${Date.now()}`), no server row until Save | Our whole-graph PUT is built on `updatedAt` as a concurrency token, which requires a server row to exist. F-1 is adoptable *without* this — create the row server-side, just do not ask for a name first |
| **The stage-automation wizard** | Dead. Marked deprecated in-source, API returns 410. Do not resurrect the six-step wizard pattern from it |
| **A 2,076-line store** | Ours is ~350 and should stay splittable |
| **SiloPilot** (AI advisor FAB + drawer) | Out of scope for P5; revisit at P10 if at all |

---

## 13.5 Gap list against what we have built

`[x]` already matches · `[~]` differs deliberately · `[ ]` gap to close

- [ ] **F-1** Name dialog → inline naming. We ask for a name in a dialog first
- [ ] **F-2** No validation that a name was ever supplied
- [ ] **F-3** Palette is a `Sheet` that closes on every pick, not a persistent panel
- [ ] **F-4** No "add another trigger" affordance once one exists
- [ ] **F-5** No drag-to-empty-space
- [ ] **F-6** No branch selector modal
- [ ] **F-7** No branch-delete prompt
- [ ] **Config panel does not exist** — the blocker. Every action node shows ⚠ and
      publish refuses, because there is no way to fill a required field
- [ ] Enrollment/run log tab on the list page (our P8)
- [x] Empty canvas gets one centred "choose what starts this" card
- [x] Insert-on-edge, `+` on unconnected outputs, relink-on-delete
- [x] `deleteKeyCode={null}`, undo/redo, 768px mobile split
- [~] Publish + versioning — ours, deliberately, and it stays
- [~] Server row created before the builder opens — ours, and it stays

---

## 13.6 Build log

**Done 2026-08-08 (written, unrun):** F-1, F-2, F-3, F-4.

- **F-1** The name dialog is gone from the create path. `New automation` creates
  the row on `DEFAULT_WORKFLOW_NAME` and goes straight to the builder; the name
  is an inline input in the toolbar. The dialog survives as **rename-only** on
  the list. The server row is still created first — unlike SiloCRM — because the
  whole-graph save's concurrency token is `updatedAt` and needs a row.
- **F-2** New `packages/workflow-nodes/src/naming.ts`. Enforced at **publish**,
  not Save: a draft may be called anything, and a Save that refuses work is a
  Save that loses it. The toolbar shows an amber marker for the same condition,
  so the refusal is never a surprise; the server is what actually enforces it.
- **F-3** `node-palette-sheet.tsx` → `node-palette-panel.tsx`. A column that
  pushes the canvas rather than covering it, and **it stays open after a pick** —
  the specific failure of the sheet was that a five-step build was five
  open/close cycles. Palette state moved from canvas-local `useState` into the
  store, so three different components open the same one.
- **F-4** "Add trigger" appears top-left **only once a trigger exists**. Before
  that the empty-state card is the single affordance. Previously there was no
  way to add a second trigger at all, though the model and validator allow three.

Also folded in: create no longer toasts (navigating into the builder is the
confirmation), and the create button has a pending state now that it is doing a
round trip with no dialog to hide behind.

**Still open:** F-6, F-7, F-5, and the config panel.

### 13.6.1 Canvas rebuilt against the reference — and two bugs it exposed

The first canvas was reviewed against a screenshot of it running and was wrong
in ways reading the code could not show. Corrected against
`SiloCRM/apps/web/src/components/automation/workflow-nodes/`, which is a working
n8n-shaped implementation and a far better reference than the docs (n8n's own
documentation covers architecture, not pixels).

**Two real bugs, not taste:**

- 🐛 **Every node printed its name twice.** A new step is created with
  `label = displayName`, and the node rendered both lines — "Send Email" over
  "Send Email". The second line now only renders once the user has renamed the
  step, which is the only time it carries information.
- 🐛 **Picking from the palette a second time produced disconnected nodes.**
  Making the panel stay open (F-3) cleared `pendingSource` after each pick, so
  every choice after the first dropped a free-floating step. Three steps, no
  connections, no error. `addFromPalette` now chains from the added node's first
  output — and deliberately does *not* chain off a branching node, because
  guessing which branch was meant is worse than making the user click one.

**Layout — the big one: the flow is now left → right**, inputs on the left edge,
outputs on the right. A step is a wide card with a name in it, so running the
chain horizontally puts its long axis along the flow and leaves the vertical
free for branches; stacked downward, any branch is immediately wider than the
screen because each one has to clear a full card width.

**Shape carries the role.** A trigger is a **92px square with a rounded left
edge**; an action is a **wide card**. It reads at any zoom, in greyscale, from
across the room — and the rounded-left silhouette does real work, because a
trigger has no input and a shape with nothing to connect to says so before you
go looking for a handle. The trigger's name sits *below* its square, so every
trigger is the same size whatever it is called.

**The tinted icon tile came back.** It was removed in the previous pass as "the
n8n default"; it is the n8n default because it works — at a glance the tile's
colour and glyph identify a step far faster than a 3px edge stripe. The spine
idea is gone from the node entirely.

Also fixed: the ⚠ became a **solid amber circle on the corner** rather than an
inline glyph (findable while scanning, not while reading); the minimap rendered
as a light panel in a dark UI because `bgColor`/`maskColor` are SVG attributes a
wrapper class never reaches; and the dot grid was keyed to `--border`, which in
dark mode is indistinguishable from the canvas ground, so the canvas read as a
flat void.

## 13.7 Recommended build order

1. **Config panel + the P5 field types.** Nothing else matters while a step
   cannot be configured; it is the difference between a drawing tool and an
   automation builder.
2. **F-3 sidebar** (Sheet → persistent collapsible panel). Touches the same
   files as (1) and changes the feel of every subsequent step.
3. **F-1 + F-2** inline naming with a save-time gate. Small, and deletes a
   component.
4. **F-4, F-6, F-7** — the three canvas affordances, all small and independent.
5. **F-5** drag-to-empty-space. The fiddliest; last.
