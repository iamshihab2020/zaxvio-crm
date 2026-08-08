# WF-PROGRESS — Living Tracker

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-12-phases]] | [[wf-11-testing]] | [[todo]]

The single source of truth for **what is built, what is verified, and what is not**.

Rules for this file:
- Update it **in the same commit** as the work.
- `[x]` means done **and verified**. Work that is written but unrun is `[~]` with a note.
- Record the *evidence*: test counts, migration re-runs, what was walked by hand.
- Never claim green without output. "Tests written, not yet run" is a legitimate and useful state.

**Legend** — `[ ]` not started · `[~]` written, not verified · `[x]` done and verified · `[!]` blocked

---

## ⏸ START HERE — session handoff, 2026-08-08

**Nothing is committed.** 77 files: 47 modified, 30 untracked, all on
`security/close-native-admin-surface` — which is not a workflow branch, and the branch this work
should probably move to before any of it lands.

**Three phases of code are written and have never been compiled or executed.** P2's producer sweep,
all of P3, all of P4. That is the single most important fact about the state of this work: the
72 passing tests predate the sweep, and everything since is unverified.

**Migrations are no longer a blocker** (2026-08-08). All four workflow-era migrations are applied
and verified against Neon; the `42703` exposure on `customers` / `customer_notes` is closed. Step 1
below is done. The remaining three steps — compile, test, walk P3 — are untouched.

### Do these four things first, in this order

1. ~~**Apply the migrations.**~~ **DONE 2026-08-08 — both applied to Neon, 17/17 verified.**
   - `20260807000003_customer_email_opt_out.sql` ✅
   - `20260808000001_workflow_authorship.sql` ✅

   `20260807000002_workflow_event_queue.sql` was **already applied** — the "three unapplied"
   in [[todo]] was stale; the table was present before this session touched anything. Two, not three.

   Applied with `postgres.js` `sql.unsafe(file).simple()`, because **there is no `psql` on this
   machine and `db:migrate` skips every hand-written file** (32 of 42 are absent from
   `meta/_journal.json`). That is the procedure for this repo until the journal is re-baselined.

   Verified the way P1 and P2's were: **idempotent ×4**, NOTICE-only on re-runs
   (`42701` column exists, `42P07` relation exists, `42710` enum label exists), object set
   byte-identical after each pass. 10/10 structural checks — both opt-out columns nullable,
   `customer_notes.created_by` now NULLABLE, `created_by_workflow_id` present, both indexes
   PARTIAL, exactly **one** FK (no duplicate from re-runs), `notification_type` at **11** values
   not 14. Nothing lost: 0 columns, 0 indexes, row counts unchanged (15 customers, 6 notes).

   Then 7/7 behavioural, all rolled back: a note with `created_by = NULL` inserts (the thing
   `customer.addNote` could not do at all before); a bogus workflow id is refused `23503`;
   deleting the workflow **SET NULLs the note rather than cascading it away**; `'workflow_alert'`
   casts to `notification_type`; the opt-out pair round-trips.

2. **`pnpm typecheck`.** ~40 new files across three workspaces, none compiled. The read-through
   review below caught five real defects, but a compiler will find things reading cannot.
   Likeliest failures: Drizzle column names in `engine/context.ts` (checked by hand against nine
   tables, but not exhaustively), and the `satisfies NodeDefinition` on the five new node
   definitions.

3. **`pnpm test`.** Six new test files, none run:
   - `packages/workflow-nodes/src/__tests__/variables.test.ts`
   - `packages/workflow-nodes/src/__tests__/triggers.test.ts` ← the operator matrix
   - `apps/api/src/test/workflow-interpolate.test.ts` ← highest value; every failure it guards
     reaches a customer's inbox
   - `apps/api/src/test/workflow-node-wiring.test.ts`
   - plus P2's `workflow-producers.test.ts` and the three integration files, which passed before the
     producer sweep and have not been re-run since.

4. **Then walk P3's "done when" list** ([[wf-12-phases|§P3]]): a hand-inserted graph runs end to end;
   an opted-out customer produces a `skipped` node log with a readable reason and the run still
   completes; a tenant at quota is refused and told; an automation cannot touch another tenant's rows.

### The thing that blocks a real end-to-end test — **now partly unblocked**

`workflow_versions.trigger_types` is populated by the **publish** path, and publish was **P5**.
That path now exists (P5 commit 1, 2026-08-08): `POST /workflows` creates a record, `PUT /:id/graph`
saves a graph, `POST /:id/publish` writes the version and its `trigger_types`, and `POST /:id/active`
switches it on. So an automation can be built end to end over HTTP **without the builder UI** — which
is what makes P3 and P4 testable at last.

It is written and unrun, so treat that as a plan rather than a fact. The sequence to prove it:
create → save a two-node graph (`trigger.manual` + `customer.addNote`) → publish → confirm
`trigger_types` is `["manual.run"]` → activate → `POST /:id/runs`.

### What is genuinely done and verified

P0 (35/35), P1 (18/18 against Neon, migration idempotent ×4), and P2's **pipeline** (72/72). The
outbox transport is proven: a rolled-back write leaves no queue row, two workers split 20 rows with
zero double-processing, a failing subscriber does not retry the other. Everything after that is
`[~]`.

---

## Status

| | |
|---|---|
| **Current phase** | P4 — written. **P3 and P4 are both unrun**: no compile, no tests. Migrations all applied ✅ |
| **Started** | 2026-08-07 |
| **Branch** | `security/close-native-admin-surface` (not yet branched — see note below) |
| **Alpha gate** | after P6 |
| **Beta gate** | after P9 |
| **Last updated** | 2026-08-08 |

### Phase board

| Phase | Size | Status | Verified |
|---|---|---|---|
| P0 Foundations & test harness | M | ✅ done | **35/35** — 29 registry, 6 harness |
| P1 Data model & migration | M | ✅ done | **18/18** by execution against Neon; migration idempotent ×4 |
| P2 Event taxonomy & outbox | L | ✅ done — 28/28 producer sites wired | **72/72** on the pipeline; the instrumentation sweep is **unrun** |
| P3 Engine core | XL | 🟡 written, unrun | 3 test files written, none run |
| P4 Trigger matching & enrollment | M | 🟡 written, unrun | matrix test written |
| P5 Builder MVP | XL | 🟡 commits 1–3 of 4 written, unrun | 10 endpoints + validator + data layer + list page + canvas; 1 test file written, unrun |
| P6 Control flow, delays, goals | L | ⚪ not started | — |
| P7 Pickers, breadth, service extraction | XL | ⚪ not started | — |
| P8 Observability & replay | L | ⚪ not started | — |
| P9 Webhooks, schedules, recurring | L | ⚪ not started | — |
| P10 Hardening, templates, GA | L | ⚪ not started | — |

---

## P0 — Foundations & test harness ✅

**Objective:** nothing can be verified without a harness, and nothing can be shared between the
builder and the engine without a package. Neither existed.

### Test harness
- [x] vitest ^3.2.4 in `apps/api`, `apps/web`, `packages/workflow-nodes`
- [x] `apps/api/vitest.config.ts` — unit, fake `Date`, excludes `*.integration.test.ts`
- [x] `apps/api/vitest.integration.config.ts` — serial, single fork, 30s timeouts
- [x] `apps/api/src/test/setup.ts` — loads the root `.env` **without** importing `lib/env.ts`,
      which calls `process.exit(1)` and would kill the runner with no output
- [x] `apps/api/src/test/db.ts` — `withRollback()` + `withCleanup()`
- [x] `apps/api/src/test/factories/` — tenant (org + user + member + tenant), customer, member,
      pipeline (one stage per lifecycle), job, `createWorkspace`
- [x] **Proved: 6/6.** A row written inside `withRollback` is visible inside and gone outside;
      the body's real error survives the rollback instead of being replaced by the rollback signal;
      a throwing body still rolls back; two factory tenants cannot see each other's rows
- [x] `pnpm test` runs green across all three workspaces (`passWithNoTests` until P3/P5 land)

### `packages/workflow-nodes`
- [x] `package.json` — `"." : "./src/index.ts"`, no build step
- [x] Picked up by `packages/*` in `pnpm-workspace.yaml`; `turbo.json` already had a `test` task
- [x] `node-definition.ts` — the full contract, with the four Zaxvio additions (`filter`,
      `encoding`, `ownership`, `mutates`/`sideEffect`)
