# PRD — Workflow Automation

**Target:** a CRM product other than SiloCRM
**Status:** Draft for review
**Author:** derived from an audit of the SiloCRM implementation (see `00`–`10` in this folder)
**Date:** 2026-08-06

> This PRD is written against SiloCRM's shipped system as the reference implementation. Where it
> deviates, [`10-audit-findings.md`](10-audit-findings.md) explains why. Anything about *your*
> product's users, pricing, or existing data model is a placeholder marked **[DECIDE]** — those need
> your input, not mine.

---

## 1. Problem

CRM users perform the same sequences by hand, every day: a lead arrives → text them within 5
minutes → create a task for the rep → if no reply in 2 days, email → if they book, stop.

Doing this manually means it is done late, inconsistently, or not at all. Speed-to-lead is the
single most measurable driver of conversion in inbound sales, and it is exactly the thing humans are
worst at.

Existing options force a bad trade:

| Option | Problem |
|---|---|
| Hardcoded per-customer rules | Every request is engineering work; doesn't scale past a handful of customers |
| Zapier / Make | Lives outside the CRM. No native pipeline/stage/tag/custom-field awareness, per-task pricing, another vendor for the customer to learn and pay for |
| Simple "if stage = X then send Y" rules | Hits a ceiling almost immediately — no delays, no branching, no multi-step |
| GoHighLevel-style builder | What customers actually expect. If you don't have it, you lose deals to vendors who do. |

**We need a visual, multi-step, event-driven automation builder native to the CRM's own data model.**

### Product shape, stated plainly

**Build an n8n-style workflow builder inside the CRM.** n8n is the reference for the *editor* and
the *node contract*: a palette, an infinite canvas, named output handles, and a config form
generated from each node's JSON description. GoHighLevel is the reference for the *semantics*: the
subject of a run is a contact/lead, waits last days or weeks, and the nodes speak the CRM's own
language (pipelines, stages, tags, custom fields).

Three deliberate departures from n8n, each load-bearing:

1. **Subject-centric, not item-centric.** A run is *about* one record. This is what makes "enroll
   this contact", "is this contact already in this workflow", and "remove from workflow"
   expressible at all.
2. **Durable pauses.** A 30-day Wait is a database row with a `resume_at`, resumed by a locked
   cron — not an in-process timer.
3. **CRM-native field types.** ~12 picker types bound to the tenant's own data. This is the entire
   difference between a native builder and an embedded Zapier.

## 2. Goals & non-goals

### Goals

| # | Goal | Success measure |
|---|---|---|
| G1 | Non-technical users build multi-step automations without help | ≥60% of active orgs have ≥1 active workflow within 90 days **[DECIDE: your baseline]** |
| G2 | Automations are reliable | ≥99.5% of triggered executions complete or intentionally pause; zero silent drops |
| G3 | Users can self-diagnose failures | ≥70% of failed executions viewed in the replay UI without a support ticket |
| G4 | Adding a new node type is cheap | New node ≤ 1 engineer-day: one JSON file + one executor function |
| G5 | Long waits are safe | A 30-day delay survives every deploy in between |
| G6 | Tenant isolation is absolute | Zero cross-tenant data exposure; no SSRF into internal infrastructure |

### Non-goals (v1)

- ❌ A public marketplace of community-contributed nodes
- ❌ Real-time multiplayer editing
- ❌ A general-purpose iPaaS competing with Zapier on connector count
- ❌ Sub-second latency (event-queue polling means seconds, not milliseconds)
- ❌ Executions running longer than the wall-clock cap (model long work as delays)
- ❌ Agency/multi-tenant-management scope **[DECIDE — only if you sell to agencies; it roughly
  doubles node count and adds an approval subsystem]**

## 3. Users

| Persona | Needs | Implication |
|---|---|---|
| **Ops admin** (primary) — non-technical, owns the CRM config | Templates, plain-language config, "did it work?" visibility | Generic config renderer must be genuinely usable; failure messages in human words |
| **Sales rep** (indirect) — never opens the builder | Automations to not embarrass them (no duplicate texts, no 3am sends) | Idempotency, DND respect, quiet hours, business-hours-aware delays |
| **Power user / consultant** | HTTP nodes, webhooks, code, branching | Escape hatches: HTTP request, raw webhook, code block, variables everywhere |
| **Support engineer** (internal) | Answer "why did this customer get the wrong SMS?" | Node-level logs, context inspector, run-from-node replay |

