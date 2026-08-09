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

## ⏸ START HERE — session handoff, 2026-08-09

**Everything through commit 18 is committed** on `security/close-native-admin-surface` — a branch
named for unrelated work, and the first thing worth fixing. `git log --oneline` from `d3b1eb0`
forward is this feature.

**Nothing has been compiled or executed since the migrations.** That is still the single most
important fact here. Roughly 60 files across three workspaces, ~18 commits, zero `tsc` runs, zero
test runs. Every phase from P2 onward is `[~]`.

### Do these four things first, in this order

1. **`pnpm typecheck`.** Nothing else is worth doing until this passes. Five read-through review
   passes caught real defects — two of them would not have compiled — but a compiler finds what
   reading cannot. Likeliest failures, in order: the Drizzle column names in `engine/context.ts`
   and `runs/runs.service.ts`; `satisfies NodeDefinition` on the newer definitions; the
   `db.execute(sql\`…\`)` return shape in `workers/retention.ts` (`rowCount` vs `rows`).

2. **`pnpm test`.** Nine test files now, none run since P2. The three added this session are the
   ones that matter, because each encodes a bug that actually shipped:
   - `apps/api/src/test/workflow-node-wiring.test.ts` — the **trigger_types seam** (commit 18),
     plus the trigger-has-a-producer gate (commit 12). Three of its assertions would have failed
     before those commits.
   - `apps/api/src/test/workflow-templates.test.ts` — variable paths, active node types,
     `needsSetup` accuracy.

3. **Then prove one event-triggered run end to end.** This has *never* been done, and commit 18 is
   the reason it could not have worked:

   ```
   create → PUT /:id/graph (trigger.job.completed + customer.addNote) → POST /:id/publish
   → confirm trigger_types is ["job.completed"]   ← EVENT name, not "trigger.job.completed"
   → POST /:id/active → complete a real job → confirm a workflow_executions row appears
   ```

   Step 4 is the assertion that matters. If `trigger_types` contains `trigger.job.completed`,
   something reverted commit 18.

4. **Then walk P6's "done when" list** ([[wf-12-phases|§P6]]) — every criterion there is a runtime
   proof and none has been run: a pause surviving a real deploy, version pinning across a publish,
   the DST boundary in the tenant's zone, the goal/delay race.

### What this session actually changed

Six audit → fix cycles. Every finding was the same shape — **a decision that looked settled**, with
nothing on the other side of the seam:

| # | Finding | Why it was invisible |
|---|---|---|
| 🔴 **18** | `trigger_types` held **event names**; the matcher queried **node ids**. Empty overlap for every trigger — **no event-triggered automation could ever fire** | Both sides internally consistent, both `string[]`, and `POST /:id/runs` bypasses the matcher, so every by-hand test passed |
| 🔴 **17** | `email.send` hardcoded `purpose: "marketing"`, so the chase-overdue template skipped every unsubscribed customer — for money they owed | The run log said "this customer unsubscribed", which reads as correct |
| 🔴 **12** | `trigger.invoice.overdue` was in the palette with **no producer anywhere** | All four ship-gate assertions passed; none checked that a trigger's events can be raised |
| 🟠 **11** | `node_execution_logs` had a writer on every node and **no reader** outside a test | The schema was *good*, which is what made it easy to miss |
| 🟠 **16** | No retention sweep. Four tables grew forever | Its constants, its index and the `ON DELETE restrict` that makes it work had all shipped |
| 🟠 **14** | An over-quota **event-triggered** run left no trace anywhere | `refused()` returns before any execution row exists; the manual path has a user to tell |

Built on top: working-hours-aware waits, `logic.merge`, run history, five templates + gallery,
version restore, the retention sweep.

### The rule this session earned

**When a component is declared in one place and consumed in another, grep for the consumer.**
Six of six findings were a live-looking declaration with a missing or mismatched counterpart. The
mechanical sweeps that found them cost two commands each:

```
# every exported hook / action against its caller count
# every table against the files that read vs write it
# every trigger's declared events against the producers that emit them
```

None of it needed cleverness. It needed asking "who consumes this?" once per seam.

### What is genuinely done and verified

P0 (35/35), P1 (18/18 against Neon, migration idempotent ×4), P2's **pipeline** (72/72), and all
four migrations applied and verified 17/17. Everything after that is `[~]` — written, unrun.

---

## Status

| | |
|---|---|
| **Current phase** | P6 mostly written + P8 pulled forward. **Nothing compiled or run since the migrations.** Migrations all applied ✅ |
| **Started** | 2026-08-07 |
| **Branch** | `security/close-native-admin-surface` — named for unrelated work; move it |
| **Alpha gate** | after P6 |
| **Beta gate** | after P9 |
| **Last updated** | 2026-08-09 |

### Phase board

| Phase | Size | Status | Verified |
|---|---|---|---|
| P0 Foundations & test harness | M | ✅ done | **35/35** — 29 registry, 6 harness |
| P1 Data model & migration | M | ✅ done | **18/18** by execution against Neon; migration idempotent ×4 |
| P2 Event taxonomy & outbox | L | ✅ done — 28/28 producer sites wired | **72/72** on the pipeline; the instrumentation sweep is **unrun** |
| P3 Engine core | XL | 🟡 written, unrun | 3 test files written, none run |
| P4 Trigger matching & enrollment | M | 🟡 written, unrun | matrix test written |
| P5 Builder MVP | XL | 🟡 commits 1–3 of 4 written, unrun | 10 endpoints + validator + data layer + list page + canvas; 1 test file written, unrun |
| P6 Control flow, delays, goals | L | 🟡 condition.if + delay.wait + working hours + logic.merge written, unrun | goals and the remaining logic nodes not started |
| P7 Pickers, breadth, service extraction | XL | ⚪ not started | — |
| P8 Observability & replay | L | 🟡 run history read path written, unrun | replay, run-from-node, retention sweep not started |
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