- [x] `categories.ts`, `limits.ts`, `active-nodes.ts`, `catalog.ts`, `index.ts`
- [x] `registry/` with **two real nodes** — `trigger.manual` and `logic.stop`
- [x] Registry invariant tests — **29/29 passing**
- [x] `apps/web/next.config.mjs` gained `transpilePackages: ["@hvac-saas/workflow-nodes"]`
- [x] **Proved it imports from `tsx`** (the render check below ran through the API workspace)

> **Deviation from the plan, deliberate.** The plan said "empty registry barrel". Two real nodes
> were added instead, because every registry invariant test is vacuous against an empty array — the
> id-immutability test, the barrel-completeness test and the default-seeding test would all have
> passed by having nothing to check. Both nodes are P3 MVP nodes, so nothing was built early.

### E-15 generic notification email
- [x] `packages/email/src/templates/e15-notification.tsx` — `audience: "team" | "customer"` gates
      the unsubscribe link, plus an automation attribution footer
- [x] Exported from `packages/email/src/index.ts`
- [x] `sendNotificationAlertEmail()` in `apps/api/src/lib/email.ts`
- [x] `lib/notifications.ts` imports it directly — the `"x" in email` runtime check is gone
- [x] **Proved by execution**: renders 5,302 bytes containing the title, greeting, body, CTA,
      attribution and unsubscribe; a `team` audience correctly omits the unsubscribe link
- [x] **Two further fixes found while doing it** — see F-06 and F-07 below

### Housekeeping
- [x] `docs/claude/todo.md` — In Progress entry with the three blocking findings
- [x] `REPO_MAP_1.md` — the docs folder and all 16 files
- [x] `docs/claude/lessons/features-misc.md` — the notification-email lesson, the delivery-log
      lesson, the missing-harness lesson, and the "guardrails that are really low volume" lesson

---

## P1 — Data model & migration ✅

- [x] `packages/database/src/schema/workflows.ts` — `workflow_folders`, `workflows`,
      `workflow_versions`
- [x] `packages/database/src/schema/workflow-graph.ts` — `workflow_nodes`, `workflow_edges`
- [x] `packages/database/src/schema/workflow-runs.ts` — `workflow_executions`,
      `node_execution_logs`
- [x] 4 enums in `schema/enums.ts`, relations wired, exports added
- [x] `packages/types/src/workflow.ts` — row types plus the JSON shapes (`NodeConfig`,
      `WorkflowGraph`, `GraphIssue`, `WorkflowRunDetail`)
- [x] `supabase/migrations/20260807000001_workflow_core.sql`

**Verification — 18/18 by execution against Neon**

- [x] Applied
- [x] **Re-run ×4** — columns, indexes **and constraints** byte-identical after each run
      (the check compares `pg_get_constraintdef`, not just names)
- [x] `workflows.tenant_id` FK proven — `23503`, rolled back
- [x] `workflow_versions (workflow_id, version)` unique proven — `23505`
- [x] **Version pinning proven**: deleting a version a run points at raises `23001`
      (`restrict_violation`). Worth noting — `ON DELETE RESTRICT` raises **23001**, not 23503;
      the distinction matters because RESTRICT is checked immediately and can never be deferred,
      which is exactly the guarantee version pinning needs
- [x] `idempotency_key` unique proven, **and** proven partial: many NULLs coexist
- [x] `active_dedup_key` partial unique proven — a second live run for one subject is refused,
      **and** a new run is allowed once the first completes (the negative case matters as much:
      a non-partial index would mean a subject could only ever be enrolled once)
- [x] Compare-and-set proven: `UPDATE … WHERE status = 'running'` claims once, the second
      attempt returns zero rows
- [x] `node_execution_logs.node_id` has no FK — a log survives the deletion of its node
- [x] `(execution_id, node_id, sequence)` unique proven, and a later `sequence` still accepted
      (loops and goto revisit nodes legitimately)
- [x] Graph cascades away with its workflow
- [x] `source_handle` defaults to `main` and stores a stable id
- [x] Cross-tenant: one tenant's automations are invisible to another; dedup keys cannot collide
      across tenants
- [x] The resume query returns only `waiting` runs with `resume_at <= now()` — a goal wait
      (`waiting`, `resume_at` NULL) is correctly **not** claimable

**Note on runtime.** The integration suite takes ~170s for 24 tests against Neon — round-trip
latency, not slow queries. Acceptable now; if it becomes a barrier, the fix is batching setup into
fewer statements, not weakening the assertions.

---

## P2 — Event taxonomy & outbox 🟡

**Objective:** a typed event taxonomy and a durable outbox, so a CRM write can start an automation
without the request waiting on it and without either half committing alone.

**Status: the pipeline is complete and verified end to end, and all 28 producer sites are now
wired.** The 72 tests below cover the taxonomy, the outbox and the stage-event service; the
instrumentation sweep that followed them — ten route files, six event services — has **not been
run or type-checked**, and is recorded as `[~]` until it is.

### Taxonomy — `packages/workflow-nodes/src/events/`

- [x] **36** payload schemas (not 32 — the docs' summary count disagreed with their own mindmap;
      the mindmap was the enumeration and the registry test now asserts the number)
- [x] Split by domain: `customer` 4 · `job` 8 · `booking` 5 · `quote` 5 · `invoice` 6 · `assets` 4 ·
      `messaging` 1 · `system` 3
- [x] `registry.ts` — `WORKFLOW_EVENTS` as `as const satisfies`, so `EventPayloadFor<"job.completed">`
      infers the real payload rather than a union of all 36
- [x] `shared.ts` — the JSON-safety rule made structural. **No `z.date()` anywhere**: a `Date`
      passes the producer's parse and comes back from `jsonb` as a string, so it would fail the
      worker's — write/read drift introduced by the very mechanism meant to catch it
- [x] `fixtures.ts` — fixtures **generated from** the schemas, with `.meta({ example })` on the
      regex-constrained primitives so field and sample stay one declaration. A field a generator
      cannot guess **throws, naming the path**, rather than producing an invalid fixture

### Outbox

- [x] `workflow_event_queue` + `workflow_event_status` enum, relations, exports
- [x] `supabase/migrations/20260807000002_workflow_event_queue.sql` — applied, **idempotent ×4**,
      19 columns / 7 indexes byte-identical after each run
- [x] `services/workflow/events/emit.ts` — the only producer. Parses before insert, asserts the
      subject against the registry, `onConflictDoNothing` for dedup, rethrows on failure
- [x] `services/workflow/events/bus.ts` — the in-process nudge, with its single-instance caveat
      written down rather than discovered
- [x] `services/workflow/events/worker.ts` — claim / backoff / dead-letter / stale recovery /
      drain loop, started in `server.ts` and stopped before the pool closes
- [x] `services/workflow/events/producers/` — 28 producers, every payload field written by name

### Producer sites — 28 of 28 ✅

Every P2 event now has exactly one call site, verified mechanically: each of the 28 producers is
named by exactly one file outside `producers/`. Six event services hold the mappings, and no route
assembles a payload itself.

| Service | Events | Callers |
|---|---|---|
| `services/jobs/stage-events.service.ts` | `job.stage_changed`, `job.completed`, `job.cancelled` | `PATCH /jobs/:id/status`, `POST /jobs/bulk-status-update` |
| `services/jobs/job-events.service.ts` | `job.created`, `job.updated`, `job.assigned`, `job.scheduled` | `POST /jobs`, `PATCH /jobs/:id`, `lib/quote-to-job.ts`, booking convert |
| `services/customers/customer-events.service.ts` | `customer.created`, `updated`, `tag_added`, `tag_removed` | `POST`/`PATCH /customers`, both tag verbs, portal submit, booking convert |
| `services/bookings/booking-events.service.ts` | all 5 `booking.*` | portal submit, `PATCH`, `DELETE`, `bulk-status-update`, convert |
| `services/quotes/quote-events.service.ts` | all 5 `quote.*` | `POST /quotes`, `/send`, internal + public accept/decline, the expiry sweep |
| `services/invoices/invoice-events.service.ts` | all 6 `invoice.*` | `POST /invoices`, `/from-job`, `/send`, `/void`, `PATCH /:id/status`, `bulk-status-update`, `recalculateInvoice`, `recordPayment` |

