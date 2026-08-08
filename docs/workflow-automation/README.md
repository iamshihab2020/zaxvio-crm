# Workflow Automation — Zaxvio CRM

> Related: [[wf-PROGRESS]] | [[wf-12-phases]] | [[wf-00-decisions]] | [[workflow-automation-port/README|SiloCRM port guide]] | [[todo]] | [[architecture]] | [[decisions|ADRs]]

The design and build plan for **Automations** — a visual, multi-step, event-driven automation
builder native to Zaxvio's own data model.

This folder is the *plan for this product*. [[workflow-automation-port/README|`docs/workflow-automation-port/`]]
is the *audit of SiloCRM's implementation* that inspired it. Read this one to build; read that one
for the reference implementation's reasoning and its scars.

---

## What we are building, in one paragraph

An **n8n-style builder** — palette, infinite canvas, named output handles, and a config form
generated from each node's declaration — with **service-business semantics**: a run is *about* one
record (a job, an invoice, a quote, a booking, a customer), waits last days or weeks and survive
deploys, and the nodes speak Zaxvio's own language (pipelines, stages, service types, checklists,
contracts, assets). Sixty-two node types at full v1; twenty-one in the MVP; ten launch templates.

---

## The five ideas the whole thing rests on

1. **One declaration per node.** A TypeScript module declares a node's config form; the builder
   renders it, the engine reads it, the validator checks it. Behaviour lives separately in an
   executor keyed by the node id. Adding a node is "write a definition, write one function" — not
   touching six files.
2. **Events go through a transactional outbox.** A domain write and its event commit together or not
   at all. A worker claims rows with `FOR UPDATE SKIP LOCKED`, retries with backoff, dead-letters.
   **A broken automation engine can never stop someone invoicing a customer.**
3. **Delays are durable.** A 30-day wait is a row with a `resume_at` and a serialised context,
   resumed by a claiming worker. It survives every deploy in between.
4. **Executors never write tables.** Every action calls the domain service the HTTP route calls. This
   repo has already paid twice for the alternative ([[quotes|QUO-02]], and `bulk-status-update`).
5. **Runs pin the version they started on.** Editing a live automation cannot break something that is
   already paused inside it.

---

## Read in this order

| # | File | What it answers |
|---|---|---|
| — | [[wf-PRD]] | Why we are building it, for whom, and what "done" means |
| 00 | [[wf-00-decisions]] | **Every decision, settled, with reasoning.** Start here if you only read one |
| 01 | [[wf-01-gap-analysis]] | The audit: SiloCRM's guide vs this codebase. What ports, what does not, what is missing |
| 02 | [[wf-02-architecture]] | Layers, packages, module map, the two runtime paths |
| 03 | [[wf-03-data-model]] | Eleven tables, every column and index, and the migration discipline |
| 04 | [[wf-04-node-catalog]] | The node contract, and all 62 node types |
| 05 | [[wf-05-execution-engine]] | Traversal, context, interpolation, pauses, goals, limits, invariants |
| 06 | [[wf-06-triggers-and-events]] | The typed event taxonomy, the outbox, the declarative filter matcher |
| 07 | [[wf-07-variables]] | `{{namespace.field}}` — one declaration, generating everything |
| 08 | [[wf-08-builder-frontend]] | React Flow builder rules for this repo's stack |
| 09 | [[wf-09-api-surface]] | All 26 endpoints, schemas, server actions, query hooks |
| 10 | [[wf-10-security]] | Threat model against Zaxvio's *actual* posture — no RLS, no Redis, one instance |
| 11 | [[wf-11-testing]] | The harness that does not exist yet, and what it must prove |
| 12 | [[wf-12-phases]] | **The plan.** Eleven phases, P0 → P10 |
| — | [[wf-PROGRESS]] | **The living tracker.** What is built, what is verified, what is not |

---

## The seven differences from the reference implementation

Not preferences — each closes a defect the source audit documents, or fits a constraint Zaxvio
actually has.