### Commit 6 — CRM action nodes (written, unrun)

**11 nodes → 13.** The first two that *change* the CRM rather than telling
somebody about it — until now an automation could email, notify or write a note,
which is a notification tool rather than an automation builder. It also gives
`stageSelect` its first consumer; the picker had been built with nothing using it.

| Node | Does | Checks |
|---|---|---|
| `job.moveStage` | moves the job to a pipeline stage | resolves through `job-stages.service.ts`; transition rules apply exactly as to a person dragging the card |
| `job.assign` | puts the job in a teammate's name | `assertOrgMember` at publish **and** at execution |

Both are `sideEffect: "idempotent"` — running either twice leaves the same
state, so a resume after a crash can safely re-enter them.

Three things they deliberately do not do:

- **`job.moveStage` never writes `stage_id` and `status` on its own terms.** It
  resolves through the stage service, which is the one place that decides what a
  job may move to. Bypassing it is a mistake this repo has already paid for:
  `lib/quote-to-job.ts` set `jobs.status` by hand and never `stage_id`, so for
  four days every job created from a quote sat outside the stage model.
- **It re-reads the job's current stage from the row**, not from the execution
  context. The context was loaded when the run started, which on a resumed run
  may be days earlier — a transition check against a stale lifecycle is not a
  check.
- **Already-in-that-stage is reported, not written.** A resumed run does not
  record a move that did not happen.

Caught while writing them: `displayOptions.show` matches against *listed values*,
so `{ pipelineId: [] }` means "show when the value is one of none" — the stage
field would have been hidden forever. The picker already disables itself and says
"Pick a pipeline first", which is better than hiding it anyway.

### Commit 10 — `logic.merge`, the only AND join (written, unrun)

**16 nodes.** The traverser has carried the readiness bookkeeping since P3 —
`isReady` returns false for `logic.merge` until every incoming edge is satisfied —
and until now no node in the registry had that id, so those semantics were
**unreachable code**. This is the node, and it does nothing: being reached is the
whole of its job.

- **OR stays the default**, and that is the interesting half. The common shape is
  an if/else whose two branches both feed one "send the follow-up" step; under AND
  that step would never fire, because only one branch ever ran. So OR is right for
  the common case and this node exists for the uncommon one.
- **The failure mode is silence.** Put a merge after an Only if and it waits
  forever for the branch that did not run — no error, no failed step, the run just
  stops. New `merge_never_completes`, an **error** rather than a warning: there is
  no version of that graph which works. It tests the direct case first (two wires
  leaving one step by different outputs) and then reachability, subtracting nodes
  that more than one side can reach — a node both branches reach always runs, so it
  cannot be what hangs the merge.
- **D-05's badge was written and half-true.** The canvas already said "Runs on the
  first branch to arrive" on any node with several inputs; on a merge that is
  exactly backwards. It now reads "Waits for every branch" there, off the
  definition rather than a flag, so the canvas and the engine cannot disagree.
  Both lines stay: a label that appeared only on the unusual node would read as
  decoration and leave the common case silently misunderstood.

Housekeeping found two REPO_MAP gaps while writing this up: `packages/ui/` was
still listed a week after ARC-14 deleted it, and `packages/workflow-nodes` — a
whole package — had never been added.

### Commit 11 — run history, the first read path (written, unrun)

**Found by audit, not by the plan.** `node_execution_logs` has been written on
every node since P3 — status, resolved parameters, skip reason, duration, a
plain-language error hint, a context snapshot on failure — and **nothing outside
a test had ever read a row of it.** Same for `workflow_executions`. So an
automation could be built, published, switched on and run, and its owner had no
way to find out whether it had done anything. Six commits of engine and builder
landed on top of that before anyone noticed, which is the point worth keeping:
the schema being *good* is exactly what made it easy to miss.

This is P8's territory, taken early, because every P6 acceptance criterion is a
runtime proof and there was no way to observe a run except by querying Neon.

- `services/workflow/runs/runs.service.ts` — `listRuns` / `getRunStats` /
  `getRun`. Nothing is re-derived: a second opinion about whether a run succeeded
  is the defect INV-01/02/03 spent a day removing. `context_snapshot` is
  deliberately **not** returned; it is stored for failed nodes, it can be large,
  and a run page shipping a megabyte for a run nobody expands is a page nobody
  waits for.
- `routes/workflows/runs.ts` — a **third** sibling plugin under `/workflows`,
  same reasoning as `graph.ts`. Ownership is checked *before* querying, because a
  foreign id filtered to nothing returns "0 runs", which reads as "this has never
  run" rather than "this is not yours".
- `status` takes a **comma-separated set**, because the real question is "show me
  everything that did not go cleanly" — failed *and* cancelled. One value per
  request makes that three requests merged in the browser, which is how a page
  ends up with a total that disagrees with its own rows.
- Stats are counted in SQL over the **whole** history. A tally from the current
  page renders directly above a paginated list contradicting it (REP-02, DASH-07).
- `/automations/[id]/runs` is its **own route**, not a builder tab: a failed run
  is the thing people send a link to, and swapping the canvas for a table
  underneath unsaved work invites the exact accident the store's id-keyed load
  guard exists to prevent. Filter and open run both live in the URL.
- The list polls every 10s **only while something is running or waiting**, off the
  stats it already fetched. A durable pause that resumes in the background would
  otherwise never appear to; a permanent interval on an idle tab is a cost with
  no reader.

Two decisions the UI turns on, both about not flattening states into pass/fail:
**`waiting` is neither.** A run can sit paused for three days in perfect health,
so green claims it finished and amber claims something is wrong. It gets its own
colour and its own word. **`cancelled` is not red** — a `logic.stop` set to
"Stopped early" is the automation working, which is why the failure notification
already skips it.