Plus two that need no service, because each has exactly one writer: `equipment.created` from
`POST /equipment`, and `message.received` from `createMessage()` in
`services/conversations.service.ts` — the one place a message row is written, so an inbound reply
cannot arrive without one.

**Four rules the sweep applied everywhere, each earned by a specific past defect:**

- **Emit inside the caller's transaction.** Ten handlers gained a `db.transaction` they did not
  have — jobs PATCH, customers PATCH, both tag verbs, bookings PATCH/DELETE/bulk, invoices
  send/void/status/bulk, quotes send/accept/decline, equipment POST, `createMessage`. A domain
  write that commits without its event is an automation permanently un-fired with nothing on
  screen to show for it.
- **One emitter per *concept*, not per route.** `emitBookingStatusEvents` serves four callers and
  `emitInvoiceStatusEvents` serves four; both filter `from === to` themselves. JOB-22 is the
  record of the alternative — the bulk path silently skipping what the single path did.
- **Emit after the money and the artefacts, not after the `INSERT`.** `quote.created` and
  `invoice.created` fire after their recalculation (a row starts at `0.00`, and a workflow gating
  on an amount would never match); `quote.sent` fires after the access token and the PDF exist
  (QUO-01); `invoice.sent` after the PDF is stored.
- **`actorUserId` is null for anything a customer did.** The public portal, the public
  accept/decline, an inbound message and the expiry sweep all record no actor rather than
  inventing one — a run's audit trail must not claim a person acted.

**Found and fixed while sweeping:**

- `recalculateJobTotals` typed its `db` as `ReturnType<typeof getDb>`, which a transaction does
  not satisfy, so it was the one statement in `PATCH /jobs/:id` that could not join the others.
  Widened to `Omit<…, "$client">` — the same defect QUO-02 found in `job-stages.service.ts`.
- Four reads matched on a record id with no tenant predicate (`quotes` send, `invoices` send /
  create / from-job, and the `conversations` bump inside `createMessage`). All now scoped
  ([[wf-10-security|security-rules §1]]).
- `DELETE /customers/:id/tags/:tagId` deleted without `.returning()`, so nothing could tell
  "removed a tag" from "that tag was not on this customer". Now returns, and only a real removal
  emits.
- The producer barrel and `shared.ts` both claimed an ESLint `no-restricted-syntax` rule enforced
  the no-spread doctrine. There is no ESLint config in this repo; it is a **test**. Comments
  corrected to say so.

**Verification — 72/72**

- [x] **28** taxonomy tests: naming, count, `.strict()` on all 36, jsonb round trip, money refusing
      a float, Postgres magic dates refused on every date field, fixture determinism, cross-check
      that every event a node's `triggerEvents` names exists
- [x] **20** producer-discipline tests: the no-spread rule, producer coverage in both directions,
      and the money / date / `changedFields` helpers
- [x] **17** outbox integration tests against Neon, including all four of this phase's stated
      criteria — see below
- [x] **7** stage-event integration tests: payload contents, not just row counts
- [x] A **rolled-back domain write leaves no queue row** — proven by committing nothing and
      re-reading on a fresh connection
- [x] **Two concurrent workers, 20 committed rows, zero double-processing** — every row claimed
      exactly once, every `attempts` still 1
- [x] **A failing subscriber does not retry the other** — the broken `goal_listener` goes to
      `pending` with a backoff while `workflow_trigger` completes, and a second tick does not
      re-run the one that succeeded
- [x] Backoff 30s → 1m → 2m → 4m → 8m, then dead letter; a dead letter is never re-claimed
- [x] An unparseable payload is dead-lettered **immediately**, not after five attempts
- [x] Stale recovery returns abandoned rows to `pending` **without** decrementing `attempts`
- [x] A completed job moving between two *completed* stages does not re-emit `job.completed`
- [x] A job id from another tenant produces no event at all

### Two things this phase changed its mind about

- **`clock_timestamp()`, not `now()`, in the claim query.** `now()` is the *transaction* start
  time, and a producer stamps `scheduled_at` from the application clock — necessarily later. Any
  claim sharing a transaction with an emit therefore compares a real timestamp against a frozen one
  and finds nothing due. Invisible for the deployed worker, whose transactions are one statement
  long; fatal for the synchronous "run this now" path P3 needs, and for every test here. Found by
  10 integration tests failing at once.
- **The no-spread rule is a test, not ESLint.** The plan called for an ESLint rule. **This repo has
  no ESLint configuration at all** — `pnpm lint` runs `eslint src --fix` against nothing — so
  adding one would mean introducing linting to the whole codebase as a side effect of a workflow
  phase. The test runs under `pnpm test`, which does exist, and fails the build for the same reason.

### Outstanding for P2

- [ ] **Run the suite and `pnpm typecheck` over the instrumentation sweep.** The 72 tests predate
      it. Nothing in the sweep has been compiled, and ten handlers changed shape (a bare sequence of
      statements became `db.transaction(async (tx) => …)`), which is exactly the kind of edit that
      type-checks or does not with no middle ground.
- [ ] **Integration tests for the new emitters**, in the shape `workflow-stage-events.integration
      .test.ts` already establishes — assert payload *contents*, not row counts. The cases worth
      writing are the ones the sweep reasoned about and cannot yet prove: a no-op PATCH emits
      nothing; re-sending an invoice emits no second `invoice.sent`; bulk-voiding fifty invoices
      emits fifty `invoice.voided`; a booking conversion emits `booking.confirmed`,
      `booking.converted` **and** `job.created` and no more; an accept racing a decline emits one
      event; adding a tag twice emits once.
- [ ] **`invoice.overdue` and the four other derived events stay unwired** — they belong to the
      schedule worker in P9, and writing their producers against a worker that does not exist is how
      a producer ends up emitting a shape nothing consumes.

---

## P3 — Engine core

### Pre-flight audit (2026-08-07)

Read [[wf-05-execution-engine]], [[wf-07-variables]], [[wf-04-node-catalog]] §4.1/§4.6/§4.7 and
[[deferred-fixes/notifications|DF-NOT-01]] against the codebase as it now stands. **Five things the
plan assumes that are not true**, and each has to be built before the node it blocks.

**A-1 · `customer_notes.created_by` is `NOT NULL` and FKs to `user.id`. A workflow has no user.**
`customer.addNote` is an MVP node and literally cannot write a row. `customer_activities.performed_by`
is already nullable, so only the notes table blocks. Fix: make `created_by` nullable **and** add
`created_by_workflow_id` (FK to `workflows`, `SET NULL`), so a note shows *who* wrote it — a person
or a named automation — rather than an unattributed blank. The engine already carries
`ctx.workflowId`/`workflowName` for exactly this. Every reader of `created_by` has to handle null.

**A-2 · `notification_type` has ten values and none of them is an automation.**
`notification.internal` calls `dispatchNotification()`, whose `type` is that enum, and
`notification_channel_config` is keyed on it — so a new value is a migration *and* a per-user channel
default. Two web files map the type to UI (`notification-item.tsx`,
`notification-settings-page-client.tsx`) and both need the new case or the bell renders a blank row.

**A-3 · `dispatchNotification()` is `void`, fire-and-forget, and opens its own `getDb()`.**
Two consequences for the engine: a node whose log says `completed` would be asserting something it
never learned, and the notification does not join the run's transaction. Needs an awaitable variant
that accepts a `db` — the same shape `sendNotificationAlertEmail()` already has, returning an
outcome rather than swallowing it. This is DF-NOT-05's lesson one layer up: a row that records
intent instead of outcome is worse than no row.

**A-4 · `lib/phone.ts` exists only in `apps/web`.** The engine renders `{{customer.phone}}` with
`format: "phone"` **in the API**, which has no copy. [[wf-07-variables|§7.6]] asserts it uses "the
single implementation that replaced four divergent copies" — that implementation is unreachable from
where it is needed. Copying it would recreate the exact defect it was written to end. It belongs in
`packages/workflow-nodes`, which both sides already import, alongside the other declared formatters.

