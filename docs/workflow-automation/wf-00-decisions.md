# WF-00 — Decisions

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-01-gap-analysis]] | [[wf-03-data-model]] | [[wf-12-phases]] | [[decisions|ADRs]] | [[strict-rules]] | [[security-rules]]

Every `[DECIDE]` and open question the [[PRD|SiloCRM port PRD]] left for the target product,
answered for Zaxvio, with the reasoning. **These are settled.** Revisit only with a reason written
down here, the same rule [[decisions|ADR-001/002]] follow.

Format: **decision** · *why* · *what it costs* · *what would change it*.

---

## D-01 — Product name: "Automations". Code and schema say `workflow`.

The route is `/automations`, the sidebar item is **Automations**, the user-facing noun is
"automation". Database tables are `workflows`, `workflow_nodes`, `workflow_edges`; the API prefix is
`/workflows`; the code namespace is `services/workflow/`.

*Why:* a solo HVAC contractor recognises "automation"; "workflow" is engineering vocabulary that in
this product would collide with the *job pipeline*, which is the thing users already call their
workflow. Splitting the two vocabularies deliberately — instead of by accident, which is what
SiloCRM did — keeps the schema honest and the UI plain.

*Cost:* one mapping to remember. Documented here and in [[wf-09-api-surface]].

---

## D-02 — The subject of a run is polymorphic: `subject_type` + `subject_id`.

Allowed subject types: `customer`, `job`, `invoice`, `quote`, `booking`, `equipment`,
`maintenance_contract`.

*Why:* SiloCRM is a sales CRM, so a contact is the obvious subject. Zaxvio is service management,
where the centre of gravity is **the job**, and invoices, quotes and bookings are first-class
records that automations are legitimately *about* — "chase this invoice", not "chase this customer".
Hard-coding `customer_id` would repeat SiloCRM's exact mistake: it needed a second nullable
`subject_org_id` column the moment a second subject appeared, and [[02-data-model|§2.11]] names
generalising the subject as one of the four changes a port should make.

*Consequence:* the execution context **always resolves the customer** behind whatever the subject is
(every one of the seven tables carries a `customer_id`), so `{{customer.email}}` is available on a
job-triggered or invoice-triggered run without the workflow author thinking about it. See
[[wf-07-variables]].

*Cost:* no FK from `workflow_executions` to the subject table. Referential integrity is enforced by
the loader (a subject that no longer exists ends the run as `cancelled`, not `failed` — a deleted
job is not a bug). Documented in [[wf-03-data-model]].

---

## D-03 — One active execution per (workflow, subject). A re-trigger refreshes, never duplicates.

Enforced structurally, not by convention: `workflow_executions.active_dedup_key` with

```sql
CREATE UNIQUE INDEX ... ON workflow_executions (active_dedup_key)
  WHERE active_dedup_key IS NOT NULL AND status IN ('running', 'waiting');
```

`active_dedup_key = '<workflow_id>:<subject_type>:<subject_id>'` for event-triggered runs, and
**NULL** for manual runs, test runs and webhook runs with no subject — those may legitimately run
concurrently.

*Why:* SiloCRM enforces this with a query-then-insert, which is a race. Zaxvio already has the
better pattern in production: the quotes audit put a UNIQUE index on `quotes.access_token` and
verified the `23505` path by execution. The trigger service catches `23505` and takes the
**refresh** branch — reload the subject and its customer from the database, merge into
`waiting_context` — which is exactly what SiloCRM does at
[[05-triggers-and-events|workflow-trigger.service.ts:746]], minus the race.

*Refresh calls the loader.* SiloCRM hand-rebuilds the context across ~180 lines that can drift from
`loadExecutionContext`; [[10-audit-findings|B-12]] flags it. One loader, one shape.

---

## D-04 — A goal **exits** the run. The goal node has no outputs.

Same semantics as SiloCRM ([[10-audit-findings|C-01]]) — when the goal event fires, the execution
completes from wherever it is; it does not jump to a branch — **but with the UI defect fixed**:
in Zaxvio the goal node renders with **zero output handles**, so a user cannot wire a branch that
will never run.