The audit that found all this was mechanical: every exported hook and action
against its caller count, every table against the files touching it. It also
surfaced three hooks with **zero callers** — `useWorkflowQuota`,
`useWorkflowVersions`, `useWorkflowValidation` — the recurring shape here after
`useInvoice` and six quote hooks. Two are still unconsumed; the run work spends
neither, so they stay on the list.

### Commit 12 — the trigger that could never fire (written, unrun)

**Found by audit, again, and worse than the last one.** `trigger.invoice.overdue`
shipped into `ACTIVE_NODES` in P5 commit 5 with a definition, a payload schema,
an executor and a place in the palette — and **nothing anywhere raised
`invoice.overdue`.** A tenant could build "chase this seven days after it's due",
publish it, switch it on, and it would never fire. Silently. Forever. Its own
doc comment said "raised by the hourly sweep"; there was no sweep. The event
registry recorded `phase: "P9"` the whole time and nothing read that field.

Every one of the ship gate's four assertions passed, because they check that an
active node has a definition and an executor — not that a **trigger** node's
declared events can actually be raised. That is a hole exactly the size of this
bug, and it is now a fifth assertion.

- `services/workflow/sweeps/invoice-overdue.ts` + `workers/sweeps.ts` (hourly).
- **Daily while overdue, not once on transition.** The node filters `daysOverdue`
  with `equals` and its help text says to add one trigger per reminder — 1 day,
  then 7, then 14. Firing once, when it first goes past due, would make every one
  of those filters except `1` unreachable.
- **Exactly once per invoice per tenant-day**, via the producer `dedupKey` that
  `emit()` has always supported and nothing had used. The queue's unique index
  enforces it, so it holds across restarts, overlapping ticks and two instances —
  none of which an in-memory "done today" flag survives, and the cost of getting
  it wrong is a customer receiving two chase emails.
- **Hourly, not daily.** Tenants are in different timezones, so one daily tick
  fires at the wrong local hour for everyone but the zone it was scheduled in.
  The per-tenant-day dedup is what makes 24 ticks safe.
- **Not coupled to E-07's claim**, though reusing `last_overdue_reminder_at` was
  tempting. That column throttles *emails*; an automation firing off the back of
  it would silently stop the day somebody turned reminder emails off.
- Skips tenants with no subscribing active workflow (`trigger_types &&`, the same
  question the trigger matcher asks), so a tenant who does not use this pays
  nothing.
- Overdue is INV-06's shared definition, `partially_paid` included, compared in
  the **tenant's** timezone — on Neon the server is UTC, so a Chicago tenant would
  otherwise see an invoice go overdue six hours early, and "overdue" is a word
  customers get emailed about.

The sweep for `contract.expiring` and `equipment.warrantyExpiring` is the same
shape and is not written; neither node is active, so the gate now holds them.

### Commit 13 — five templates, and the gallery as the way in (written, unrun)

The audit found nothing this round — the failure-notification path is wired
(`notifyFailure` → `workflow_alert`), so the third instance of the silent-dead-
feature class did not exist. That changed what was worth building: the gap is no
longer capability, it is that a solo contractor opens a blank canvas with sixteen
node types and closes the tab.

Only possible now. The overdue trigger fires (commit 12), waits respect working
hours (commit 9), and run history proves it worked (commit 11) — a template
shipped before any of those would have been a demo.

- `packages/workflow-nodes/src/templates/` — a template is a **declaration**, not
  code that builds a graph, for the same reason node definitions are: the gallery
  renders it, the server instantiates it, and a test checks it would publish. A
  function returning nodes could only be run.
- **Local keys, never uuids.** Node id is what an edge stores and what a run log
  points at, so two automations from one template must not share them. Real ids
  are minted per instantiation.
- **Positions are derived** (BFS column, lane inherited from the parent plus
  `branchIndex`), so a template is a graph rather than a drawing and an author
  adding a step does not re-number coordinates. `GRAPH_LAYOUT` moved into the
  shared package and `build-node.ts` now imports it — two copies of the pitch
  would drift, and the symptom is a template that looks foreign beside a
  hand-drawn automation.
- **The endpoint takes an id, never a graph.** The browser imports the same
  catalogue and could send the nodes, which is exactly why it must not: "install
  this template" would become "write me any automation you like".
- **Off and unpublished**, like everything else. Instantiating straight to live
  would be the one place that rule stopped holding, and it would do it with
  prewritten copy the tenant has not read.
- Parameters go through `buildNodeConfig`, so a templated node carries the same
  defaults as a dragged one. Writing them straight through leaves nodes missing
  their own defaults, which surfaces much later as a required field that was
  never empty on screen.

**The test caught a design flaw before it shipped.** `needsSetup` was one field
covering two different things: a required node field left empty (assertable
against the graph) and a tenant *setting* the automation leans on
(`{{tenant.googleReviewUrl}}` — on no step, publishes fine without it, sends a
button that goes nowhere). Conflating them made the assertion unwritable. Split
into `needsSetup` and `dependsOn`, and both are now honest.

Six assertions hold the catalogue: unique ids, only active node types, only
declared variable paths, no unconnected nodes, no two steps on one spot, and an
icon the builder can render. Plus per-template: no structural validation errors,
and `needsSetup` exactly matching the real missing fields.

Templates: chase overdue invoices (3 triggers, escalating, ending in a
notification because by two weeks it stops being something to automate), ask for
a review, follow up an accepted quote (the first with a branch), new booking
heads-up (deliberately does **not** email the customer — the portal already
does, and a template whose first act duplicates a product email teaches the
tenant that automations are noise), and welcome a new customer.