## 4. Core concepts (the vocabulary)

| Term | Definition |
|---|---|
| **Workflow** | A named, versioned, directed graph of nodes owned by one organization |
| **Node** | One step. Has a `node_type` (immutable id), a config, and a canvas position |
| **Edge** | A directed connection with a `source_handle` for multi-output routing |
| **Trigger** | An entry node. Declares which event starts the workflow and filters it |
| **Action** | A node with a side effect (send, create, update, call out) |
| **Logic node** | Branching, delay, loop, merge, stop |
| **Execution** | One run of one workflow for one subject |
| **Subject** | What the run is *about* — a contact, a lead, or **[DECIDE: your primary entity]** |
| **Context** | The data available to the run: subject, related records, org, event payload, node outputs |
| **Variable** | `{{namespace.field}}` resolved from context at execution time |
| **Goal** | A condition that, when met, ends the execution early |

---

## 5. Functional requirements

### 5.1 Node definition contract — `MUST`, P0

Every node type is declared in **one JSON file**, consumed by the editor, the backend, and (later)
the AI copilot.

```jsonc
{
  "node": "sms.send",              // UNIQUE, IMMUTABLE — persisted on every saved node
  "version": 1,
  "displayName": "Send SMS",
  "icon": "Smartphone",
  "color": "#059669",
  "category": "communication",
  "subcategory": "sms",
  "description": "Send an SMS message",
  "inputs": ["main"],
  "outputs": [{ "id": "main", "label": "Next" }],   // ← id and label SEPARATE (see FR-N4)
  "mutates": ["contact"],                            // ← declares what to refresh (see FR-E7)
  "properties": [
    {
      "displayName": "Send To", "name": "recipient", "type": "options", "required": true,
      "default": "customer",
      "options": [
        { "name": "Contact Phone",  "value": "customer" },
        { "name": "Assigned User",  "value": "assignedUser" },
        { "name": "Custom Number",  "value": "custom" }
      ]
    },
    {
      "displayName": "Phone Number", "name": "phoneNumber", "type": "string",
      "displayOptions": { "show": { "recipient": ["custom"] } },   // conditional field
      "encoding": "none"
    }
  ]
}
```

| ID | Requirement | Priority |
|---|---|---|
| FR-N1 | `node` ids are **immutable**. Renames are forbidden; deprecate by adding a new id and dual-reading. Enforced by a CI test asserting the id set only grows. | MUST |
| FR-N2 | `displayOptions.show` / `.hide` conditionally render a property based on sibling values | MUST |
| FR-N3 | Node definitions contain **no behaviour**. Behaviour is an executor keyed by `node` | MUST |
| FR-N4 | Output handles have a **stable id** and a **separate display label** | MUST |
| FR-N5 | A `properties[].optionsFrom` reference expands from a canonical shared list at load time | MUST |
| FR-N6 | An `active` whitelist gates which nodes appear in the palette | MUST |
| FR-N7 | `properties[].filter` declares trigger filtering; one generic matcher evaluates all of them | MUST |
| FR-N8 | `properties[].encoding` declares output encoding for interpolated values | SHOULD |
| FR-N9 | Node ids follow a lint-enforced naming convention (`domain.verb`, lowerCamel) | SHOULD |
| FR-N10 | A `scope` discriminator supports multiple builder surfaces without forking the engine | COULD |

**Property types — P0 set (10):** `string`, `number`, `boolean`, `options`, `multiOptions`, `json`,
`dateTime`, `time`, `keyValue`, `notice`.
**P4 CRM pickers (add as needed):** `userSelect`, `tagSelect`, `multiTagSelect`, `pipelineSelect`,
`stageSelect`, `customFieldSelect`, `workflowSelect`, `emailList`, `phoneList`,
`contactFieldUpdateList`, `stringWithSuggestions`, `richText`.

> The CRM pickers are what separate a native builder from an embedded Zapier. Don't skip them —
> just sequence them after the engine works.

### 5.2 Builder — `MUST`, P1

