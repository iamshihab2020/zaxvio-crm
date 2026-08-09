# WF-PRD — Workflow Automation (Zaxvio)

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-00-decisions]] | [[wf-12-phases]] | [[wf-04-node-catalog]] | [[PRD|SiloCRM port PRD]] | [[todo]]

**Status:** approved plan · **Date:** 2026-08-07 · **Owner:** Zaxvio CRM

Derived from the [[PRD|SiloCRM port PRD]], with every `[DECIDE]` resolved in
[[wf-00-decisions]] and every assumption cross-checked against this codebase in
[[wf-01-gap-analysis]]. Nothing in this file is a placeholder.

---

## 1. Problem

A solo HVAC contractor does the same sequences by hand, every day:

> A booking comes in → confirm it → put it on the calendar → text the customer the night before →
> complete the job → send the invoice → chase it at 7 days → ask for a Google review.

Done by hand it is done late, inconsistently, or not at all — usually while standing on a roof.
Zaxvio already stores every one of those records. It does nothing with the *sequence*.

The alternatives all fail for this customer:

| Option | Why it fails |
|---|---|
| Hardcoded rules (`quoteAutoConvertToJob`, `reviewRequestEnabled`) | Zaxvio already has three of these. Each one is a boolean that took a migration, an API change and a settings toggle to ship, and none of them compose |
| Zapier / Make | Lives outside the CRM. No awareness of pipelines, stages, contracts or assets. Per-task pricing. Another vendor for a one-person business to learn and pay for |
| More email crons | E-07, E-09, E-10, E-12 already exist. Each is engineering work, none is configurable, and a contractor cannot change "7 days" to "3 days" |
| ServiceTitan / Jobber / Housecall Pro | They all have this. Not having it loses deals |

**Build a visual, multi-step, event-driven automation builder native to Zaxvio's own data model.**

### Product shape

An **n8n-style builder** — palette, infinite canvas, named output handles, a config form generated
from each node's declaration — with **GoHighLevel semantics**: a run is *about* one record, waits
last days or weeks, and the nodes speak the product's own language (pipelines, stages, service types,
contracts, assets).

Three deliberate departures from n8n, each load-bearing:

1. **Subject-centric, not item-centric.** A run is about one job, invoice, quote, booking or
   customer. That is what makes "is this job already in this automation" and "stop when they book"
   expressible.
2. **Durable pauses.** A 30-day wait is a database row with a `resume_at`, resumed by a worker — not
   a timer in memory.
3. **CRM-native field types.** Thirteen pickers bound to the tenant's own pipelines, stages, catalog,
   checklists, tags and team. This is the entire difference between a native builder and an embedded
   Zapier.

---

## 2. Goals & non-goals

### Goals

| # | Goal | Measure |
|---|---|---|
| G1 | A non-technical contractor builds a working automation without help | ≥ 60% of active tenants have ≥ 1 active automation within 90 days of GA |
| G2 | Automations are reliable | ≥ 99.5% of triggered runs complete or intentionally pause. **Zero silent drops** |
| G3 | Users self-diagnose failures | ≥ 70% of failed runs are opened in the replay view; "why didn't it run?" is answerable in the UI |
| G4 | A new node type is cheap | ≤ 1 engineer-day: one definition module + one executor function + zero frontend code |
| G5 | Long waits are safe | A 30-day delay survives every deploy in between, and resumes on the graph it started with |
| G6 | Tenant isolation is absolute | Zero cross-tenant reads or writes. There is no RLS underneath — the application is the boundary |
| G7 | Nobody gets emailed who asked not to be | Every automation send passes one opt-out gate; quiet hours respected |

### Non-goals (v1)

- A general-purpose iPaaS competing on connector count
- A marketplace of community nodes
- Real-time multiplayer editing
- Sub-second latency (polling means seconds)
- Runs longer than the 5-minute wall clock — long work is a delay
- SMS / voice, a code sandbox, an agency scope, an AI copilot — all deferred with reasons in
  [[wf-00-decisions]]

---

## 3. Users