### Commit 14 — review pass: three defects in my own code (written, unrun)

A read of the last five commits as a reviewer rather than an author.

**Two would not have compiled.** `RunStatusBadge` typed its lookup off
`typeof RUN_STYLES` while both maps were `as const`, so every `label` was a
literal type and `skipped` — a state only a step has — was assignable to nothing
in the run union. One declared `BadgeStyle` both maps satisfy. And
`runs.service.ts` asserted `status as ("running" | ...)[]` on a value
`runListQuery` had already validated against that exact Zod enum: a cast back
into the type it already had, which is the kind that keeps compiling long after
the enum behind it changed. Typed the parameter instead.

**One would have grown without bound.** The `invoice.overdue` sweep had no
horizon, so an invoice written off two years ago still produced a queue row every
day, forever, matching no trigger — the shipped chase template filters on 1, 7
and 14. Capped at 180 days. Also `::int` on the horizon parameter, because
Postgres has both `date - integer -> date` and `date - date -> integer` and a
bound parameter arrives untyped.

**Then a fourth, found by following the thread.** `execute()` refuses an
over-quota run *before writing anything* and returns a clear message — and the
route hands that to whoever pressed Run. But an **event-triggered** run has no
route and no person watching, and the refusal happens before any
`workflow_executions` row exists. So it appeared in no run history, no
notification and no toast: the tenant's automations would silently stop, and the
only symptom would be customers not being chased. This is the same class as the
last two audits found, one layer further in.

Event-sourced refusals now raise a `workflow_alert`, throttled to one per limit
kind per UTC day — a tenant over their daily cap refuses every event for the rest
of the day, and one notification per refusal turns one problem into a thousand.
`deliverNotification` **awaited**, not the fire-and-forget `dispatchNotification`
the failure path uses: that one is right on an error path, and wrong when the
notification is the only signal the user will get.

And the other half — `QuotaNotice` on the automations page finally spends
`useWorkflowQuota`, one of the two orphan hooks the run-history audit flagged.
Silent below 80% of either limit, because a permanent "3 of 2000" bar teaches
people to ignore the space it occupies.

**Still open from that audit:** `useWorkflowVersions` has no consumer. Version
history is read-only until there is a restore endpoint, which is P8.

### Commit 15 — version restore, and the last orphan hook (written, unrun)

`GET /:id/versions` and `useWorkflowVersions` had both existed since P5 and
neither had a consumer — the run-history audit found the hook with zero callers.
The reason was not laziness: **a list of versions with no way to use one is a
museum**. This is the endpoint that makes it worth opening, and the last of the
three orphans that audit named.

**Restore writes the draft; it does not activate.** Pointing `active_version_id`
at the old snapshot is one column and instant, and wrong twice: the draft would
still hold the broken graph, so the builder would show one thing while the engine
ran another and the next Save would quietly publish the breakage back — and it
would put a version live without anybody looking at it, which is the rule this
feature holds everywhere else. Publishing a restored graph mints a **new**
version, so "v5, restored from v2" is a true record of what was live and when.

- **Node ids are kept**, not re-minted. Edges inside the snapshot reference them,
  and `node_execution_logs.node_id` carries no FK precisely so history survives —
  a restored step keeps the run history it had the first time.
- Goes through `saveGraph`, so it takes the same row lock, concurrency token and
  size cap. A second write path skipping any of those is how "two saves both read
  the same token and both proceed" comes back, and losing an automation to a
  restore nobody expected is the worst version of it.
- An empty snapshot is refused with a reason rather than restored, because a
  blank canvas plus a Publish button that will not work looks like the restore
  deleted their work.

**The bug worth recording.** The builder loads the graph into its store *once per
workflow id* — the guard that stops a background refetch discarding what somebody
drew. That same guard swallowed the restore: the new draft landed in the database
and the canvas kept showing the graph the user was replacing. Fixed with an
`onRestored` callback fired **only on the actual write**; clearing the marker on
every sheet close — the first thing written — would have reinstated the exact bug
the guard exists to prevent, for anybody who opened the sheet, looked, and closed
it again.

### Commit 16 — the retention sweep the schema already assumed (written, unrun)

Audit angle this round: data lifecycle. **No retention sweep existed.** Four
tables grew forever — and everything it needed had shipped on day one:

- `RETENTION` in `limits.ts` since P0, with all five windows.
- `idx_node_logs_started`, carrying the comment "the retention sweep".
- `workflow_executions.workflow_version_id` as `ON DELETE restrict`, documented
  as being that way *specifically* so "the retention sweep checks for
  non-terminal runs before deleting a version, and this constraint is what makes
  that check load-bearing rather than polite".
- D-19 and wf-03 both stating the policy: 90 days for node logs, 7 for completed
  queue rows, 30 for dead letters, keep 10 versions.

Only the worker was missing, which made all of the above a to-do list wearing a
design's clothes. And commit 12's `invoice.overdue` sweep had just started adding
two queue rows per overdue invoice per day on top — roughly 15,000 rows a year
for a tenant with twenty unpaid invoices, none of which anything would ever read.

Four things it gets right that are easy to get wrong:

- **Order follows the foreign keys.** Executions before versions: a version
  cannot be deleted while a run points at it, so pruning runs is what *makes*
  versions prunable. The other order does not error — it deletes nothing, every
  time, forever.
- **Terminal runs only.** A `waiting` run older than 90 days is a three-month
  delay somebody deliberately set. Age-based deletion would cancel their
  automation as a side effect with nothing saying why.
- **`NOT EXISTS`, never `NOT IN`.** A `NOT IN` against a subquery that yields a
  NULL is never true for any row, so the statement silently deletes nothing.
- **A live version is protected separately from "the most recent N".**
  `active_version_id` is not always the highest number — restoring an old version
  and publishing it makes that one live, which commit 15 just made possible.