| ID | Requirement | Priority |
|---|---|---|
| FR-B1 | Drag nodes from a searchable, category-grouped palette onto a canvas | MUST |
| FR-B2 | Connect nodes by dragging between handles | MUST |
| FR-B3 | Config panel **generated from `properties[]`** — no per-node UI required for a simple node | MUST |
| FR-B4 | `{{variable}}` insertion in any text field, with a searchable, **trigger-scoped** picker | MUST |
| FR-B5 | Variables render as removable pills, not raw braces | SHOULD |
| FR-B6 | **Insert a node on an existing edge** via a `+` on the connector | MUST |
| FR-B7 | **Relink on delete** — removing a mid-chain node reconnects its neighbours | MUST |
| FR-B8 | Client-side validation before save (no trigger, orphan nodes, required fields empty, unreachable nodes) with a blocking dialog | MUST |
| FR-B9 | Undo/redo, copy/cut/paste, multi-select | MUST |
| FR-B10 | Disable a node without deleting it | MUST |
| FR-B11 | Auto-layout / align / distribute | SHOULD |
| FR-B12 | Live execution visuals during a test run | SHOULD |
| FR-B13 | Bespoke config panels for nodes that can't be expressed declaratively (if/else builder, delay modes, rich-text email) | MUST |
| FR-B14 | Palette is context-aware — offers triggers where a trigger belongs, actions where an action belongs | SHOULD |
| FR-B15 | Converging nodes visually indicate OR-join vs AND-join | SHOULD |
| FR-B16 | Folders once an org exceeds ~20 workflows | SHOULD |
| FR-B17 | Duplicate a workflow | SHOULD |
| FR-B18 | Mobile: **view** workflows; editing is desktop-only | COULD |

### 5.3 Triggers & events — `MUST`, P2

| ID | Requirement | Priority |
|---|---|---|
| FR-T1 | Every event type has a **Zod payload schema** and exactly **one producer helper**. Spreading a DB row into an event is forbidden (lint rule). | MUST |
| FR-T2 | Producers call `dispatchEvent()`, which writes to an outbox table and returns immediately | MUST |
| FR-T3 | A worker claims events with `FOR UPDATE SKIP LOCKED`, retries with exponential backoff (30s→8m), dead-letters after 5 attempts | MUST |
| FR-T4 | Events stuck in `processing` >5 min are recovered to `pending` | MUST |
| FR-T5 | Trigger filters evaluated by **one generic matcher** against a typed payload, driven by `properties[].filter` | MUST |
| FR-T6 | A workflow may have multiple trigger nodes; each is evaluated independently | MUST |
| FR-T7 | **Idempotency**: an `Idempotency-Key` on execution creation with a unique index prevents duplicate runs from duplicate event deliveries | MUST |
| FR-T8 | A new trigger for a subject with an already-`waiting` execution **refreshes** that execution's context rather than starting a second run | MUST |
| FR-T9 | Inbound webhook triggers: per-workflow path, method allowlist, auth (none/secret/basic/HMAC), Redis-backed rate limit, configurable response, optional async | MUST |
| FR-T10 | A **raw passthrough** webhook trigger exposing the whole payload as `{{webhook.body.*}}` | MUST |
| FR-T11 | Scheduled triggers (daily at a local time, every N hours, after N days inactive), resolving the **workflow's** timezone falling back to the **org's** | MUST |
| FR-T12 | "Once only" state for inactivity triggers is **persisted**, not in-process | MUST |
| FR-T13 | Manual trigger for testing and one-off runs | MUST |
| FR-T14 | Default parameter values are persisted into node config at creation, so the UI default and the runtime default can never disagree | MUST |

**P0/P2 trigger set (7):** record created · record updated (with watch-fields) · stage/status changed ·
tag added/removed · inbound message received · webhook received · scheduled.

### 5.4 Execution engine — `MUST`, P0 + P3