| Persona | Needs | Implication |
|---|---|---|
| **Owner-operator** (primary) — one to three people, non-technical, does the office work between jobs | Templates, plain-language config, "did it actually work?" | The generated form must be genuinely usable; failure messages in human words; **never a blank canvas** |
| **Technician** (indirect) — never opens the builder | Automations that do not embarrass them: no duplicate emails, nothing at 3am, nothing to a customer who unsubscribed | Idempotency, opt-out gate, quiet hours, business-hours-aware delays |
| **Power user** — the contractor who runs a 10-person shop and reads documentation | Webhooks, branching, multi-step sequences | Escape hatches: raw webhook, `data.setFields`, variables everywhere, sub-automations |
| **Support / the developer** | "Why did this customer get the wrong email?" | Node logs, context inspector, run-from-node replay, trigger evaluation records |

---

## 4. Vocabulary

| Term | Definition |
|---|---|
| **Automation** | A named, versioned, directed graph owned by one tenant. `workflows` in the schema |
| **Node** | One step. An immutable `node_type`, a config, a canvas position |
| **Edge** | A directed connection carrying a `source_handle` for multi-output routing |
| **Trigger** | An entry node. Declares which events start the automation, and filters them |
| **Action** | A node with a side effect, which it performs by calling a domain service |
| **Run** (execution) | One traversal of one version, for one subject |
| **Subject** | What the run is *about* — a customer, job, invoice, quote, booking, asset or contract |
| **Context** | Everything the run can read: subject, its customer, the tenant, the event payload, earlier node outputs |
| **Variable** | `{{namespace.field}}`, resolved from context at run time |
| **Goal** | An event that, when it fires, ends the run early |
| **Version** | A published, immutable snapshot of the graph. Runs are pinned to one |

---

## 5. Functional requirements

Priorities: **MUST** ships in v1 · **SHOULD** ships if the phase allows · **COULD** is roadmap.
Phase references are to [[wf-12-phases]].

### 5.1 Node contract — P0

| ID | Requirement | | |
|---|---|---|---|
| N1 | Every node type is one declaration, consumed by the builder, the engine and the validator | MUST | P0 |
| N2 | Node ids are **immutable**; a CI test asserts the id set only grows | MUST | P0 |
| N3 | Definitions contain no behaviour; behaviour is an executor keyed by node id | MUST | P0 |
| N4 | Output handles have a stable id and a **separate** display label | MUST | P0 |
| N5 | `displayOptions.show`/`.hide` conditionally render a property from sibling values | MUST | P5 |
| N6 | An `active` whitelist gates the palette; `coming-soon` nodes render greyed, not hidden | MUST | P0 |
| N7 | `properties[].filter` declares trigger filtering; **one** generic matcher evaluates all of it | MUST | P4 |
| N8 | `properties[].encoding` declares output encoding | MUST | P3 |
| N9 | `properties[].ownership` declares a foreign id needing a tenant check | MUST | P3 |
| N10 | `mutates` declares what to re-read and what cache to invalidate | MUST | P3 |
| N11 | `sideEffect` declares re-run safety | MUST | P3 |
| N12 | Node ids follow a lint-enforced convention | SHOULD | P0 |

### 5.2 Builder — P5

| ID | Requirement | | |
|---|---|---|---|
| B1 | Drag from a searchable, category-grouped palette onto a canvas | MUST | P5 |
| B2 | Connect nodes handle to handle | MUST | P5 |
| B3 | The config form is **generated from the declaration** — no per-node UI for a simple node | MUST | P5 |
| B4 | `{{variable}}` insertion in any text field, from a searchable **trigger-scoped** picker | MUST | P7 |
| B5 | Variables render as removable pills; unknown ones flag inline | SHOULD | P7 |
| B6 | Insert a node **on an existing edge** via a `+` on the connector | MUST | P5 |
| B7 | **Relink on delete** — removing a mid-chain node reconnects its neighbours | MUST | P5 |
| B8 | Validation before publish, blocking, with **clickable** errors | MUST | P5 |
| B9 | Undo/redo, copy/cut/paste, multi-select | MUST | P5 |
| B10 | Disable a node without deleting it | MUST | P5 |
| B11 | **Draft vs published is unmissable**; publish is an explicit act | MUST | P5 |
| B12 | A concurrent edit returns 409 with a Reload action, never a silent clobber | MUST | P5 |
| B13 | Converging nodes show whether they are OR-join or AND-join | MUST | P6 |
| B14 | The palette is context-aware — triggers where a trigger belongs | SHOULD | P5 |
| B15 | Live execution visuals during a test run | SHOULD | P8 |
| B16 | Auto-layout / align | SHOULD | P5 |
| B17 | Folders past ~20 automations | SHOULD | P7 |
| B18 | Mobile: **view**, activate/deactivate, run history. Editing is desktop-only | MUST | P5 |