**A-5 · Nothing renders a timezone abbreviation.** [[wf-05-execution-engine|§5.5]] and
[[wf-07-variables|§7.3 rule 2]] both require `3:30 PM CDT` — "a reminder that says 3:30 PM and one
that says 3:30 PM CDT are different products". `lib/timezone.ts` has `formatDateInTimezone` and
`formatDateOnly`; neither emits `timeZoneName`, and there is no datetime formatter at all. New work,
in the package, because the variable picker shows the same samples in the browser.

### Scope notes — recorded so they are not mistaken for omissions

- **The two event triggers have no matcher behind them in P3.** `trigger.job.completed` and
  `trigger.invoice.paid` declare `filter` properties, and the declarative evaluator that reads them
  is **P4**. In P3 the only way to start a run is `POST /workflows/:id/runs`. That is what the phase
  plan says; it is worth saying out loud, because a trigger node that exists and does not fire looks
  like a bug.
- **`registerGoalListeners()` is step 8 of `execute()` and is a no-op in P3.** There is no
  `workflow_goal_listeners` table — goals are P6. The step stays in the order of operations so the
  shape does not change later.
- **`EVENT_SUBSCRIBERS` already enqueues a `goal_listener` row per event.** Nothing consumes it
  until P6; the worker completes a no-subscriber row rather than dead-lettering it (proven in P2), so
  this is wasted rows, not breakage. Keeping the column is what makes per-subscriber retry possible
  at all, and removing it later would be a migration — so it stays.
- **`workflow_executions` has no `depth` column.** The recursion guard is a call parameter and
  sub-automations are P7. `parent_execution_id` is documented for replay forks, which is a
  *different* relationship from sub-automation parentage — do not overload it when P7 arrives.
- **`OWNERSHIP_KINDS` says `member`; [[wf-04-node-catalog|wf-04 §4.1]] says `user`.** Code is right
  (the FK is to a member of the org). Doc drift, harmless, noted.

### Confirmed ready — no work needed

`workflow_executions` carries every column the engine needs (`waiting_context`, `resume_at`,
`current_node_id`, `context_truncated`, both partial unique indexes) · `workflow_versions.graph` +
the `WorkflowGraph`/`GraphNode`/`GraphEdge` types · `EXECUTION_LIMITS`, `TENANT_QUOTAS`,
`RESUME_SETTINGS`, `RETENTION` all in `limits.ts` · the full `NodeDefinition` contract including
`mutates`/`sideEffect`/`ownership`/`encoding`/`noInterpolate` · `analyticsCache.invalidateTenant()` ·
`workflows.timezone_mode`/`timezone` · E-15 plus `sendNotificationAlertEmail()` returning a
three-state `EmailOutcome`, so the email node can log what actually happened ·
**`BETTER_AUTH_SECRET`** (validated at ≥32 chars) is available for the unsubscribe HMAC, so
DF-NOT-01 needs no new environment variable.

### Build order

1. [x] **The opt-out gate** — DF-NOT-01, all six points. Before the engine, not after: an engine
   that can send is the thing that makes its absence indefensible. Written 2026-08-07, **unrun**.
   - `20260807000003_customer_email_opt_out.sql` (idempotent; **not yet applied**),
     `customers.email_opt_out_at` + `email_opt_out_source`, partial index on the opted-out rows
   - `lib/email-consent.ts` — `canEmailCustomer()` returns a **decision** (`allowed`, a readable
     `reason`, the address), because the reason is what `node_execution_logs.skip_reason` needs and
     a bare boolean makes every caller invent one. `purpose: "marketing" | "transactional"` is
     required, so the exemption is a statement rather than an omission
   - Token derived by HMAC-SHA256 over `unsubscribe:<tenantId>:<customerId>` under the existing
     `BETTER_AUTH_SECRET` — **no new env var**, nothing stored, and the tenant in the signature means
     a token cannot be replayed across a boundary
   - `routes/public/unsubscribe.ts` — `GET` reads, `POST` acts, `POST /one-click` is RFC 8058.
     **A `GET` that unsubscribes would unsubscribe every link scanner**, so the split is the design
   - `List-Unsubscribe` + `List-Unsubscribe-Post` on `sendEmail`, the footer link on the **shared
     `EmailLayout`** (E-15 had rolled its own — the start of fifteen divergent copies)
   - Both crons swept. E-09 deliberately does **not** stamp `renewalReminderSentAt` when it skips
   - Surfaced: badge on the customer detail header, `Unsubscribed` tab on `/customers` behind
     `?optedOut=` using `booleanFlag`, never `z.coerce.boolean()` (CUST-29)
   - **Found while building:** RFC 8058 clients post `application/x-www-form-urlencoded` and this
     server registers no form-body parser, so one-click would have answered every mail provider
     `415`. Parser registered inside the plugin, encapsulated to these routes.
2. [x] **A-1 … A-5** — all five prerequisites, 2026-08-07/08, **unrun**.
   - **A-1** `20260808000001_workflow_authorship.sql` — `customer_notes.created_by` dropped to
     nullable, plus `created_by_workflow_id` (FK to `workflows`, `SET NULL`, partial index). Making
     it nullable alone would have been half a fix: a note with no author reads as data loss, so the
     read joins `workflows` and the UI says *"Quote follow-up (automation)"*. `SET NULL` because
     deleting an automation must not delete what it wrote.
   - **A-2** `workflow_alert` added to `notification_type`, **one value rather than one per node** —
     `notification_channel_config` is keyed on the enum, so a value per node kind means a row per
     node kind per user and a preferences page nobody can read. Default is in-app on, **email off**:
     an automation can fire a hundred times a day and the point of one is to save attention.
     Both web maps updated (`notification-item`, settings), plus the two that were already missing
     `message_received`.
   - **A-3** `deliverNotification(db, params)` — awaitable, takes the caller's transaction, returns
     a `NotificationResult` with a readable reason. `dispatchNotification` keeps its fire-and-forget
     signature so none of its ~20 callers changed. A node log that says `completed` now asserts
     something the node actually learned.
   - **A-4/A-5** `packages/workflow-nodes/src/format/` — `formatPhoneDisplay` **moved** here and is
     re-exported by `apps/web/src/lib/phone.ts`, so there is still exactly one implementation and no
     component import changed. Plus `formatDateTime` and `formatTimeOnly`, which are the first
     things in this codebase to render a **timezone abbreviation** (`3:30 PM CDT`), and
     `zoneAbbreviation` resolves it *on a given date* — the same stored `09:00:00` is CDT in August
     and CST in January.
3. [x] **Variables** — `packages/workflow-nodes/src/variables/`, one `VariableDef[]` of ~90 entries
   across ten static namespaces, plus `VARIABLE_MAP`, `variablesForSubject()` (picker scoping) and
   `suggestVariables()` (edit distance, same-namespace preferred). `execution-context.ts` holds the
   `ExecutionContext` shape **in the package**, because the browser picker renders sample values
   against the same type the engine builds — if those diverged, the sample would stop being a
   promise about what the email will say.