| ID | Requirement | Priority |
|---|---|---|
| FR-E1 | BFS traversal from the matched trigger node | MUST |
| FR-E2 | **OR-join by default** for converging edges; explicit merge node for AND-join | MUST |
| FR-E3 | Interpolate the **whole `parameters` object once** before dispatching to the executor, with a declared opt-out for raw fields | MUST |
| FR-E4 | Every executor has the signature `(node, context) => Promise<Output>` | MUST |
| FR-E5 | Node outputs accumulate in `context.nodeOutputs`, addressable as `{{nodeId}}` and `{{nodeId.key}}` | MUST |
| FR-E6 | Every status transition out of `running` is a **compare-and-set** | MUST |
| FR-E7 | Context is refreshed after nodes that declare `mutates` | MUST |
| FR-E8 | **Durable delays**: serialize context, set `resume_at`, resume from a lock-guarded cron | MUST |
| FR-E9 | Delay modes: relative duration, absolute datetime, and **business-hours-aware** | MUST |
| FR-E10 | Goal nodes register listeners; a matching event ends the execution early | SHOULD |
| FR-E11 | Sub-workflows with input/output variable mapping, depth-capped | SHOULD |
| FR-E12 | Loops over a list with `{{currentItem}}` / `{{currentIndex}}`, iteration-capped | SHOULD |
| FR-E13 | Error-handler node with Success/Error outputs | SHOULD |
| FR-E14 | Stop node with success / failed / cancelled outcomes | MUST |
| FR-E15 | Global wall-clock timeout; partial outputs preserved on timeout | MUST |
| FR-E16 | Failure notification to org members on crash/timeout, **not** on intentional cancel | SHOULD |
| FR-E17 | **Execution pins the workflow version it started on** | MUST |
| FR-E18 | Disabled nodes are skipped and logged as `skipped` | MUST |

**Limits (defaults, all configurable):**
`MAX_EXECUTION_TIME` 5 min · `MAX_NODES_PER_WORKFLOW` 100 · `MAX_LOOP_ITERATIONS` 1,000 ·
`MAX_NESTING_DEPTH` 5 · `MAX_GOTO_JUMPS` 10 per node ·
**`MAX_CONCURRENT_EXECUTIONS_PER_ORG`** and **`MAX_DAILY_EXECUTIONS_PER_ORG`** **[DECIDE: values]**

### 5.5 Variables — `MUST`, P0

| ID | Requirement | Priority |
|---|---|---|
| FR-V1 | **One declaration per variable** — `{ path, label, type, format, providedBy, encoding, resolve }`. The picker, the resolver, the suggestions, and the docs all derive from it. **No second hand-written map.** | MUST |
| FR-V2 | Variable paths are **immutable** (same rule as node ids); labels are freely renameable | MUST |
| FR-V3 | Unresolved variables log a diagnostic with a "did you mean" suggestion | MUST |
| FR-V4 | Datetimes resolve `subject's zone → org zone → configured floor`; **never** the server zone. Rendered datetimes always carry the zone abbreviation. | MUST |
| FR-V5 | Formatting (phone, currency, date) is driven by the variable's **declaration**, never inferred from the value's shape | MUST |
| FR-V6 | Output encoding (html/url/js/json/sql) applied per destination | MUST |
| FR-V7 | `env.*`, `__*`, `prototype`, `constructor` are blocked and return a **visible** `[BLOCKED]` marker | MUST |
| FR-V8 | The picker is scoped to what the workflow's trigger actually provides | SHOULD |

### 5.6 Observability — `MUST`, P5

| ID | Requirement | Priority |
|---|---|---|
| FR-O1 | One log row per node per execution: status, timings, input context (sensitive fields stripped), output, error | MUST |
| FR-O2 | Execution list per workflow and org-wide, filterable by status and date | MUST |
| FR-O3 | **Replay viewer**: the graph rendered with each node's actual status and output | MUST |
| FR-O4 | **Context inspector**: the exact context at any node in a past run | MUST |
| FR-O5 | **Run-from-node**: fork a new execution from a node, seeded with the stored context, linked to the parent | SHOULD |
| FR-O6 | **Test a single node** in isolation from the config panel | MUST |
| FR-O7 | Test the whole workflow against sample or real data | MUST |
| FR-O8 | Enrollment view: who is currently in this workflow and at which node | SHOULD |
| FR-O9 | Cancel one or all running/waiting executions of a workflow | MUST |
| FR-O10 | Node logs have a retention policy from day one | MUST |
| FR-O11 | Failure messages in the UI name **the cause and the next action**, never a code or a stack | MUST |

### 5.7 Security — `MUST`, P6 (but designed in from P0)