Raw SQL throughout, which is [[api-rules|§3]]'s documented case: bulk
`DELETE … WHERE id IN (SELECT … LIMIT n)` and a `row_number()` window. The query
builder was tried first and produced a duplicated predicate plus a derived table
stitched from `sql` fragments — harder to read than the SQL it was hiding.

Then the consequence, surfaced rather than left implicit: **run history now
disappears at 90 days.** The runs page says so, and its empty state says an
automation that ran a long time ago will look empty here too — otherwise absence
reads as "it never fired", which is the same mistake that made a 500 render as
"no data available for this period" on `/reports`.

### Commit 17 — the consent decision that was made once, for everyone (written, unrun)

Audit angle: the email consent gate, checked because templates had just made it
trivial to install a three-email sequence.

`email.send` **hardcoded `purpose: "marketing"`** for every automation email, on
the reasoning — written in the comment — that "everything an automation sends is:
the customer did not ask for it and it is not a document they are party to".
That is true of a review request and false of an overdue invoice, and
`lib/email-consent.ts` says so directly: *"an invoice you owe... none of those
needs consent, and suppressing them would be worse for the recipient than sending
them."*

Worse, that module's stated rule is that the exemption is **an argument you pass,
never an omission** — "the next person adding a send has to state which kind it
is". A node with no way to state it turned that into a single global decision,
which is the precise thing the rule was written to prevent.

The symptom was silent and expensive: `chase-overdue-invoices`, the flagship
template shipped four commits ago, skipped **every customer who had ever
unsubscribed from marketing** — for money they owed. The run log would even say
"this customer unsubscribed, so we didn't email them", which reads as correct.

- `purpose` is now a field on the node, `required`, defaulting to `marketing`,
  and only shown when the recipient is the customer.
- The option copy carries the legal distinction rather than reading as a
  bypass: "about a transaction they are party to — an invoice they owe, a quote
  they asked for, a receipt, an appointment they booked. Sent even if they have
  unsubscribed, so only choose it when that is genuinely what this is."
- The executor falls back to `marketing` on anything other than the exact string
  `"transactional"`, not `?? "marketing"` — a saved node with a junk value keeps
  the stricter behaviour rather than gaining an exemption by accident.
- The chase template and the accepted-quote confirmation are marked
  transactional; the review request and the welcome stay on the default.

Two knowledge-base entries told customers that unsubscribing stops "anything an
automation sends". Both corrected — the chatbot being confidently wrong about a
legal boundary is why [[strict-rules|§6]] exists.

Checked and clean while here: `idx_wf_queue_claim` on `(status, scheduled_at)`
already covers the retention sweep's deletes, so that added no unindexed scan.

### Commit 24 — trigger breadth, 7 → 12 (written, unrun)

The declared-with-no-consumer sweep again, pointed at the event taxonomy:

```
22 events with a producer  →  0 trigger nodes listening
```

Every one of those producer sites runs on every relevant write, and nothing
could ever subscribe. Added the five a solo contractor actually reaches for.

**`trigger.job.stage_changed`** is the one a CRM exists to have. Everything else
fires on something that happens *to* a record; this fires on the thing the
contractor does all day, which is dragging a card. It filters on **lifecycle**,
never the stage name or id — a tenant can rename "Completed", add a stage or
reorder the board, and a filter keyed to any of those breaks silently. Same
reasoning `jobs.stage_id` + `lifecycle` was introduced under (JOB-01). It also
offers the bulk opt-out the payload has been carrying `bulk` for since P2,
defaulted to *include* because the schema author framed it as an opt-out.

**`trigger.quote.sent`** is the bigger revenue unlock. `quote.accepted` was the
only quote trigger, and by definition it never fires for the quotes that need
chasing — which is most of them.

Plus `job.created`, `job.assigned` (which fires on *un*assignment too, with a
null assignee, because a job nobody is on is a job nobody is doing) and
`booking.cancelled`.

Seventh template, **Chase a quote nobody answered**: three days, and only if the
status is still exactly `sent`. Not "not accepted" — the enum is
draft/sent/accepted/declined/expired, and a lapsed quote wants a fresh price
rather than a nudge about one that is no longer on offer. `purpose: "marketing"`,
which is the honest reading: a quote they asked for is transactional, an
unprompted chase about one they ignored is a follow-up.

Four things caught by checking instead of assuming — the third time this exact
discipline has paid in this feature:

| Guessed | Actually |
|---|---|
| priority `low\|standard\|high\|emergency` | `standard\|urgent\|emergency` — two invented values, matching nothing, silently |
| `serviceTypeSelect` renders a picker | declared type, **no case in the config renderer** — draws "this kind of field isn't available yet" |
| `ctx.job.assigneeId` | `JobContext` has no id at all; it is on `ctx.assignee` |
| `ctx.job.lifecycle` | `ctx.job.stageLifecycle` |

Verified before shipping: all 12 trigger events have a producer (the gate that
caught `invoice.overdue`), all 21 executors read only declared fields, and all
20 template tokens resolve to declared variables.

### Commit 23 — review pass: a condition typo has always been silent (written, unrun)

Read commits 20 and 22 as a reviewer rather than their author. Three findings,
in ascending order of how long they had been there.

**Would not have compiled.** The `dateVariable` rule went into the validator's
*second* per-node loop — the one that has `subjectsAt` and `subjectUnknown`, which
the scope check needs — and that loop binds `def` but not `parameters`. Only the
first loop declares it.