| # | Change | Closes |
|---|---|---|
| 1 | **Typed event payloads, one producer helper each** | [[10-audit-findings\|B-01]] — an untyped payload killed every stage-filtered goal node in production, and the unit test passed the whole time |
| 2 | **Declarative trigger filters, one generic matcher** | [[10-audit-findings\|B-02]] — a 3,146-line hand-coded cascade where a missing branch means a configured filter silently does nothing |
| 3 | **One variable declaration** generating picker, resolver, suggestions and docs | [[10-audit-findings\|B-03]] — two hand-maintained lists of ~700 paths, kept in sync by convention |
| 4 | **Versioning by snapshot, from day one** | [[10-audit-findings\|B-04]] — a run paused for three days resuming into a graph that no longer contains its next node |
| 5 | **Interpolate the whole parameter bag once, before dispatch** | [[10-audit-findings\|B-05]] — a new node forgetting to interpolate one field |
| 6 | **Stable handle ids, `source_handle` as a column** | [[10-audit-findings\|B-06]] — renaming a display label breaking routing on every saved automation |
| 7 | **One outbox row per subscriber** | [[10-audit-findings\|B-07]] — nine coupled side effects where a throw in the seventh retries the first |

Plus three Zaxvio-specific requirements the source guide has no reason to mention:
**customer opt-out** (this product has none), **explicit tenant threading** (there is no RLS to fall
back on), and **a test harness** (`pnpm test` currently runs a tool that is not installed).

---

## Status

**P0 — Foundations & test harness.** See [[wf-PROGRESS]] for the current state, and for what has
actually been verified versus merely written.

| Gate | After | Means |
|---|---|---|
| Internal alpha | P6 | Branching, delays, and a resume proven across a real deploy |
| Private beta | P8 | Replay shipped; every failure reviewed by a human for two weeks |
| Public beta | P9 | Quotas enforced, webhook surface reviewed |
| GA | P10 | Templates, docs, security review |

---

## Diagram index

| Diagram | Type | Where |
|---|---|---|
| System map | graph | [[wf-02-architecture\|02]] §2.1 |
| Event-triggered run, end to end | sequence | [[wf-02-architecture\|02]] §2.4 |
| The no-second-writer boundary | ASCII | [[wf-02-architecture\|02]] §2.5 |
| Entity relationships | ER | [[wf-03-data-model\|03]] §3.0 |
| Execution lifecycle | state | [[wf-05-execution-engine\|05]] §5.1 |
| BFS traversal | flowchart | [[wf-05-execution-engine\|05]] §5.3 |
| Node execution | flowchart | [[wf-05-execution-engine\|05]] §5.4 |
| Durable delay pause/resume | sequence | [[wf-05-execution-engine\|05]] §5.5 |
| Event taxonomy | mindmap | [[wf-06-triggers-and-events\|06]] §6.1 |
| Outbox + worker | flowchart | [[wf-06-triggers-and-events\|06]] §6.3 |
| Trigger matching | flowchart | [[wf-06-triggers-and-events\|06]] §6.4 |
| Variable derivation | graph | [[wf-07-variables\|07]] §7.1 |
| Interpolation cascade | flowchart | [[wf-07-variables\|07]] §7.3 |
| Builder layout, node anatomy, handles | ASCII | [[wf-08-builder-frontend\|08]] §8.2–8.4 |
| Threat model → mitigations | graph | [[wf-10-security\|10]] |
| Build order | gantt | [[wf-12-phases\|12]] |
| Phase dependencies | graph | [[wf-12-phases\|12]] |

---

## House rules that apply here, unchanged

- [[strict-rules]] — components never inside route folders; no `as any`; shadcn first; housekeeping
  in the same commit; lessons after every correction
- [[api-rules]] — thin handlers, service layer, Zod on every route, query files for complex SQL
- [[security-rules]] — `tenantId` in **every** query; Zod on every input; rate limits on public
  endpoints; no unsafe assertions on request data
- [[decisions|ADR-002]] — `api-fetch` → server action → TanStack Query, one pattern
- [[workflow]] — plan first, verify before done, capture lessons