See [`09-security-and-multitenancy.md`](09-security-and-multitenancy.md) for the full checklist.

| ID | Requirement | Priority |
|---|---|---|
| FR-S1 | HTTP nodes SSRF-guarded: scheme allowlist, private/link-local/metadata IP deny, **post-DNS-resolution validation**, **redirect re-validation**, size and time caps | MUST |
| FR-S2 | Code nodes run in a **WASM interpreter** (QuickJS) with explicit CPU, memory, and wall-clock caps. Never `eval`, `new Function`, or Node `vm`. | MUST |
| FR-S3 | Row-level security; every bypass explicit and justified in a comment | MUST |
| FR-S4 | Organization id resolved from an explicit request parameter, never a JWT claim, cookie, or shared header | MUST |
| FR-S5 | Webhook auth uses length-padded constant-time comparison; secrets stored hashed | MUST |
| FR-S6 | Rate limits in a shared store (Redis), not process memory | MUST |
| FR-S7 | Integration credentials encrypted at rest, masked in API responses, never written to node logs | MUST |
| FR-S8 | **Every cron/recurring process holds a distributed lock** | MUST |
| FR-S9 | Per-org execution quotas enforced and surfaced | MUST |
| FR-S10 | Approval or explicit confirmation on bulk/destructive actions | SHOULD |

### 5.8 AI copilot — `COULD`, P6

| ID | Requirement | Priority |
|---|---|---|
| FR-A1 | Natural-language workflow construction, emitting add/connect/update/delete ops | COULD |
| FR-A2 | The model reads the **same** node registry, filtered to active + in-scope, so it can never propose a broken node | MUST *(if built)* |
| FR-A3 | The model fetches real config schemas via a tool rather than guessing parameter names | MUST *(if built)* |
| FR-A4 | Ops are applied through the **same node constructor** as drag-and-drop | MUST *(if built)* |
| FR-A5 | A validation tool the model can call before proposing changes | SHOULD |

> Much cheaper than it looks **once the declarative registry exists** — the registry doubles as the
> model's tool schema. Sequence it after the registry, never before.

---

## 6. Data model

Full detail in [`02-data-model.md`](02-data-model.md) §2.11.

```
workflows(id, org_id, name, description, is_active, folder_id,
          timezone, timezone_mode, version, published_at,
          created_by, created_at, updated_at, deleted_at)

workflow_nodes(id, workflow_id, node_type, node_config jsonb,
               position_x, position_y, deleted_at)

workflow_edges(id, workflow_id, source_node_id, source_handle,
               target_node_id, edge_config jsonb, deleted_at)

workflow_executions(id, workflow_id, workflow_version,
                    subject_type, subject_id, status,
                    started_at, completed_at, error_message,
                    resume_at, current_node_id, waiting_context jsonb,
                    parent_execution_id, idempotency_key UNIQUE)

node_execution_logs(id, execution_id, node_id, status, started_at, completed_at,
                    input_data jsonb, output_data jsonb, error_message,
                    org_id, workflow_id, node_type)          -- denormalized for querying

event_queue(id, org_id, event_type, event_data jsonb, status, attempts, max_attempts,
            last_error, scheduled_at, processed_at, next_retry_at,
            source_entity_type, source_entity_id, triggered_by_user_id)

goal_listeners(id, org_id, workflow_id, execution_id, node_id, subject_id,
               goal_type, goal_config jsonb, status, met_at)

workflow_folders(id, org_id, name, parent_id, sort_order)
```

Five deliberate changes from the SiloCRM schema:
1. `source_handle` is a **column**, not buried in JSON — it's routing logic
2. `version` on workflows + `workflow_version` on executions
3. `subject_type`/`subject_id` instead of a hardcoded `contact_id`
4. `idempotency_key` first-class (removes the need for a trigger-claims table)
5. No `convex_*` residue, no legacy engine tables

## 7. Success metrics

| Metric | Target | **[DECIDE: baselines]** |
|---|---|---|
| Adoption | % of active orgs with ≥1 active workflow at 90 days | ≥60% |
| Depth | Median nodes per active workflow | ≥4 |
| Reliability | Executions completing or intentionally pausing | ≥99.5% |
| Latency | p95 event → first node executed | <30s |
| Self-service | Failed executions viewed in replay without a ticket | ≥70% |
| Node velocity | Engineer-days per new node type | ≤1 |
| Support load | Workflow tickets per 100 active workflows / month | ≤2 |
| Safety | Cross-tenant exposures, SSRF incidents | **0** |