*Why:* SiloCRM's goal node has a downstream branch that is silently dead. That is worse than either
semantics. Exit-only is the behaviour that matches the actual need ("stop nagging them once they
book"), and making the dead branch unexpressible costs nothing.

*Roadmap:* a separate `goal.jump` node if a customer asks for it. Not v1.

---

## D-05 — Converging edges are OR-join. `logic.merge` opts into AND. The editor says which.

Keep SiloCRM's default ([[10-audit-findings|C-03]]) — an if/else whose two branches both feed one
"send follow-up" node must fire, and with AND semantics it never would.

**Fix [[10-audit-findings|B-15]] at the same time:** any node with more than one incoming edge
renders an inline badge — *"Runs when any branch reaches it"* — and a `logic.merge` node renders
*"Waits for all N branches"*. Users discover this by being surprised otherwise.

---

## D-06 — Versioning from day one, by **snapshot**. Editing a live automation cannot break a run in flight.

- `workflow_nodes` / `workflow_edges` are the **draft** graph — what the builder edits.
- `workflow_versions(id, workflow_id, version, graph jsonb, published_at, published_by)` is the
  **published** snapshot.
- `workflows.active_version_id` is what triggers run.
- `workflow_executions.workflow_version_id` pins the version a run started on, and resume loads the
  snapshot, never the live tables.

*Why:* [[10-audit-findings|B-04]] is rated 🟠 and says *"add this in P0 — retrofitting versioning
after you have production runs is a migration nightmare."* Zaxvio has zero production runs today, so
this is the cheapest it will ever be. Without it a 7-day delay resumes into a graph whose next node
may no longer exist.

*Bonus:* "revert to the previous version" is nearly free, and the executions list can say which
version produced a failure.

*Cost:* the builder owes an unmissable **"You have unpublished changes"** state and a Publish action
distinct from Save. That is a real UX obligation, specified in [[wf-08-builder-frontend]].

---

## D-07 — Output handles have stable ids. `source_handle` is a column.

`workflow_edges.source_handle text NOT NULL DEFAULT 'main'`. Node definitions declare
`outputs: [{ id: 'found', label: 'Found' }, { id: 'not_found', label: 'Not Found' }]`.

*Why:* [[10-audit-findings|B-06]] / [[11-frontend-guidelines|FE-H4]] — SiloCRM stores the *display
label* in `sourceHandle`, so renaming "Found" breaks routing on every saved workflow. And routing
logic buried in a JSON blob cannot be indexed or queried.

---

## D-08 — Interpolate the whole parameter bag once, before dispatch.

`executeNode()` walks `node_config.parameters` and resolves every `{{token}}` before the executor
sees it. A property opts out with `noInterpolate: true` (regex patterns, and later, code bodies).

*Why:* [[10-audit-findings|B-05]] — per-executor interpolation means a new node that forgets a field
ships a bug that only appears when a user puts a variable in it.

---

## D-09 — Trigger filters are declarative on the node property. One generic matcher.

```ts
{ name: "pipelineId", type: "pipelineSelect",
  filter: { path: "job.pipelineId", operator: "equals" } }
```

*Why:* [[10-audit-findings|B-02]] — SiloCRM's `matchesTriggerFilters()` is 3,146 lines of
per-event-family `if` cascades, and a missing branch means a filter the user configured silently
does nothing. One evaluator over a typed payload gives every new trigger its filtering for free.

---

## D-10 — Every event type has a Zod payload schema and exactly one producer helper.

`emitWorkflowEvent()` is the only writer. **Spreading a database row into an event payload is
forbidden.** Test fixtures are built *from* the schema, never hand-written.

*Why:* [[10-audit-findings|B-01]] is the single most expensive defect in the source system — three
spellings of one field across producer, matcher and goal listener, all typed `unknown`, so it
compiled and every stage-filtered goal node was dead in production for months. The hand-written test
fixture passed the whole time because it hand-wrote the payload production never emitted.

Zaxvio has its own version of this scar: [[quotes|QUO-02]] — `lib/quote-to-job.ts` wrote
`jobs.status` by hand and never set `stage_id`, so for four days every job created from a quote was
outside the stage model. Same class: a second writer with its own idea of the shape.

---

## D-11 — No agency scope. No `scope` column.

*Why:* Zaxvio's superadmin panel is platform operations, not an automation surface sold to agencies.
[[03-node-catalog|§3.9]] costs 56 extra nodes and an approval subsystem, and [[PRD|Q4]] recommends
against it. Adding a `scope` column later is `ALTER TABLE ... DEFAULT 'org'` plus mechanical query
changes — real work, but not a rewrite, and not worth doubling the node registry for a product line
that does not exist.

---

## D-12 — No code node in v1.

`data.code` (arbitrary JavaScript) is **out of scope**. Conditions get a closed operator set; data
shaping gets `data.setFields` and `data.math`. No `eval`, no `new Function`, no Node `vm` — ever.

*Why:* [[09-security-and-multitenancy|§9.2]] — a code node is a large security and support surface
for modest user value, and the only acceptable implementation is a WASM interpreter
(`quickjs-emscripten`), which is a meaningful new dependency for a product whose users are solo
contractors. [[PRD|Q5]] recommends deferring it.

---

## D-13 — Inbound webhooks in Phase 9. Outbound HTTP in Phase 10, and only with a complete SSRF validator.

Inbound (`trigger.webhook`, `trigger.webhook.raw`) has no SSRF surface and is how a website form
reaches the CRM, so it ships earlier. Outbound (`http.request`, `webhook.send`) is the highest
-severity risk in the entire feature and ships last, gated behind the active-node whitelist, only
once the validator does **all** of: scheme allowlist, private/link-local/metadata IP deny,
**validation after DNS resolution**, **re-validation on every redirect hop**, response size cap,
connect and read timeouts.

*Why:* [[09-security-and-multitenancy|§9.1]] — DNS rebinding and redirect re-validation are the two
items most commonly missed, and an unguarded HTTP node lets any tenant read cloud instance
credentials off the metadata endpoint.

---

## D-14 — An automation may not email an arbitrary address in v1.

`email.send` recipients resolve to: the subject's customer, the job's assignee, a named team member,
or all org members. **No free-text address field.** A `custom` recipient arrives in Phase 10 behind
a per-tenant daily send quota.

*Why:* the moment a workflow can send to any address, the product is an open relay wearing a CRM's
sender reputation. Resend's domain reputation is shared across every tenant.

---

## D-15 — **New requirement:** customer communication opt-out. Blocking, Phase 3.

Zaxvio has **no** opt-out flag on `customers`, no suppression list, and no quiet hours. Today that is
survivable because every email is a direct consequence of a human action. An automation engine makes
it a compliance and reputation problem on day one.

Ship with the engine, not after it:

| Thing | Where |
|---|---|
| `customers.email_opt_out boolean NOT NULL DEFAULT false` | migration, Phase 3 |
| `customers.opt_out_at`, `opt_out_reason` | same |
| A single `canEmailCustomer(db, tenantId, customerId)` gate every send path calls | `lib/communication-guards.ts` |
| Unsubscribe link in every automation-sent customer email | `packages/email` layout |
| Tenant quiet hours (`automation_quiet_hours_start/end`, nullable) | Phase 6, with business-hours-aware delay |

A node that refuses to send because of an opt-out logs `skipped` with a plain-language reason
([[09-security-and-multitenancy|§9.8]]), it does not fail the run.

*Why this is not scope creep:* SiloCRM has an entire `dnd.*` node family and DND checks inside the
send path. The port guide assumes it exists. Zaxvio's equivalent is empty.

---

## D-16 — The engine carries its tenant id explicitly. There is no RLS to fall back on.

SiloCRM has Postgres row-level security; Zaxvio has **application-level isolation only**
(`requireTenant` + `tenantFilter()`, [[security-rules|§1]]). The engine runs **outside a request**,
so there is no `request.authUser` and no session to lean on.

Rule, non-negotiable: **every function under `services/workflow/` takes `tenantId` as an explicit
argument and every query includes it.** An `EngineContext` is built once from the workflow row and
threaded down; nothing reads a tenant id out of a node config, an event payload, or a subject row.

This is the largest security delta from the source system and gets its own section in
[[wf-10-security]].

---

## D-17 — **The "no second writer" rule.** Action nodes call the existing service. Always.

An action node **must not** write a domain table directly. It calls the same function the HTTP route
calls: `job-stages.service.ts` to move a job, `services/invoices/status.service.ts` to touch invoice
status, `lib/quote-guards.ts` to transition a quote, `lib/line-items.ts` to add a line.

*Why, with receipts from this repo:*

- [[quotes|QUO-02]] — `lib/quote-to-job.ts` wrote `jobs.status` by hand. Every job created from a
  quote counted **0** in the stage-keyed pipeline counts and matched no lifecycle filter, for four
  days, because the jobs audit converted the writers *inside* `routes/jobs` and never grepped
  outside it.
- [[jobs|JOB-*]] — `bulk-status-update` skipped the completion gate, the E-05 email, the
  notification and the activity row that the single-job path all fire.

A workflow engine is, definitionally, a *new writer for every table in the product*. If it writes
columns directly it will reproduce both bugs at once, at machine speed, and the symptom will show up
somewhere else entirely.

**Consequence, and it is a good one:** several actions need a service that does not exist yet —
job creation and job updates live inside a 2,514-line route handler. Phase 7 therefore forces
[[architecture|ARC-05]] (extract `services/jobs/`), which is already the repo's largest
architectural debt. The automation work pays it down instead of routing around it.

---

## D-18 — Durable queue, in-process nudge. Multi-instance safety by row-claiming, not locks.

Events are written to `workflow_event_queue` (transactional outbox, [[10-audit-findings|A-02]]).
The worker polls every 5 seconds **and** is nudged in-process on enqueue, so the common case is
sub-second while durability comes from the table.

Claiming uses `UPDATE ... RETURNING` with `FOR UPDATE SKIP LOCKED`, **not** an advisory lock.

*Why not `withCronLock`:* SiloCRM runs many Railway replicas and uses `pg_try_advisory_lock` so
exactly one ticks. Zaxvio runs **one** Render instance today, and the repo already established the
better pattern for this shape of work — `email-cron.ts` claims rows with a single
`UPDATE ... RETURNING` so that *N* instances split the work rather than idling *N-1* of them, and a
crash-loop stops being a mailing-loop ([[invoices|INV-30]], verified by execution). Row-claiming is
correct at one instance and correct at ten. An advisory lock is only correct at one *ticker*.

*Caveat, written down:* the in-process nudge is not seen by a second instance. The 5-second poll is
the floor that covers it. Same known constraint as [[decisions|ADR-001]]'s in-process event bus.

---

## D-19 — Node log retention: 90 days. Full context stored only where it is needed.

`node_execution_logs` grows one row per node per run and is the fastest-growing table in the system
([[10-audit-findings|B-11]]).

- Always stored: node id/type/label, status, timings, **interpolated parameters**, output, error.
- Stored **only** for failed nodes and for test runs: the full context snapshot.
- Swept at 90 days by the same worker that resumes delays, claimed in bounded batches.

*Why the split:* the interpolated parameters answer "what did this node actually try to do", which
is 95% of debugging, and they are small. A full context snapshot per node per run is what makes the
table unmanageable. Failed nodes and test runs are exactly where you want the whole picture.

---

## D-20 — Bounded pause context.

`waiting_context` is capped at **256 KB** serialised. On overflow the engine drops `nodeOutputs` for
all but the last five nodes and sets `context_truncated: true`, which the replay UI shows.

*Why:* [[02-data-model|§2.4]] flags unbounded growth and marks "has any production row hit a limit"
as **UNVERIFIED**. A truncation you can see beats a 10 MB row you cannot.

---

## D-21 — Loops are bounded and may not contain a delay.

`MAX_LOOP_ITERATIONS = 500`. Save-time validation **rejects** a `delay.wait` inside a loop body.

*Why:* [[04-execution-engine|§4.2]] says loop position surviving a mid-loop resume is
**UNVERIFIED** in the source system. Making the unverified case unexpressible is cheaper than
verifying it, and Zaxvio's real loops ("for each line item", "for each overdue invoice") are small
and do not want a delay inside them anyway.

---

## D-22 — Side effects declare their re-run safety.

Node definitions carry `sideEffect: 'none' | 'idempotent' | 'at-most-once'`. The engine writes a
node log row with status `running` **before** invoking an `at-most-once` executor; a resume that
finds an existing `running` log for that node marks it `failed` with *"may have already run"* rather
than sending twice.

*Why:* the approval gate's `reExecuteCurrentNode` and any crash-then-resume both re-enter a node.
"Send the customer an email" is not safe to re-enter, and nothing in the source system says so.

---

## D-23 — Node definitions are TypeScript modules, not JSON files.

One file per node, `export default { ... } satisfies NodeDefinition`, collected by an explicit
static barrel (**never a glob** — [[11-frontend-guidelines|FE-P2]]).

*Why this deviates from the source:* SiloCRM uses JSON, which cannot be type-checked against
`NodeDefinition` and cannot reference a shared constant (hence its `optionsFrom` mechanism). Under
Node 22 ESM — which is what `tsx` runs here — importing JSON requires import attributes
(`with { type: "json" }`), and Next.js 14's bundler and `tsx` treat that differently. TypeScript
modules avoid the entire class of problem, make a typo in a property type a **compile error**, and
let a node import `JOB_LIFECYCLES` or `EXPENSE_CATEGORIES` directly instead of re-declaring them.

`optionsFrom` is therefore unnecessary and is **not** ported. Its purpose — [[10-audit-findings|A-06]],
stopping shared option lists from drifting — is served better by an actual import.

---

## D-24 — Shared contract lives in a new workspace package: `@hvac-saas/workflow-nodes`.

Raw TypeScript, no build step, matching the repo convention (`"." : "./src/index.ts"`, run by `tsx`,
confirmed in `render.yaml`). Holds: the `NodeDefinition` type, the node registry, the active-node
whitelist, the variable registry, and the event payload schemas — everything both the builder and
the engine must agree on.

*Why a package and not `packages/types`:* `@hvac-saas/types` is inferred from the Drizzle schema and
imported everywhere; putting a 60-file node registry in it would pull the registry into every page
that wants a `Customer` type. This is the one idea [[10-audit-findings|A-01]] calls *"the
load-bearing idea of the whole system"* and it earns its own boundary.

---

## D-25 — Test harness is a prerequisite, not a finishing touch.

`pnpm test` runs `vitest run`; **vitest is in no package.json and there are zero test files
repo-wide.** Phase 0 stands it up: unit config, integration config, and a transaction-rollback DB
helper.

*Why this is not optional here:* every feature shipped so far was verifiable by looking at a page.
A graph traversal with OR-joins, durable pauses and compare-and-set transitions is not. The
[[todo|security audit]] already recorded one regression test that could not be written because there
was no harness. This feature makes that debt blocking.

---

## D-26 — Latency and scale targets

| Target | Value | Note |
|---|---|---|
| p95 event → first node executed | < 5s | in-process nudge; 5s poll is the floor |
| Max execution wall clock | 5 min | long work is a delay, not a slow node |
| Max nodes per automation | 60 | SiloCRM allows 100; 60 keeps the whole-graph PUT and the canvas honest |
| Max loop iterations | 500 | D-21 |
| Max sub-automation depth | 3 | SiloCRM allows 5 |
| Per-tenant concurrent executions | 25 | enforced from Phase 3, surfaced in the UI |
| Per-tenant daily executions | 2,000 | ditto |
| Per-tenant daily automation emails | 200 | D-14; counts toward Resend reputation |

Every number is configurable in one constants file and is enforced *and displayed*, never silently.

---

## D-27 — Launch templates (10)

The blank canvas is the biggest adoption risk ([[11-frontend-guidelines|FE-O1]]). Never open one.

1. **Speed-to-booking** — new booking → confirmation email + internal notification
2. **Job reminder** — job scheduled tomorrow → customer reminder the evening before
3. **Job completed** → thank-you email, then review request 2 days later (respects `reviewRequestEnabled`)
4. **Quote follow-up** — quote sent → wait 3 days → if still `sent`, follow-up email. Goal: accepted/declined
5. **Quote accepted** → create job in the default pipeline + notify the owner
6. **Invoice chase** — overdue 7 days → reminder, 14 days → escalate to an internal alert + task note
7. **Payment received** → thank-you + receipt confirmation
8. **Maintenance visit due** — contract visit due → create job + email the customer to schedule
9. **Warranty expiring** — asset warranty 30 days out → customer email + internal note
10. **Stale quote** — no response after 14 days → notify the owner, add a customer note

Each is seeded as a `workflow_versions` snapshot, installed **inactive**, so the tenant reviews
before it can send anything.

---

## Deliberately out of scope for v1

| Not building | Because |
|---|---|
| SMS / voice nodes | No provider is wired. `conversations` supports an `sms` channel and every send path is a stub. Ships as a whitelisted "coming soon" node ([[10-audit-findings|A-05]]) so the palette advertises the roadmap without offering something broken. |
| Code node | D-12 |
| Agency scope | D-11 |
| AI copilot | Cheap *after* the registry exists ([[07-frontend-builder|§7.6]]), worthless before it. Roadmap. |
| Real-time multiplayer editing | An `If-Match` guard on save and an honest "someone else edited this" is the correct amount of concurrency control here. |
| Marketplace / community nodes | — |
| Sub-second latency | Polling means seconds. |