### 5.3 Triggers & events — P2 / P4 / P9

| ID | Requirement | | |
|---|---|---|---|
| T1 | Every event type has a Zod payload schema and **exactly one** producer helper. Spreading a DB row into a payload is forbidden | MUST | P2 |
| T2 | Producers write to an outbox **in the same transaction as the domain write** | MUST | P2 |
| T3 | A worker claims with `FOR UPDATE SKIP LOCKED`, backs off 30s→8m, dead-letters after 5 | MUST | P2 |
| T4 | Rows stuck in `processing` > 5 min recover | MUST | P2 |
| T5 | One outbox row **per subscriber** — a failure in one does not retry the other | MUST | P2 |
| T6 | Filters evaluated by one generic matcher against a typed payload | MUST | P4 |
| T7 | An automation may have several trigger nodes, each evaluated independently | MUST | P4 |
| T8 | An `Idempotency-Key`-backed unique index prevents duplicate runs from duplicate deliveries | MUST | P4 |
| T9 | A new event for a subject already running or waiting **refreshes** its context via the loader | MUST | P4 |
| T10 | Definition defaults are persisted into node config at creation, so the UI default and the runtime default are one declaration | MUST | P5 |
| T11 | Inbound webhooks: per-workflow path, method allowlist, none/secret/HMAC auth, rate limit, size cap | MUST | P9 |
| T12 | A raw passthrough webhook exposing the whole payload | MUST | P9 |
| T13 | Scheduled triggers resolving the **automation's** timezone, falling back to the tenant's | MUST | P9 |
| T14 | "Once only" state is **persisted**, never in-process | MUST | P9 |
| T15 | Recurring service and asset triggers: contract visit due, contract expiring, warranty expiring | MUST | P9 |
| T16 | A trigger evaluation record explains **why an automation did not run** | MUST | P4 |

### 5.4 Engine — P3 / P6

| ID | Requirement | | |
|---|---|---|---|
| E1 | BFS traversal from the matched trigger node | MUST | P3 |
| E2 | **OR-join by default**; an explicit merge node for AND | MUST | P6 |
| E3 | The **whole** parameter bag is interpolated once, before dispatch, with a declared opt-out | MUST | P3 |
| E4 | Every executor is `(input) => Promise<{ handle?, output? }>` and touches no table | MUST | P3 |
| E5 | Node outputs accumulate, addressable as `{{previous.<label>.<key>}}` | MUST | P3 |
| E6 | Every transition out of `running` is a compare-and-set | MUST | P3 |
| E7 | Context is refreshed after nodes declaring `mutates`, and the analytics cache invalidated | MUST | P3 |
| E8 | **Durable delays**: serialise, `resume_at`, resume from a claiming worker | MUST | P6 |
| E9 | Delay modes: relative · until a date · next business hour · quiet-hours safe | MUST | P6 |
| E10 | A **run pins the version it started on** | MUST | P1/P3 |
| E11 | Goal nodes end the run early; the goal node has **no outputs** | MUST | P6 |
| E12 | Loops over a list, capped at 500; a delay inside a loop is rejected at publish | MUST | P6 |
| E13 | Sub-automations with variable mapping, depth ≤ 3 | SHOULD | P7 |
| E14 | Stop node with success / failed / cancelled | MUST | P3 |
| E15 | Global wall clock; partial outputs preserved on timeout | MUST | P3 |
| E16 | Failure notification on crash and timeout, **not** on cancel | SHOULD | P8 |
| E17 | Disabled nodes are skipped and logged as `skipped` | MUST | P3 |
| E18 | An `at-most-once` node refuses to re-enter after a crash | MUST | P3 |
| E19 | Per-tenant concurrent and daily quotas, **surfaced before enforced** | MUST | P3 |