## 8. Rollout

| Phase | Audience | Gate |
|---|---|---|
| Alpha | Internal only, after P3 | Engine correct: branching, delays, resume across a deploy |
| Private beta | 5–10 design partners **[DECIDE]** | Replay UI shipped; a human reviews every failure for 2 weeks |
| Public beta | Opt-in, feature-flagged | Per-org quotas enforced; SSRF + sandbox audited |
| GA | All orgs | Template gallery; docs; support runbook |

**Launch with templates, not a blank canvas.** An empty builder converts badly. Ship 8–12 templates
for your vertical's most common plays **[DECIDE: which]**, e.g. speed-to-lead text, no-reply
follow-up sequence, appointment reminder, post-appointment review request, stale-lead reactivation,
missed-call text-back.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Untyped event payloads cause silent breakage | **High** (it happened in SiloCRM) | High | FR-T1: Zod per event, one producer helper, fixtures built from the schema |
| Users build automations that spam contacts | High | High | Idempotency, DND enforcement in the send path, quiet hours, per-org quotas, a confirm step on bulk sends |
| SSRF via the HTTP node | Medium | **Critical** | FR-S1, with an external review before public beta |
| Sandbox escape via the code node | Low | **Critical** | FR-S2 (WASM); consider deferring the code node past GA |
| Node-log table growth | High | Medium | FR-O10 retention from day one |
| Editing a live workflow breaks in-flight runs | High | Medium | FR-E17 version pinning |
| Builder complexity overwhelms non-technical users | Medium | High | Templates, trigger-scoped variables, generic renderer quality, plain-language failure messages |
| Scope creep into a general iPaaS | Medium | Medium | Non-goals §2; every node must be justified by a CRM use case |

## 10. Open questions

| # | Question | Owner |
|---|---|---|
| Q1 | What is the **subject** of an execution in your CRM — contact, lead, deal, account, or polymorphic? Decides `subject_type`. | **[DECIDE]** |
| Q2 | Goal semantics: **exit** the workflow (SiloCRM) or **jump** to the goal branch (GHL)? | **[DECIDE]** |
| Q3 | Can one subject be enrolled in the same workflow more than once? | **[DECIDE]** — recommend no, refresh instead |
| Q4 | Agency/multi-tenant-management scope in v1? | **[DECIDE]** — recommend no |
| Q5 | Code node in v1, or a constrained expression language? | **[DECIDE]** — recommend expression language first |
| Q6 | Which 12 CRM picker property types map to your data model? | **[DECIDE]** |
| Q7 | Is workflow execution metered/billed, and if so on what unit? | **[DECIDE]** |
| Q8 | Which 8–12 launch templates? | **[DECIDE]** |
| Q9 | Do you already have an outbox/queue you should reuse rather than build? | **[DECIDE]** |

## 11. Appendix — reference implementation

| Topic | Doc |
|---|---|
| System architecture and data flow | [`01-architecture.md`](01-architecture.md) |
| Full schema | [`02-data-model.md`](02-data-model.md) |
| All 156 nodes and what each does | [`03-node-catalog.md`](03-node-catalog.md) · [`node-catalog.tsv`](node-catalog.tsv) |
| Traversal, delays, goals, sandbox | [`04-execution-engine.md`](04-execution-engine.md) |
| Events, filters, webhooks, crons | [`05-triggers-and-events.md`](05-triggers-and-events.md) |
| Variable system | [`06-variables-and-templating.md`](06-variables-and-templating.md) |
| Builder UI as shipped | [`07-frontend-builder.md`](07-frontend-builder.md) |
| Builder implementation rules | [`11-frontend-guidelines.md`](11-frontend-guidelines.md) |
| REST surface | [`08-api-surface.md`](08-api-surface.md) |
| Security | [`09-security-and-multitenancy.md`](09-security-and-multitenancy.md) |
| What to copy / what to fix | [`10-audit-findings.md`](10-audit-findings.md) |