**Wrong error class.** The one-year horizon threw `NodeFailure`, and in this
engine that emails the tenant a failure notification. The input that trips it is
ordinary data: a warranty ten years out, a service agreement booked for next
spring — the annual-maintenance case this very file advertises in its own
docblock. Now a `cancelled` stop carrying the reason into run history. The engine
already draws this line (`logic.stop`'s docblock says so): config problems are the
author's and should be loud; expected outcomes must not cry wolf, or the
notification that matters gets ignored.

**And the one that was already there.** `condition.if` rules store a bare
variable path — exactly what `dateVariable` does — and **nothing has validated
them since P6**. `ResolveVariable` returns `{found: false}` for a path that is a
typo or out of scope, and the evaluator then correctly routes an unanswerable
comparison down **No**, because a filter that cannot be answered must not match.
The consequence is that `booking.stauts` saves, publishes, runs, and takes the No
branch forever: nothing throws, nothing logs, and the run history shows a
completed run. The run-time behaviour is right, which is precisely why it can
never be where you find out.

So the rule is now one `checkVariablePath` closure serving both field types
rather than the same three checks written twice — existence with a "did you
mean", kind (dates only where a date is required), and scope under the same
"known and disjoint" caution `subject_mismatch` uses. It stays silent on an empty
path: a rule row added and not yet filled in is a normal intermediate state, and
`missing_required_field` already covers a wholly blank field.

Checked before shipping that no existing template breaks — `quote.total` in
`follow-up-accepted-quote` is a real declared path.

Two test defects too: the edge literals used `source`/`target` where the
validator's shape is `sourceNodeId`/`targetNodeId`, so the file would not have
compiled; and it walked a hardcoded node list instead of `NODE_DEFINITIONS`.

### Commit 21 — every Stop step ignored its only setting (written, unrun)

Found while wiring the No branch of the reminder template, which needed a Stop.

`logic.stop` declares one field, `outcome`. The executor read `params.stopType`
— the name the `WorkflowStopped` **signal** uses, one layer down. `params` is
`Record<string, unknown>`, so the access compiled, returned `undefined` on every
run, and the executor's own `?? "completed"` absorbed it. A Stop step explicitly
set to **Failed** therefore ended the run as completed and fired no failure
notification, and one set to "Stopped early" was indistinguishable from success.

The fallback's comment rationalises itself as a guard against a hand-edited
config, which is precisely what made this invisible: the defence looked like the
design.

Fixed in the **executor**, not the definition. The declared name is what is
persisted in `node_config.parameters`, so renaming the declaration to match the
executor would have orphaned the value in every automation already saved — the
same reasoning that kept publish's vocabulary when the trigger matcher was wrong
in commit 18.

Then swept the class: parse `name: "…"` out of all 16 definitions, `params.X`
out of all 16 executors, diff. One mismatch, and it is now a test — with comments
stripped first, or a docblock explaining this rename reads as a live access.

### Commit 22 — the reminder template could send for a cancelled booking (written, unrun)

Reviewing commit 20 as a reader rather than its author.

A Wait's resume time is fixed when the run *reaches* the step, so nothing about
a booking cancelled or rescheduled during the pause moves it. The run wakes up
anyway — and `restoreContext` re-reads the record, so the email would have gone
out saying "we are visiting tomorrow" above a date three weeks in the future,
having correctly fetched the new one.

Now an **Only if** between the wait and the send, with two rules:

- status not in `cancelled`/`completed`
- `booking.date` within the next **2** days

Two, not one, and the reason is the same flattening the wait itself does: a date
carries no time of day, so a one-day window leaves no room for the tenant's
offset from UTC. Two clears ±14 hours and still excludes anything genuinely
moved.

The No branch ends in a Stop marked "Stopped early" — honest in the run history,
and not optional: a two-output node with a dead side is `unconnected_branch_output`,
an error, and a template that cannot publish as delivered is worse than none.

### Commit 19 — a SQL comment closed its own template (fixed, and *run*)

The first time any of this code was executed. `pnpm dev` died at boot:

```
Error [TransformError]: Transform failed with 1 error:
  sweeps/invoice-overdue.ts:131:61: ERROR: Expected ")" but found "partially_paid"
```

Seven `--` comments in the sweep's SQL quoted identifiers in backticks, which is
the house style in every JSDoc block two lines above them. Inside `` sql`…` `` a
backtick is not punctuation, it is the end of the string — so the first one
closed the query and everything after it was parsed as JavaScript. The reported
position is the first word past the break and points nowhere near the cause.

The API had not started since that commit landed. Swept the class rather than
the line: a scanner walks every `` sql`…` `` in `apps/api/src` and reports any
closing before a plausible terminator. One file, seven comments, and three
false positives from inline `` `sql` `` spans in prose (fixed by requiring the
match not be preceded by a backtick or word character).

### Commit 20 — wait until a date on the record (written, unrun)

The appointment reminder is the automation every service business asks for
first, and this product could not express it.

`delay.wait` had two modes and neither reaches it. A relative wait counts from
when the *booking was made*, which is ten minutes to three months before the
appointment; a typed date is the same day for every customer. The same hole sits
under "chase before the quote expires", "warn before the warranty ends" and
"raise the maintenance job before the contract visit is due" — every one a date
already carried by a row and impossible to wait for.

**The field stores a path, not a token.** `{{booking.date}}` in a text field
would arrive at the executor already rendered as "Aug 12, 2026", and reading a
date back out of a localised display string is precisely the "guess the format
from the value's shape" mistake `interpolate.ts` refuses to make. A bare
`booking.date` has no braces, so interpolation passes it through and the raw
value is still a value on arrival. Declaring it as a `dateVariable` **type** is
what makes it checkable: existence, kind and scope are all assertable at publish,
and none of them is assertable about free text.

**Every anchor flattens to a calendar day plus a chosen hour**, including one
that arrives as a full timestamp. One rule with no branches, and it matches how
the wait is described out loud — *the morning before* — rather than landing at
03:47 because that is when the row happened to be written. An offset from a real
timestamp is what `mode: "for"` already is.

**`ifPassed` is a field rather than a rule.** A booking taken for tomorrow
afternoon makes "the day before" a moment that has already gone. Carrying on
regardless emails "we are visiting tomorrow" to somebody expecting an engineer in
two hours, so the default is to stop and the run log says which happened. The
existing `until` mode keeps its documented resume-immediately behaviour: a
calendar date a human typed genuinely does mean "after this, continue".

New validator code `unknown_variable`, because this field type has a failure the
others do not — a path can be well-formed, save cleanly, publish cleanly and
resolve to nothing at run time because the trigger above it never provided that
subject. The symptom is a wait that silently never happens, which looks exactly
like an automation nobody triggered. Three checks: the path exists (with "did you
mean"), it is a date and not a time-of-day, and this trigger provides it.

The consumer sweep found one real gap: `node-summary.ts` would have printed
`booking.date` raw on the canvas card. Unlike a member or stage id — deliberately
left unresolved there, because resolving would mean the card reaching for the
builder context — this one resolves from the same declaration the picker was
built from.

Sixth template, **Remind customers before their appointment**, which is both the
proof the path works end to end and the thing a contractor actually installs.

Found on the way: `working-hours.ts` had a private `shiftDate` that was about to
become the second copy. Now `shiftCalendarDate` in `zoned-time.ts`.

### Commit 18 — the trigger matcher could never match (written, unrun)

**The largest defect found in this feature.** `workflow_versions.trigger_types`
is filled by `collectTriggerTypes` from `def.triggerEvents` — **event names**,
`job.completed`. The matcher queried that column with
`LISTENERS_BY_EVENT.get(event.eventType)`, which yields the **node ids** that
listen for an event, `trigger.job.completed`.

The overlap of those two sets is empty for every trigger in the catalogue. So
`findCandidateVersions` returned zero rows for every event ever dispatched, and
**no event-triggered automation could fire at all** — the entire P2 event
taxonomy, all 28 producers, the outbox, P4's declarative matching, commit 12's
overdue sweep and all five templates, dead on arrival for anything but a manual
run.

Why nothing caught it:

- Both sides were internally consistent and well-commented. Neither file is
  wrong when read on its own.
- Both are `string[]`. A denormalised column carries no type across its seam.
- The parameter was named `nodeTypes`, so the call site passing node ids read as
  obviously correct.
- **`POST /:id/runs` goes straight to `execute()` and never touches the
  matcher.** Every by-hand test of the engine exercised the one path that
  bypasses the bug — which is what a "run it directly" affordance always does.

Fixed by keeping publish's vocabulary — event names, so no stored data changes —
and passing `[event.eventType]`. `LISTENERS_BY_EVENT` is still right where it
picks *which* trigger nodes inside a candidate to evaluate; it was only wrong as
the candidate query's argument. The parameter is now `eventTypes`, named for
what it holds rather than for what the caller happened to have.

Commit 12's sweep had guessed the same wrong convention
(`ARRAY['trigger.invoice.overdue']`) and would have emitted nothing, silently.

Three tests, because the type system cannot cover this seam: no trigger may
declare an event that is really a node id, the matcher's call site must pass
`[event.eventType]`, and no sweep may query `trigger_types` with a
`trigger.`-prefixed literal. All three would have failed before this commit.

### Commit 8 — `delay.wait` and the resume worker (written, unrun)

**15 nodes**, and the first durable pause. This is the node the E-12 review-request
cron exists as a workaround for: "three days after the job, ask for a review" had
no other way to be expressed.

Most of the machinery was already there from P3 and P1 — `DelayPause`,
`serialiseContext`/`restoreContext`, and the `resume_at` / `waiting_context` /
`current_node_id` columns with their partial index. What was missing was the node
itself and **anything that reads those rows back**.

- `engine/resume.ts` — claims with a compare-and-set on `status = 'waiting'`,
  loads the **pinned** version by id, rebuilds the context, and restarts at the
  paused node's **successors** so a wait does not wait again.
- `workers/resume.ts` — ticks every 60s, oldest first, sequential. Wired at the
  composition root beside the outbox worker and stopped on shutdown.
- `handleTerminal` is now **shared** rather than copied. That is correctness, not
  tidiness: a resumed run can reach a *second* `delay.wait`, and it has to pause
  exactly as a first-pass run does.

Three things the worker gets right that are easy to get wrong:

- **`resume_at IS NOT NULL`** in the due query. A goal wait is also `waiting` but
  has a null `resume_at`, and only a matching event may end one — without the
  predicate the clock would wake runs waiting on something that has not happened.
- **`clock_timestamp()`, not `now()`.** `now()` is fixed for the transaction, so
  a long tick keeps comparing against a stale clock. Same choice the outbox made.
- **An automation archived mid-wait does not wake up.** "I archived it and it
  still emailed my customer three days later" is not a defensible answer.

**Days are calendar days, not 24-hour blocks.** "Wait 3 days" means the same time
of day, three days later; `3 × 86400000` gives that only when no clock change
falls in between, so across a DST boundary a 9am follow-up arrives at 8 or 10.
Minutes and hours are the opposite — an hour is an hour — so the two are computed
differently on purpose: small units in real time, large units on the tenant's
calendar.

**Still unproven, and this is the phase where that matters.** Every P6 acceptance
criterion is a runtime proof: a pause surviving a real deploy, version pinning
across a publish, the DST boundary, the goal/delay race. None has been run.

### Commit 9 — working hours on a wait (written, unrun)

A relative wait says nothing about the hour it lands on, so "3 days after the job"
routinely comes due at 2am — and then emails a customer. `nextWorkingMoment` pushes
the resume to the next moment the business is open.

**It defers, it never drops.** The system this was ported from does the opposite:
`messagingExecutor` returns `{ success: false, status: "blocked_quiet_hours" }`, so
the customer never hears from you at all. A follow-up that silently does not happen
is worse than one that arrives an hour early. Two more things it gets wrong that
are worth recording, because they were tempting: quiet hours are **hardcoded**
9pm–8am (an emergency plumber's night *is* their working hours), and the guard is
**opt-in per node** with `respectQuietHours` defaulting to false — so out of the box
it sends at 3am.

- **No new columns and no new settings page.** The tenant's real availability — the
  same weekly schedule and date overrides the booking portal and the calendar read —
  already answers "when are we open". P6's plan said "quiet-hours columns on
  `tenants`"; that would have been a second definition of the same fact, which is
  the exact defect `availability.service.ts` was written to remove (BOOK-10,
  BOOK-21). A public holiday entered once is now honoured by bookings and follow-ups
  alike.
- **`for` mode only.** "Until 1 September at 6pm" is the author naming a moment, and
  quietly moving that to 8am the next morning overrides an explicit instruction.
  A relative duration says nothing about the hour, which is where a 2am send comes
  from — so that is the only place the setting appears.
- **Defaults to on.** The asymmetry decides it: waking at 3am to email someone
  else's customer is a worse failure than an internal ping landing at 8am, and the
  second is one visible toggle away.
- **A 14-day horizon.** A tenant with no schedule at all is not "closed forever", it
  is one who has never filled that page in — so an absent schedule resumes normally
  rather than never. Past the horizon it gives up and resumes at the original time:
  late is recoverable, never is not.
- The deferral is written to the node log as a **sentence** ("Waited until Monday,
  Aug 11 at 9:00 AM because the automation came due outside your working hours"), so
  a tenant reading "waited 3 days" against 3 days and 14 hours has the answer rather
  than a bug report.

Three things found on the way, all pre-existing:

- **`availability.service.ts` typed its `DbClient` as the bare handle**, so a
  transaction did not satisfy it and the service could not be called from inside
  one. Third recurrence — `job-stages.service.ts` (QUO-02) and `recalculateJobTotals`
  were the first two. Widened to `Omit<…, "$client">`.
- **A waiting node log recorded nothing about what it was waiting for.** The
  execution row carries `resume_at`, but the *next* wait in the same run overwrites
  it, so the replay page could never say what a given step waited for. Now on the log.
- **`node-summary` described a node by its mode switch.** `delay.wait` declares
  `mode` first and required, so the card read "for a length of time" — true, and
  nothing the title "Wait" had not already said. Which properties are switches is
  already stated in the definition (they are the ones other properties key
  `displayOptions` off), so it is derived rather than a per-node exception, and it
  falls back to the switch when nothing else describes the node. `duration` is now
  rendered too; it had produced no caption at all.

Zone arithmetic moved to `engine/zoned-time.ts` on the way in — `zonedToUtc` was
about to have a third copy.

### Commit 7 — `condition.if`, the first half of P6 (written, unrun)

**14 nodes.** The first branching node, and the first executor that returns a
`handle` other than `main`. Until now every automation was a straight line: you
could filter at the trigger, but not decide anything once running.

P6 was **split deliberately**. Its "done when" list is entirely runtime proofs —
a pause surviving a real deploy, version pinning across a pause, a DST boundary —
and none can be met without executing something. `condition.if` is the half that
does not need any of that: pure graph logic, no clock, no worker, no durability.
`delay.wait` and the resume worker wait until something has been run, because
building them blind means debugging the worker, the engine and the outbox
simultaneously when a pause fails to resume.

- Comparison goes through the **shared** evaluator and the same closed
  `FILTER_OPERATORS` set the trigger filters use. The system this was ported
  from grew a second comparison for its IF node and the two disagreed about
  blank values.
- New `resolveVariable()` on the interpolator returns the **raw** value, sharing
  `VARIABLE_MAP`, the blocked-path check and the dynamic namespaces with
  `substitute`. Interpolation renders for a human — money becomes "$1,250.00" —
  and `greaterThan 500` against that string is quietly wrong.
- **Unresolvable fails its rule**, never passes, and is reported in the output so
  the run log can name it. Same rule as the trigger matcher: the answer to an
  unanswerable question is not "yes".
- The rules field is an **array**, so an unconfigured node is genuinely blank and
  Publish refuses it. An object would satisfy `isBlank` while holding no rules,
  and a condition with nothing in it sends everything down one side.
- The condition builder is a **field renderer, not a bespoke panel**. C-3 allows
  one here; it turned out not to need one, so the rest of the node's form stays
  generated from its definition.

**F-7 built. F-6 does not apply to this design — dialog written and deleted.**
Deleting a branching step now asks first, naming the branches that will be left
disconnected, routed through the store so the config panel's button and the
canvas's Delete key share one confirmation. But the branch *selector* has no
ambiguous case here: every path already knows its handle — the `+` buttons are
one per output, `onConnectEnd` carries `fromHandle.id`, and an edge carries its
own `sourceHandle`. It was written, then found to have no caller, then removed.
The check that catches that is "grep for the caller", and it should come before
the component, not after.

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

- [~] `condition.if` *(written, unrun)* · `logic.merge` *(written, unrun)* · `logic.switch` ·
      `split.branch` · `logic.goto` · `logic.loop`
- [x] `delay.wait` — relative · until-date · working-hours safe *(written, unrun)*
- [x] `workers/resume.ts` *(written, unrun)*
- [ ] `goal.event` + `workflow_goal_listeners` + the goal subscriber
- [ ] `…_workflow_goals.sql` — **no quiet-hours columns**; the tenant's availability
      already answers "when are we open" and a second copy is the BOOK-10 defect
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