4. [~] **Engine** — all six modules written, plus `ownership.ts`, `quotas.ts` and `executors/`.
   **Unrun.**
   - `interpolate.ts` resolves through a **closed map**, so prototype-chain access is unreachable by
     construction and the `env`/`__proto__` deny-list is defence in depth rather than the mechanism.
     Four dynamic namespaces walk *their own* object with own-property checks only.
   - `context.ts` — the customer is resolved for **every** subject type; nothing is a `Date`,
     because the whole context round-trips through `jsonb` on a delay; `refreshAfterNode` reads back
     what a node declared it `mutates` **and invalidates the analytics cache**, which is the easiest
     thing here to forget and the hardest to notice (an engine write has no request, so the server's
     `onResponse` cache hook never fires for it).
   - Two things deliberately left null with the reason in the code: `job.marginPercent`
     (`services/costing` owns the one definition and needs reads this query does not do — a second,
     cheaper answer that disagreed with the Costs tab is worse than none) and `contract.nextVisitDue`
     (no column; it is derived, and P9's `contract.visit_due` will derive it once).
   - `node-executor.ts` — disabled check → at-most-once re-entry guard → **one** interpolation pass
     → ownership re-check → `running` log row → dispatch. The re-entry guard fails **loudly**: a
     crash mid-send leaves a `running` row, and the honest answer is "we do not know whether the
     customer got that email", so sending again to be safe is the wrong kind of safe. A
     `resolvedParams` redactor is in place before any node has a secret field, because the first one
     that does (P9's webhook auth header) must not be the moment somebody remembers.
   - `traverser.ts` — OR joins by default, AND only into `logic.merge`. The readiness bookkeeping
     that makes AND possible is here from the start, so P6's merge/goto/loop is a node rather than a
     rewrite. Edges route on `source_handle` as a **stable id**, never a label.
   - `execute.ts` — quota → depth → version → insert → context → traverse → one terminal branch per
     error class. **Every transition out of `running` is a compare-and-set**, so a delay pause and a
     concurrent goal exit cannot both believe they own the row. `23505` on either unique index is
     *not* an error: it means "already enrolled". A failure notification fires for crashes, timeouts
     and error stops and **never for `cancelled`** — a cancel is expected, and notifying on one
     teaches people to ignore the notification.
   - `ownership.ts` — the execution-time re-check. An unknown ownership kind returns **false**, so a
     new kind fails closed until someone writes its checker.
   - `quotas.ts` — concurrent (25) and rolling-24h (2,000). `waiting` runs count toward concurrency:
     a run parked on a three-day delay holds no worker but does hold its subject's dedup key, and
     excluding them would let a tenant accumulate thousands and meet the limit all at once.
     `GET /workflows/quota` surfaces usage **before** anything is refused.
5. [~] **Seven nodes.** Definitions in `packages/workflow-nodes/src/registry/`, executors in
   `services/workflow/engine/executors/`, both listed in `ACTIVE_NODES`. `email.send` is the one the
   opt-out gate was built for: recipient is a **role, never an address** (a free-text address field
   on an automation is an open relay with a nice UI), and a refused send is **`skipped`, not
   failed** — an unsubscribed customer is the automation working correctly, and failing would stop
   the run and fire a notification.
6. [~] **`POST /workflows/:id/runs`** + `GET /workflows/quota`, registered in `server.ts`.
   `refused` → 400 with a sentence the tenant can act on; `duplicate` → 409. Unresolved-variable
   diagnostics come back **in the response**, not only in a server log the tenant cannot read.

### Read-through review (2026-08-08)

No compiler was run, so the code was reviewed by reading it against the schema
and against the tests it has to satisfy. **Five real defects found and fixed**,
every one of which would have been a failure on first run:

- **`communication.email` and `communication.internal` were not in
  `SUBCATEGORIES`.** `subcategory` is typed `string`, so nothing would have
  complained at compile time — but the registry test asserts every declared
  subcategory is known, and both new communication nodes would have failed it.
  Added, split by *who reads it* rather than by transport: one goes through
  `canEmailCustomer()` and one does not, which is not a distinction to bury
  under a shared "Messaging" heading.
- **`ExecutionSource` did not match `workflow_execution_source`.** It said
  `sub_workflow` where the column says `sub`, and omitted `replay` entirely — a
  `22P02` at run time on one side and an unrecordable source on the other. The
  type now mirrors the enum exactly, with a comment saying why it must.
- **`email.send.memberId` was required with no default, placeholder or
  description**, which the registry test rejects as "a form that opens broken
  with no hint what belongs in it". Writing the description surfaced a second
  thing: it claimed the step is *skipped* when a teammate leaves, and the engine
  actually **fails** the node with "open the step and pick a different one".
  The engine's behaviour is the right one — a silent skip is an alert nobody
  receives — so the description was corrected to match, and the executor's
  now-unreachable branch documented.
- **Four `as never` / `as unknown as` assertions**, three of them mine and one
  left over from P2. ARC-10 got this repo to zero and [[strict-rules]] §4 bans
  them because a cast compiles whether or not the value is really a member.
  Each was a type that should have been narrower: `ExecuteParams.subject.type`
  is `SubjectType`, `variablesForSubject` takes `SubjectType`, `{{loop.*}}`
  reads a written-out object rather than a cast interface, and `emit.ts` needed
  no cast at all — `jsonb` with no `$type<>()` infers `unknown`.
- **The node-wiring test would have killed the runner.** Importing
  `executors/index.js` reaches `email-send.ts` → `lib/email.ts` → `lib/env.ts`,
  which calls `process.exit(1)` on a missing variable — no output, no stack, on
  any machine without a full `.env`. That is the exact failure `src/test/setup.ts`
  exists to avoid. The test parses the barrel's source instead, which is the
  same technique the registry test already uses on its own barrel and is exactly
  as strong: the map is a literal, so a key not in the text is not in the map.

Column names in `context.ts` were checked one by one against the schema —
`jobs`, `invoices`, `quotes`, `bookings`, `equipment`, `maintenance_contracts`,
`tenants`, `pipelines`, `job_pipeline_stages`. Two were wrong and were fixed
while writing it (`contract.frequency`, and `nextVisitDue` which has no column
at all). `workflow_subject_type` matches `SUBJECT_TYPES` value for value and in
the same order, which is what makes the un-cast assignment safe.

### Remaining for P3

- [ ] **Run it.** Nothing in P3 has been compiled or executed. The phase's own "done when" list is
      the checklist: a hand-inserted graph runs end to end and an email arrives; an opted-out
      customer produces a `skipped` node log with a readable reason and the run still completes; a
      tenant at quota is refused and told; an automation cannot touch another tenant's rows.
- [ ] **Apply three migrations** — `20260807000003` (opt-out), `20260808000001` (authorship), and
      whatever `db:generate` produces for them if the journal is being used. Until they run, reads
      of `customers` and writes to `customer_notes` fail `42703`, because Drizzle names every schema
      column in its queries.
- [~] **Engine unit tests — written, unrun.** Three files, no database needed:
      - `packages/workflow-nodes/src/__tests__/variables.test.ts` — no duplicate paths, the map is
        derived from the array so neither can drift, every resolver survives a fully-populated
        context, a missing namespace yields **null rather than `""`** (they mean different things),
        and the picker does not offer `invoice.*` on a booking automation.
      - `apps/api/src/test/workflow-interpolate.test.ts` — the highest-value file in the phase,
        because every failure it guards reaches an inbox. Asserts that a ten-digit value **not**
        declared as a phone is left alone (A-09), that a `date` column renders without the
        UTC-midnight day shift (QUO-10), that a time carries `CDT`, that `{{vars.toString}}` resolves
        to nothing while `{{vars.real}}` resolves, that `{{tenantId}}` is simply unknown, and that a
        `<script>` in a last name is escaped before it reaches a React Email template.
      - `apps/api/src/test/workflow-node-wiring.test.ts` — the `ACTIVE_NODES` ↔ definition ↔
        executor link in **both** directions, that every `*Select` property declares an `ownership`
        kind, and that `email.send` has no free-text recipient field (D-14).
- [ ] The builder is **P5** — there is no UI for any of this yet. `POST /workflows/:id/runs` against
      a hand-inserted graph is the whole surface.

---

- [ ] `engine/execute.ts` · `traverser.ts` · `node-executor.ts` · `context.ts` ·
      `interpolate.ts` · `errors.ts`
- [ ] `variables/` — the `VariableDef[]` table
- [ ] 7 nodes: `trigger.manual`, `trigger.job.completed`, `trigger.invoice.paid`, `email.send`,
      `notification.internal`, `customer.addNote`, `logic.stop`
- [ ] `lib/communication-guards.ts` + `…_workflow_comms_guard.sql`
- [ ] Unsubscribe link + attribution footer in the email layout
- [ ] Per-tenant quotas
- [ ] `POST /workflows/:id/runs`
- [ ] Analytics-cache invalidation on `mutates`

**Verification**
- [ ] A hand-inserted graph runs end to end; an email arrives
- [ ] Engine unit suite green (record the count)
- [ ] An opted-out customer → `skipped` with a readable reason; the run completes
- [ ] A tenant at quota is refused and told
- [ ] Cross-tenant: an automation cannot touch another tenant's rows

---

## P4 — Trigger matching & enrollment 🟡

**Written 2026-08-08, unrun.** This is the phase that makes P3 do anything on its own — before it,
the only way to start a run was `POST /workflows/:id/runs` by hand.

- [~] `packages/workflow-nodes/src/triggers/operators.ts` — all **22** operators, one closed set
      shared by trigger matching, `condition.if` and goal filters. Two decisions carry the file:
      - **`isUnset` is load-bearing.** The builder persists every property, so an unconfigured
        filter is *present-but-empty*, not absent. `0` and `false` are values; `null`, `""`, `[]`
        and the dropdown's `"__any__"` sentinel are not. Getting this wrong makes every automation
        fire on everything or on nothing, invisibly, because the editor shows what the user
        configured either way.
      - **An unanswerable comparison returns `false`, never `true`.** A `greaterThan` against a
        non-number is not a match. The opposite default would make a malformed filter fire on
        everything, which is the loudest possible way to be wrong.
      - Equality is loose across the string/number boundary on purpose: Postgres returns `numeric`
        as `"1250.00"` and a form sends `1250`, and strict equality would make "total equals 1250"
        never match with no way for the user to see why. Booleans stay strict.
- [~] `triggers/match.ts` — one evaluator over `definition.properties`, plus `describeMatch()`,
      which is the sentence the run history and "why didn't my automation run?" both use. Phrasing
      it once is the difference between one diagnostic and three.
- [~] `services/workflow/triggers/enroll.ts` — the two keys, and the refresh branch **calls the
      loader** (`loadExecutionContext`) rather than hand-rebuilding the shape. B-12 is the record of
      the alternative: ~180 lines re-assembling objects to match the loader's format, guaranteed to
      drift and invisible when it does. Node outputs, vars and loop state are kept untouched on a
      refresh — they are what already happened, and rewriting them would make a replay lie.
- [~] `services/workflow/triggers/index.ts` — event → candidate versions → trigger nodes → filters →
      enrol → `execute()`. Candidates come from `workflow_versions.trigger_types && ARRAY[...]`
      joined on `workflows.active_version_id`, so a run starts on the version the tenant
      **published**, not on whatever was saved last.
- [~] Worker wiring, in `server.ts` at the composition root — registered, not imported, so
      `worker.ts` still has no dependency on the engine and the transport stays testable alone.
- [~] `packages/workflow-nodes/src/__tests__/triggers.test.ts` — the operator × value-shape matrix
      P4's "done when" asks for, plus the evaluator. All four stated criteria are covered:
      `0`/`false` are values while `null`/`""`/`[]` are unset; a filter matches on **`lifecycle`,
      not the stage label**; a missing payload field does not match; and `describeMatch` names the
      label a user recognises rather than the property name.

**Deliberately not built:**

- **Trigger evaluation records.** The plan lists a table for them. `describeMatch()` produces the
  sentence and `handleTriggerEvent` returns one outcome per candidate, so the *content* exists —
  but a row per (event × workflow × trigger node) on every dispatched event is the
  fastest-growing table in the system, and it is written for a diagnostics page that lands in **P8**.
  Building the table now means choosing its retention before anything reads it. The return value is
  the seam; P8 persists it.
- **Business outcomes never throw.** No filter matched, the subject was deleted, this automation is
  already running for that record — all returns. Throwing sends the queue row back for five
  attempts and a dead letter, and a dead-letter table full of "this automation correctly did not
  run" is worse than no dead-letter table.

### Remaining for P4

- [ ] Run the matrix test, and the integration cases that need a database: a second event for a
      waiting subject **refreshes** rather than duplicating; the same queue row delivered twice
      produces **one** run; an inactive or archived workflow is not a candidate.
- [ ] `workflow_versions.trigger_types` is populated by the **publish** path, which is P5. Until
      then the candidate query matches nothing, so P4 is unexercisable end to end without inserting
      a version by hand — the same constraint P3 has.

**Verification**
- [ ] Operator × value-shape matrix green
- [ ] `0` and `false` are values; `null`/`""`/`[]` are unset
- [ ] A second event for a waiting subject refreshes, does not duplicate
- [ ] The same queue row twice → one run
- [ ] A stage filter matches on `lifecycle`, not the label

---

## P5 — Builder MVP 🟡

**Commit 1 of 4 — the API backbone — is written and unrun (2026-08-08).**
[[wf-12-phases|§P5]] says to split this phase; the order chosen puts the server
first, because the builder has nothing to save into until it exists and because
this is the commit that unblocks everything else: **`trigger_types` is written by
the publish path**, so until publish existed no automation could be reachable by
the trigger matcher at all.

### Written

- [x] `packages/workflow-nodes/src/graph/validate.ts` — the shared structural
      validator, 17 issue codes in one closed union. Pure: no DB, no I/O, no
      `@hvac-saas/types` (which would pull Drizzle into the browser bundle). The
      graph types are structural, so the API passes its real rows in unchanged.
      §8.7 requires the builder and the API to apply *the same* rules; a
      client-only check is a suggestion and a server-only one is a dialog the
      user cannot act on.
- [x] `services/workflow/graph/validate.ts` — the half that cannot be pure: the
      tenant-ownership pass, deduped by `(kind, id)` so a 60-node graph with a
      picker on every node is 3 queries rather than 60.
- [x] `services/workflow/graph/load.ts` · `persist.ts` · `publish.ts`
- [x] `routes/workflows/graph.ts` — 4 endpoints, a **sibling plugin** under the
      existing prefix (the `routes/jobs/costing.ts` precedent, so this does not
      become the next 2,497-line file)
- [x] `routes/workflows/index.ts` — 6 CRUD endpoints
- [x] Schemas for all 10; `packages/workflow-nodes/src/__tests__/graph-validate.test.ts`

### Three decisions worth not re-litigating

- **`isDirty` compares behaviour, not layout.** Node positions are excluded, so
  tidying the canvas does not light "N unpublished changes". A banner that is
  almost always on is one nobody reads, and this one has to still mean something
  on the day it says "your edits are not live".
- **Publish locks the workflow row.** `version` is derived from the current
  maximum and `(workflow_id, version)` is unique, so concurrent publishes would
  otherwise race to the same number and surface as a `23505` nobody can read.
- **`is_active` is not a PATCH field.** It carries a rule no other field does —
  an automation with nothing published cannot be switched on, because
  `is_active` with a null `active_version_id` is a workflow the matcher finds
  and then has no graph to run.

### Found while writing it

- 🐛 **`getMissingRequiredFields` ignored `displayOptions`.** `isPropertyVisible`
  is documented as being shared with the validator "so a hidden required field
  never blocks a publish" — and was never called. Choosing "Plain text" hides
  the HTML body, so Publish would have been blocked forever on a field appearing
  nowhere on screen. Fixed in `node-definition.ts`; three tests cover it.
- 🐛 **`assertOwnership` fails closed, which is wrong at publish time.** Correct
  for the engine — an id it cannot verify must not be used. But 8 of the 11
  ownership kinds have no checker yet, so the publish validator would have
  reported "you do not own this customer" on every automation with a customer
  picker: untrue, and unfixable from inside the product. New
  `CHECKABLE_OWNERSHIP_KINDS` lets the validator skip what it cannot judge while
  the engine keeps refusing it.
- 🐛 **`GraphIssue` was declared in two packages.** Structurally identical, so it
  type-checked; `code` was a closed union in one and a bare `string` in the
  other, which is exactly how the two drift. `@hvac-saas/workflow-nodes` is now
  canonical and `@hvac-saas/types` carries a pointer. Zero consumers existed, so
  nothing broke.

### Commit 2 — the data layer and the list page (written, unrun)

Chosen ahead of the canvas because it needs **no new dependencies**: the three
`main` builds that died in a row all traced back to a lockfile changed without
being regenerated, so the commit that adds `@xyflow/react` and `zustand` should
be the one that does nothing else.

- [x] `actions/workflows.ts` — 12 actions on `api-fetch` from line 1
- [x] `hooks/queries/use-workflows.ts` + barrel + `queryKeys.workflows`
- [x] `app/(dashboard)/automations/` — list, `loading.tsx`, and a **placeholder
      detail route** so create → redirect does not land on a 404
- [x] `components/dashboard/automations/` — table, name dialog, validation dialog
- [x] Sidebar: a new **Automate** group
- [x] Draft / Live / Off is a first-class column, with shape as well as colour

Three things worth keeping:

- **`WorkflowListItem` is the wire shape, not `Workflow`.** The Drizzle row types
  every timestamp as a `Date`, and nothing that crosses a server action is a
  `Date` — the boundary is JSON. Typing the actions with the row type would
  type-check every page against a shape it never receives and force a cast at
  each date helper. Declaring it once at the boundary removed all of them.
- **Save has no success toast.** A builder saves constantly; a toast per save
  trains the user to ignore toasts, including the 409 that says their work was
  not written.
- **Publish returns three states, not `{data, error}`.** A refused publish is the
  product working. `api-fetch` nulls `data` on a non-2xx — right for its other
  200-odd call sites, wrong for the one endpoint whose 422 body *is* the payload
  — so the validation is re-read from `GET /:id/validate` rather than widening
  the shared seam for a single caller.

### Commit 3 — canvas and store (written, unrun)

- [x] `@xyflow/react` 12.11.2 + `zustand` 5.0.14 installed; lockfile regenerated
- [x] `lib/workflow/store.ts` · `build-node.ts` · `icon-map.ts`
- [x] `components/dashboard/automations/builder/` — canvas · node · edge · palette · toolbar
- [x] The placeholder detail route is now the real builder
- [x] Insert-on-edge (H-2) · `+` on unconnected outputs (H-1) · relink-on-delete (X-1) ·
      undo/redo incl. parameter changes (X-2) · branch labels (H-3) · join badge (N-8)
- [x] `onSelectNode` wired — clicking a publish error selects its node (S-4)

Five decisions that are not obvious from the code:

- **React Flow is a view over the store, with one exception.** Position *during a
  drag* is owned locally and written to the store on drag **stop**. Committing
  every frame puts a history entry on the stack per pixel, and "undo covers node
  changes" then means the animation rather than the move.
- **Parameter edits coalesce** on `(nodeId, field)` within 600 ms. Without it,
  typing a subject line makes Ctrl+Z a character-by-character eraser — the rule
  is technically satisfied and uselessly so.
- **`deleteKeyCode={null}`.** React Flow's own delete would remove a node without
  X-1's relink and silently sever the automation. The canvas handles Delete
  itself so the removal and the relink are one store action — which then means it
  also has to handle *edge* deletion, or connections become undeletable.
- **The store loads keyed on the workflow id, not on the payload.** A background
  refetch returning an identical graph would otherwise reset the canvas and
  discard whatever the user had drawn. It is the most damaging thing a builder
  can do and it happens silently.
- **`nodeTypes` / `edgeTypes` are module-scope constants.** A fresh object literal
  per render makes React Flow tear down and rebuild every node.

**The visual direction is deliberate — do not "fix" it back toward the default.**
The first pass of this canvas was the n8n / Zapier / Make look: a rounded card
with a colour-tinted icon tile top-left, grey bezier wires, React Flow's stock
chrome. That is the templated answer for this category, and it arrives whether
or not it suits the product. What replaced it, derived from the fact that an
automation here is a **dispatch rule** for a contractor:

| Default | This build | Why |
|---|---|---|
| Tinted icon tile | 3px category **spine** on the left edge | Same information, a fraction of the chroma; twenty nodes no longer read as a bag of sweets. It is the stripe on a job ticket |
| Bezier wires | Right-angled `smoothstep` | A routing diagram, not an org chart. Beziers turn any branching graph into spaghetti past four steps |
| Branch label on the handle | Branch label **on the wire**, in mono | "Not found" belongs to the connection, not the step it leaves — and on the handle it collides with the node's own text at any zoom |
| Icon on the node | Icon only in the palette | At 12px muted beside its own name it added nothing, and at zoom-out it is as unreadable as the text. The spine carries identity |
| React Flow chrome | Controls/MiniMap on repo tokens | The stock white-on-grey reads as a third-party widget dropped onto the page |
| Badge / dot / badge | One marker system: ● live · ○ off · ◌ draft · – archived | Shape, not colour alone (N-9). It was three different shapes for the most important column on the page |

Mono is used for identifiers and route markers only (`v3`, branch names, `off`) —
this repo's documented use for that face. **Not** as tracked uppercase eyebrows:
the landing-page work retired those as the loudest generic signal it had, and
reintroducing them here would undo that.

Found while writing it: React Flow's `OnNodeDrag` takes a DOM
`MouseEvent | TouchEvent`, not a React synthetic event; the repo's CSS tokens are
raw HSL triplets, so an SVG `stroke: var(--brand)` is not a colour and falls back
to black; and the node needs `position: relative` or its `+` buttons resolve
against React Flow's wrapper instead.

### Commit 4 — the config panel (written, unrun)

- [x] `GET /workflows/:id/builder-context` — members, pipelines and stages in
      **one** request. Selecting a node would otherwise fire a server action per
      picker, sequentially, every time. Scoped to `:id` so it 404s for an
      automation this tenant does not own, rather than being readable by probing.
- [x] `config/field-wrapper.tsx` — label, required marker, description, hint.
      One wrapper is what keeps a field type at ~30 lines rather than ~80.
- [x] `config/fields.tsx` — all 11 P5 types plus the four CRM pickers the
      shipped definitions already reference (`moneyInput`, `memberSelect`,
      `pipelineSelect`, `stageSelect`). Without those four, three of the seven
      nodes could not be configured at all.
- [x] `config/config-renderer.tsx` — the switch that turns a definition into a
      form, honouring `displayOptions`. An unknown field type renders a named
      placeholder rather than nothing: a silently absent field is one the user
      publishes without ever being asked for.
- [x] `config/config-panel.tsx` — a drawer beside the canvas, inline rename,
      switch-off, delete, `howItWorks`, and a missing-fields banner.

Decisions worth keeping:

- **No debounce layer.** [[wf-08-builder-frontend|C-5]] asks for one; it is
  redundant here. Writes land in a Zustand store in the same tab, and the reason
  to debounce — one undo entry per keystroke — is already handled by the store
  coalescing on `(nodeId, field)`. A second timer would only open a window where
  the control and the node's ⚠ badge disagree.
- **An empty multi-select means "no filter", not "match nothing"**, and the
  field says so out loud. The opposite reading is the dangerous one.
- **A number field writes `undefined`, never `0`, when cleared.** Otherwise "no
  minimum" and "minimum zero" are the same stored value.
- **Radix `Select` speaks only strings**, so option values are mapped back
  through the declared options — writing `"true"` where the engine expects
  `true` is a filter that silently never matches.

### Motion

One vocabulary in `globals.css`, following the existing `--enter-delay` stagger
pattern rather than a second one: `node-enter` (a step being placed),
`edge-draw` (a connection being made), `panel-item-enter` / `-right` (palette
rows and config fields, travelling along the axis their panel opened from), and
`placeholder-breathe` on the empty canvas.

Three rules it holds to: motion explains a **change** and never decorates a
resting state; nothing animates while it is being dragged or panned; and every
one of them is switched off under `prefers-reduced-motion` — a canvas that
scales and slides is exactly the kind of motion that triggers vestibular
symptoms.

### Commit 5 — step preview and node breadth (written, unrun)

**"Test this step" resolves; it does not run.** The obvious reading of the button
is "execute it", and that is the wrong thing to build first: half the catalogue
is `at-most-once`, so testing `email.send` by running it puts a real message in a
customer's inbox — and a test button that mails customers is one people learn not
to press, which makes it worse than no button.

What actually goes wrong with a step is almost never the executor. It is a
mistyped `{{customer.frstName}}`, a variable this trigger cannot provide, or a
subject that comes out blank — all visible by resolving the parameters, with no
side effects. `POST /:id/nodes/:nodeId/preview` returns the resolved values plus
the interpolator's existing diagnostics, and the panel renders the bad paths with
their "did you mean" suggestions. Actually running a step belongs with the run
viewer in P8, where there is somewhere to show what it did.

Two details: it previews the **draft**, because the point is to check what you
are editing; and it reuses `resolveTimezone` from the engine (exported for this)
rather than growing a second copy, so a preview cannot format a date differently
from the run it is previewing.

**Four new triggers** — 7 nodes → 11. Cheap, because the event taxonomy already
carries all 30 payloads and their schemas: a trigger is a definition, a no-op
executor and three registry lines.

| Node | Fires on | Filters |
|---|---|---|
| `trigger.invoice.overdue` | the hourly sweep | `daysOverdue`, min total |
| `trigger.quote.accepted` | the portal accept claim | min total |
| `trigger.booking.created` | a request arriving | source (portal / desk / API) |
| `trigger.customer.created` | a customer appearing | source (booking / manual / quote / import / API) |

`invoice.overdue` is the one that unlocks a real sequence: three copies at 1, 7
and 14 days each with their own message, rather than one automation branching on
a date it has to compute itself.

**Caught while writing them:** the `customer.created` source filter was written
against guessed enum values (`booking_portal`) when the payload declares
`booking`. A filter whose options do not match the payload's enum matches
**nothing, silently** — exactly the failure the declarative design exists to
prevent, reintroduced by not reading the schema. Every filter path is now
verified against its payload.

### F-5 done; F-6 and F-7 deliberately deferred

- [x] **F-5 drag-to-empty-space.** Releasing a wire over nothing opens the
      palette already wired to the handle it came from and drops the chosen step
      at the pointer. Without it the gesture is silent failure — the wire
      vanishes and nothing says why. Guards on `toNode` as well as `isValid`,
      because "invalid" also covers releasing over a node that refused the
      connection, and that must not conjure a second node on top of it.
- [~] **F-6 branch selector / F-7 branch-delete prompt — not built, on purpose.**
      **Every node in the registry has exactly one output** (`main`); `logic.stop`
      has none. The branching nodes — `condition.if`, `split.branch`,
      `logic.switch` — are all P6. Both affordances only exist to disambiguate
      *which branch* the user meant, so there is currently nothing that could
      trigger either one: building them now is untestable dead code that would
      be reviewed against an imagined API rather than a real one. They belong in
      the same commit as the first multi-output node.

### Still to write
- [ ] Multi-select, copy/paste, right-click menu, auto-layout (X-3, X-5, X-7)
- [ ] The template gallery in place of a blank canvas (O-1, O-2)
- [ ] Variables: pills, trigger-scoped picker, unknown flagged inline

**Verification**
- [ ] [[wf-08-builder-frontend|§8.13]] walked
- [ ] A concurrent edit 409s with Reload
- [ ] Publish blocked on an invalid graph; every error selects its node
- [ ] A new node definition needs zero frontend code
- [ ] 390px no horizontal scroll · light and dark both correct

---

## P6 — Control flow, delays, goals  ← alpha gate

- [ ] `condition.if` + bespoke panel · `logic.switch` · `split.branch` · `logic.merge` ·
      `logic.goto` · `logic.loop`
- [ ] `delay.wait` + bespoke panel — relative · until-date · next business hour · quiet-hours safe
- [ ] `workers/resume.ts`
- [ ] `goal.event` + `workflow_goal_listeners` + the goal subscriber
- [ ] `…_workflow_goals.sql` + quiet-hours columns
- [ ] Join badges · goto-after-split warning · delay-in-loop rejection

**Verification**
- [ ] **A pause survives a real deploy** (`resume_at` +2 min, redeploy, confirm)
- [ ] Version pinning: publish v2 mid-pause; the run resumes on v1
- [ ] Compare-and-set: goal exit vs delay pause race — exactly one wins
- [ ] Delay maths correct across a DST boundary in the tenant's zone

---

## P7 — Pickers, breadth, service extraction

- [ ] 13 CRM picker field types
- [ ] **`services/jobs/` extracted** — routes become validate → service → respond
- [ ] **`services/customers/` extracted**
- [ ] Node breadth to ~45
- [ ] Remaining triggers
- [ ] `workflow_folders` + UI
- [ ] Variable picker: pills, trigger-scoped, inline unknown flagging

**Verification**
- [ ] Every executor test proves no direct table write (throwing `db` proxy)
- [ ] `routes/jobs/index.ts` materially smaller; behaviour unchanged
- [ ] Every picker draws only from `builder-context`

---

## P8 — Observability & replay

- [ ] `routes/workflows/runs.ts` (11) + `testing.ts` (3)
- [ ] Runs list — per automation and org-wide
- [ ] Replay page — the same canvas, read-only
- [ ] Context inspector · run-from-node · test-a-node · dry run
- [ ] Live test visuals over SSE channel `"workflows"`
- [ ] Enrollment view · trigger evaluation view
- [ ] Failure notifications · `error_hint` everywhere
- [ ] `workers/retention.ts`
- [ ] `/admin/workflows/health`

**Verification**
- [ ] A failed run's replay explains the failure in a contractor's words
- [ ] `replay-from` forks and links to its parent
- [ ] Dry run describes every send instead of sending
- [ ] Retention deletes, in bounded batches

---

## P9 — Webhooks, schedules, recurring  ← beta gate

- [ ] `routes/webhooks/workflow.ts` + `workflow_webhooks` + settings UI
- [ ] `trigger.webhook` + `trigger.webhook.raw` + field mapping
- [ ] `workers/schedule.ts` + `workflow_schedule_state`
- [ ] `invoice.overdue` at a day count, via the shared `overdueCondition()`
- [ ] `contract.visit_due` · `contract.expiring` · `equipment.warranty_expiring` ·
      `job.margin_below`
- [ ] `quotes.first_viewed_at`

**Verification**
- [ ] A wrong secret is rejected in constant time
- [ ] Unknown workflow / inactive / wrong path are indistinguishable
- [ ] `bodyLimitFor()` matches the advertised cap, proven by an oversized request
- [ ] "Once only" survives a restart, proven by killing the process between ticks

---

## P10 — Hardening, templates, GA

- [ ] The 10 templates as seeded snapshots, installed inactive
- [ ] Template gallery replaces the blank canvas
- [ ] `http.request` + `webhook.send` behind a complete `UrlValidator` — **or not shipped**
- [ ] [[wf-10-security|§10.10]] checklist, every box
- [ ] `/security-review` on the branch
- [ ] Housekeeping: REPO_MAP 1+2, API docs (26 endpoints), chatbot KB, todo, lessons
- [ ] An ADR in [[decisions]]
- [ ] `pnpm seed:demo --with-automations`

---

## Decisions changed after the plan was written

*(Nothing yet. Any deviation from [[wf-00-decisions]] is recorded here with its reason, and the
decision doc is updated. A plan that quietly drifts is worse than no plan.)*

| Date | Decision | Was | Now | Why |
|---|---|---|---|---|

---

## Findings during the build

*(Bugs found in existing code while building this. The three from
[[wf-01-gap-analysis|§8]] are listed as the starting set.)*

| # | Finding | Severity | Status |
|---|---|---|---|
| F-01 | `sendNotificationAlertEmail` is called in `lib/notifications.ts:293` and exported from nowhere — every notification email logs instead of sending, while `notification_deliveries` records `sent` | 🔴 | ✅ fixed P0 ([[deferred-fixes/notifications\|DF-NOT-03]]) |
| F-02 | No customer email opt-out anywhere in the product | 🔴 | **open** — P3. Fix shape written up as [[deferred-fixes/notifications\|DF-NOT-01]] |
| F-03 | `pnpm test` runs vitest; vitest is uninstalled and there are zero test files | 🔴 | ✅ fixed P0 |
| F-04 | `jobs` has no service layer — creation, update and status logic live in a 2,514-line route handler ([[architecture\|ARC-05]]) | 🟡 | P7 |
| F-05 | `routes/webhooks/` and `plugins/` are empty directories | 🟢 | P9 |
| F-06 | **`20260806000001_job_costing.sql` had never been applied to Neon.** Drizzle names every schema column in an `INSERT`, so *every* insert into `tenants`, `jobs`, `job_line_items` and `catalog_items` was failing with `42703 column "default_labor_cost_rate" does not exist` — onboarding, job creation, line items and the catalog, all broken against the live database. Found within minutes of the harness existing, which is the argument for the harness. | 🔴 | ✅ applied P0, **idempotent verified ×4**, column and index sets byte-identical after each run |
| F-07 | **`sendEmail()` reported success for a refused send.** Resend returns a rejection in the response *body* (`result.error`) rather than by throwing, so an unverified sending domain — the current state of this account — came back as a 403 payload that the bare `try/catch` read as a send. Every caller believed it had sent. `sendEmail` now returns `{ status: "sent" \| "skipped" \| "failed" }` and inspects `result.error`; existing callers ignore the return, so nothing broke. | 🔴 | ✅ fixed P0 |
| F-08 | `notification_deliveries` rows were written `status: 'sent'` for every recipient regardless of outcome — including throughout the period F-01 meant nothing was sent at all. Now records what happened, and does not record a row at all when email is simply unconfigured. | 🟠 | ✅ fixed P0 |