### 5.5 Variables — P3 / P7

| ID | Requirement | | |
|---|---|---|---|
| V1 | **One declaration per variable** — `{ path, label, type, format, providedBy, encoding, resolve }`. The picker, the resolver, the suggestions and the docs all derive from it. **No second map** | MUST | P3 |
| V2 | Paths are immutable; labels are freely renameable | MUST | P3 |
| V3 | An unresolved variable logs a diagnostic with a "did you mean", and surfaces it in the replay | MUST | P3 |
| V4 | Datetimes resolve automation zone → tenant zone → configured floor. **Never the server zone.** Rendered datetimes carry the zone abbreviation | MUST | P3 |
| V5 | Formatting is driven by the declaration, never inferred from the value's shape | MUST | P3 |
| V6 | Output encoding applied per destination | MUST | P3 |
| V7 | `env*`, `__*`, `prototype`, `constructor` blocked, returning a **visible** marker | MUST | P3 |
| V8 | The picker is scoped to what the trigger provides | SHOULD | P7 |

### 5.6 Observability — P8

| ID | Requirement | | |
|---|---|---|---|
| O1 | One log row per node per run: status, timings, **resolved parameters**, output, error | MUST | P3 |
| O2 | Full context stored for failed nodes and test runs | MUST | P3 |
| O3 | Runs list per automation and org-wide, filterable | MUST | P8 |
| O4 | **Replay viewer** — the same canvas, read-only, each node's real status | MUST | P8 |
| O5 | Context inspector at any node in a past run | MUST | P8 |
| O6 | **Run-from-node**, forking a run seeded with the stored context | SHOULD | P8 |
| O7 | **Test a single node** from its config panel | MUST | P8 |
| O8 | Whole-automation **dry run** — describes sends instead of sending | MUST | P8 |
| O9 | Enrollment view: who is in this automation, and where | SHOULD | P8 |
| O10 | Cancel one run, or all runs of an automation | MUST | P8 |
| O11 | Node log retention from day one | MUST | P8 |
| O12 | Failure messages name **the cause and the next action**, never a code or a stack | MUST | P3 |
| O13 | An operator health view: queue depth, dead letters, tenants over quota | SHOULD | P8 |

### 5.7 Security — designed in from P0, closed out in P10

| ID | Requirement | | |
|---|---|---|---|
| S1 | Every `services/workflow/` function takes `tenantId` explicitly; every query includes it. **There is no RLS** | MUST | P3 |
| S2 | Foreign ids in node config are checked at save **and** at execution | MUST | P3 |
| S3 | Customer opt-out gate on every automation send; unsubscribe link; attribution footer | MUST | P3 |
| S4 | Quiet hours | MUST | P6 |
| S5 | No free-text email recipient in v1 | MUST | P3 |
| S6 | Per-tenant daily automation email cap | MUST | P3 |
| S7 | Publish, activate and delete require owner/admin | MUST | P5 |
| S8 | Webhook auth uses length-padded constant-time comparison; secrets stored hashed | MUST | P9 |
| S9 | Route-level rate limits on every public and expensive endpoint | MUST | P9 |
| S10 | Outbound HTTP only with a validator that resolves DNS first and re-validates every redirect | MUST | P10 |
| S11 | Structured logs with a correlation id and no secrets | MUST | P3 |
| S12 | No code execution. Never `eval`, `new Function`, or Node `vm` | MUST | — |

---

## 6. Data model

Eleven tables, two columns on `customers`, three on `tenants`. Full detail with reasoning in
[[wf-03-data-model]]. Five deliberate differences from the source system:

1. `source_handle` is a **column**, not JSON — routing logic must be queryable
2. **Versioning by snapshot** — runs pin a version and resume on the graph they started with
3. `subject_type` / `subject_id` instead of a hard-coded `customer_id`
4. `idempotency_key` and `active_dedup_key` are first-class unique indexes, replacing a trigger-claim
   table and a query-then-insert race
5. One outbox row **per subscriber**, so failures do not cascade

---

## 7. Success metrics

| Metric | Target |
|---|---|
| Adoption — active tenants with ≥ 1 active automation at 90 days | ≥ 60% |
| Depth — median nodes per active automation | ≥ 4 |
| Reliability — runs completing or intentionally pausing | ≥ 99.5% |
| Latency — p95 event → first node executed | < 5s |
| Self-service — failed runs opened in replay | ≥ 70% |
| Node velocity — engineer-days per new node type | ≤ 1 |
| Support — automation tickets per 100 active automations per month | ≤ 2 |
| Safety — cross-tenant exposures, SSRF incidents, sends to opted-out customers | **0** |
| Email — automation emails per tenant per day | within cap, p99 |

---

## 8. Rollout

| Stage | Audience | Gate |
|---|---|---|
| Internal alpha | the developer, on the demo tenant | after **P6** — branching, delays, and a resume proven across a real deploy |
| Private beta | the first live tenants, feature-flagged | after **P8** — replay shipped; every failure reviewed by a human for two weeks |
| Public beta | opt-in | after **P9** — quotas enforced, webhook surface reviewed |
| GA | all tenants | after **P10** — templates, docs, security review, support runbook |

**Launch with templates, not a blank canvas.** Ten, installed inactive
([[wf-00-decisions|D-27]]). An empty builder converts badly, and an automation that starts sending
before a human has read it converts worse.

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Untyped event payloads cause silent breakage | **High** — it happened in the source system, and [[quotes\|QUO-02]] is this repo's version | High | T1: Zod per event, one producer, fixtures from the schema, a round-trip test |
| The engine becomes a second writer and corrupts domain state | **High** — [[quotes\|QUO-02]] and the bulk-status-update bug are both exactly this | High | [[wf-00-decisions\|D-17]], enforced by a test that fails an executor which writes a table |
| Automations email customers who did not consent | High | **Critical** — reputation and CAN-SPAM | S3/S5/S6, shipped in P3 with the engine, not after |
| Cross-tenant leak, with no RLS to catch it | Medium | **Critical** | S1/S2, cross-tenant integration tests per action node, `/security-review` before merge |
| SSRF via the HTTP node | Medium | **Critical** | Deferred to P10 behind a complete validator, or not shipped |
| Editing a live automation breaks a paused run | High | Medium | Version pinning from P1 — the cheapest it will ever be |
| Node log table growth | High | Medium | 90-day retention from P8, planned in P1 |
| The builder overwhelms a non-technical owner | Medium | High | Templates, generated forms, trigger-scoped variables, plain-language failures |
| Scope creep into an iPaaS | Medium | Medium | Non-goals in §2; every node justified by a service-business use case |
| P5 (builder) is too large and stalls | Medium | Medium | Four commits: canvas+store, renderer+fields, save/publish, polish |
| Extracting `services/jobs/` regresses the most-audited file in the repo | Medium | High | Pure move, no behaviour change, one endpoint at a time, on top of existing seams |

---

## 10. Open questions — all resolved

Every question the source PRD left open is answered in [[wf-00-decisions]]:

| Source Q | Answer |
|---|---|
| Q1 subject | Polymorphic — 7 subject types, customer always resolved (D-02) |
| Q2 goal semantics | Exit, with the dead branch made unexpressible (D-04) |
| Q3 re-enrollment | No — refresh instead, enforced by a partial unique index (D-03) |
| Q4 agency scope | No (D-11) |
| Q5 code node | No; `data.setFields` + a closed operator set (D-12) |
| Q6 picker types | 13, listed in [[wf-04-node-catalog\|§4.1]] |
| Q7 metering | Quotas, not billing, in v1 (D-26) |
| Q8 templates | The 10 in D-27 |
| Q9 existing queue | None existed. Postgres outbox, transactional with the write (D-18) |
