# Todo

> Related: [[workflow]] | [[planner]] | [[lessons]] | [[decisions]] | [[deferred-fixes/README|Deferred Fixes]]

Task tracking for the Zaxvio CRM project.

---

## In Progress

### Workflow Automation — P0–P4 written, P2–P4 UNVERIFIED (paused 2026-08-08)

> **▶ Resuming? Read the `⏸ START HERE` block at the top of [[wf-PROGRESS]] first.** It has the
> four things to do in order; **step 1 is now done**. The short version: **nothing is committed**
> (77 files on `security/close-native-admin-surface`), **all four migrations are applied and
> verified** (2026-08-08 — the `42703` exposure on `customers` / `customer_notes` is closed), and
> **three phases of code have never been compiled or executed**. Next up: `pnpm typecheck`, then
> `pnpm test`, then walk P3's "done when" list. Do not build P5 on top of that without deciding
> deliberately to.

An n8n-style automation builder native to Zaxvio's data model. Full plan in
[[workflow-automation/README|docs/workflow-automation/]] — 16 documents: decisions, gap analysis,
architecture, data model, node catalog, engine, triggers, variables, builder, API, security,
testing, an 11-phase plan and a living progress tracker ([[wf-PROGRESS]]).

Ported from [[workflow-automation-port/README|the SiloCRM audit]], but the code transfers not at
all: different ORM, timestamps, tenancy model, infrastructure and domain. Seven corrected designs
(typed events, declarative filters, one variable declaration, versioning, interpolate-once, stable
handles, per-subscriber outbox) each close a documented defect in the source system.

**Blocking findings from the audit** (all in [[wf-01-gap-analysis|§8]]; write-ups now live in
[[deferred-fixes/notifications|deferred-fixes/notifications.md]]):
- [x] 🔴 `lib/notifications.ts:293` called `sendNotificationAlertEmail`, exported from nowhere. Every
      notification type except `booking_received` fell through to `console.log` while
      `notification_deliveries` recorded `status: 'sent'`. **Fixed in P0** — E-15 template written,
      direct destructured import, delivery rows now record the real outcome (DF-NOT-03, DF-NOT-05).
- [x] 🔴 `sendEmail()` reported success for refused sends — Resend returns rejections in
      `result.error`, it does not throw, so the 403 from this account's unverified domain read as a
      send. **Fixed in P0**, three-state `EmailOutcome` (DF-NOT-04). Found while fixing the above.
- [x] 🔴 **No customer email opt-out exists anywhere.** **Fixed in P3 step 1** — all six points of
      [[deferred-fixes/notifications|DF-NOT-01]]. `email_opt_out_at` + `email_opt_out_source`
      (migration written, **not applied**), a token derived by HMAC under the existing
      `BETTER_AUTH_SECRET` so no new env var, `GET`/`POST`/`one-click` public routes, one
      `canEmailCustomer()` gate returning a *decision* with a readable reason, `purpose` as a
      required argument so the transactional exemption cannot be an omission, `List-Unsubscribe`
      + `-Post` headers, the footer link on the **shared layout** rather than per template, and
      both crons swept. Surfaced as a badge on the customer header and an Unsubscribed tab on
      `/customers`.
- [ ] 🟠 **No email has ever been delivered** — zero verified Resend domains, so all 15 templates
      and both crons are unexercised, E-15 included ([[deferred-fixes/notifications|DF-NOT-02]]).
      Not a code defect; the reason it stayed invisible was, and that is fixed.
- [x] 🔴 `pnpm test` ran `vitest run` with vitest in no package.json and 0 test files.
      **Fixed in P0** — vitest in 3 workspaces, unit + integration configs, 53 tests passing.

- [x] **P0** Foundations: vitest harness, `packages/workflow-nodes`, E-15 email — 35/35 tests
- [x] **P1** Schema + idempotent migration (7 tables, 4 enums, versioning from day one) — 18/18
- [~] **P2** Typed event taxonomy + transactional outbox + **all 28 producer sites** — **72/72 on
      the pipeline, verified against Neon**; the instrumentation sweep that followed is written and
      **unrun**. 36 payload schemas, `workflow_event_queue` (migration applied, idempotent ×4),
      emit/bus/worker, 28 producers, worker in `server.ts`.
      All four phase criteria proven by execution: rolled-back write leaves no row; two workers
      split 20 rows with zero double-processing; a failing subscriber does not retry the other;
      every producer output parses.
      Instrumentation: six event services (jobs ×2, customers, bookings, quotes, invoices) plus two
      single-writer sites (equipment, `createMessage`). Ten handlers gained a transaction they did
      not have — an event that commits apart from its domain write is an automation permanently
      un-fired. Found on the way: `recalculateJobTotals` typed its `db` as the bare handle, so it
      could not be called inside a transaction (the QUO-02 defect again); four reads matched a
      record id with no tenant predicate; the tag-delete could not tell a real removal from a
      no-op. Full table in [[wf-PROGRESS]].
- [~] **P3** Engine core + 7 nodes + opt-out gate + quotas — **written end to end, entirely unrun.**
      DF-NOT-01 closed (gate, derived HMAC token, 3 public routes, headers, both crons swept, UI).
      Five prerequisites the plan had not spotted, all fixed: nullable `customer_notes.created_by`
      + `created_by_workflow_id`; a `workflow_alert` notification type; an awaitable
      `deliverNotification()` that takes the caller's transaction; and `formatPhoneDisplay` moved
      into `packages/workflow-nodes` with the first timezone-abbreviation formatters this repo has
      had. Then ~90 declared variables, six engine modules plus ownership/quotas/executors, seven
      nodes, and `POST /workflows/:id/runs`.
      **Nothing compiled, nothing executed.** Migrations are no longer a blocker — see below.
- [x] **Migrations applied** (2026-08-08). `20260807000003_customer_email_opt_out.sql` and
      `20260808000001_workflow_authorship.sql` applied to Neon; `20260807000002_workflow_event_queue`
      turned out to be **already applied**, so it was two files, not the three recorded here.
      The `42703` exposure is closed: reads of `customers` and writes to `customer_notes` work.
      **Verified 17/17** — idempotent ×4 with the object set byte-identical after each pass and
      NOTICE-only re-runs; 10/10 structural (both indexes PARTIAL, exactly one FK, `notification_type`
      at 11 values not 14, 0 columns and 0 indexes lost, row counts unchanged); 7/7 behavioural and
      rolled back (a note with `created_by = NULL` inserts — which `customer.addNote` could not do
      at all before; a bogus workflow id is refused `23503`; deleting the workflow **SET NULLs the
      note instead of cascading it away**).
      No `psql` on this machine and `db:migrate` skips hand-written files, so these were applied via
      `postgres.js` `sql.unsafe(file).simple()`. See [[backend-stack]].
- [~] **P4** Declarative trigger matching + enrollment dedup — **written, unrun.** 22 operators in
      one closed set; `isUnset` is the load-bearing function (the builder persists every property,
      so an unconfigured filter is present-but-empty, and `0`/`false` are values); an unanswerable
      comparison returns **false**, never true. The enrolment refresh branch **calls the loader**
      rather than rebuilding the context shape by hand — B-12 is ~180 lines of the alternative.
      Worker wired at the composition root, so `worker.ts` still knows nothing about the engine.
      Trigger evaluation *records* deliberately deferred to P8, which is where the page that reads
      them lands; the return value is the seam.
- [~] **P5** Builder MVP — **commit 1 of 4 (the API backbone) written, unrun.** Server first,
      because the builder has nothing to save into until it exists and because this is the commit
      that unblocks the rest: `trigger_types` is written by the **publish** path, so until now no
      automation could be reachable by the trigger matcher at all. An automation can now be built
      end to end over HTTP with no UI — create → save graph → publish → activate → run.
      One shared validator (`packages/workflow-nodes/src/graph/validate.ts`, pure — no DB, no
      Drizzle, so the browser can import it) with 17 issue codes, plus the one rule that cannot be
      pure (tenant ownership) in `services/workflow/graph/`. 10 endpoints across two sibling
      plugins, so `routes/workflows/index.ts` does not become the next 2,497-line file.
      Three defects found on the way: `getMissingRequiredFields` ignored `displayOptions`, so a
      hidden required field would have blocked Publish forever on a control appearing nowhere on
      screen; `assertOwnership` fails closed, which is right for the engine and wrong for the
      validator, where 8 of 11 kinds have no checker and would have reported "you do not own this
      customer" on every automation with a customer picker; and `GraphIssue` was declared in two
      packages with `code` typed as a closed union in one and a bare `string` in the other.
      **Commit 2 (data layer + list page) also written, unrun.** Taken before the canvas because it
      needs **no new dependencies** — the three consecutive `main` build failures all traced to a
      lockfile changed without being regenerated, so the commit that adds `@xyflow/react` and
      `zustand` should do nothing else. 12 actions on `api-fetch`, `use-workflows.ts`, query keys,
      the `/automations` list (with an `isError` branch, so a new page does not join the 17 that
      lack one), a `loading.tsx` from the start, an **Automate** sidebar group, and a placeholder
      detail route so create → redirect does not 404.
      The find worth keeping: **`Workflow` is the wrong type for anything crossing a server
      action.** Drizzle types every timestamp as a `Date`; the boundary is JSON, so they arrive as
      strings. New `WorkflowListItem` declares the wire shape once and removed a cast from every
      consumer — including an `as unknown as` that would have broken strict-rules §4.
      **Commit 3 (canvas + store) also written, unrun.** `@xyflow/react` 12.11.2 and `zustand`
      5.0.14 installed, lockfile regenerated. `lib/workflow/{store,build-node,icon-map}.ts` plus
      `components/dashboard/automations/builder/` — canvas, node, edge, palette sheet, toolbar. The
      detail route is now the real builder. Insert-on-edge, `+` on unconnected outputs,
      relink-on-delete, undo/redo including parameter changes, branch labels, join badge, and
      publish errors that select their node.
      React Flow is a **view over the store**, with one exception: drag position is local and
      committed on drag *stop*, because a history entry per frame makes Ctrl+Z undo the animation
      rather than the move. `deleteKeyCode` is off so deletion goes through the store and gets its
      relink — which then means the canvas must handle edge deletion too, or connections become
      undeletable. The store loads keyed on **workflow id, not payload**: a background refetch
      would otherwise reset the canvas and silently discard the user's work.
      **Commit 4 (config panel) also written, unrun.** `GET /:id/builder-context` (members,
      pipelines, stages in one request), a field wrapper, all 11 P5 field types plus the four CRM
      pickers the shipped definitions already reference, the definition→form renderer honouring
      `displayOptions`, and the panel itself. **The loop now closes**: a step can be configured, so
      publish stops refusing. Plus a motion pass — one vocabulary in `globals.css`, all of it off
      under `prefers-reduced-motion`.
      Rebuilt the canvas against SiloCRM's node components after a screenshot showed it was wrong:
      **flow is now left→right**, a trigger is a 92px rounded-left square and an action a wide card,
      and the tinted icon tile came back. Two real bugs it exposed: every node printed its name
      twice (`label` defaults to `displayName`), and picking twice from the palette produced
      **disconnected nodes** — the open panel cleared `pendingSource`, so only the first pick wired
      up. Picks now chain off the previous step.
      **Commit 5 (step preview + node breadth) also written, unrun.** "Test this step" **resolves
      the settings, it does not run them** — half the catalogue is `at-most-once`, so a test that
      executed `email.send` would mail a real customer, and what actually goes wrong with a step is
      its config. `POST /:id/nodes/:nodeId/preview` returns resolved values plus the interpolator's
      diagnostics with "did you mean" suggestions. Plus `GET /:id/builder-context` (members,
      pipelines, stages in one request), a variable picker on every text field (trigger-scoped, via
      the same `subjectsProvidedBy` the validator uses), and a resizable config panel whose width
      persists.
      **7 nodes → 11**: `trigger.invoice.overdue`, `trigger.quote.accepted`,
      `trigger.booking.created`, `trigger.customer.created`. Cheap because the event taxonomy
      already carries all 30 payloads. Caught mid-build: the `customer.created` source filter was
      written against a **guessed** enum (`booking_portal` vs the schema's `booking`) — a filter
      whose options miss the payload's enum matches nothing, silently, which is the exact failure
      the declarative design exists to prevent.
      **F-5 done. F-6/F-7 deliberately not built**: every node has one output, so the branch
      selector and branch-delete prompt have nothing to disambiguate until P6's `condition.if`.
      Remaining: multi-select, the template gallery, variable pills, run viewer.
- [~] **P6** Control flow, durable delays, goals — **written, unrun.** `condition.if`, then
      `delay.wait` + `engine/resume.ts` + a 60s resume worker: a pause is a database row, so a
      three-day wait outlives every process that could hold a timer. A run resumes on the version
      it **started** on, claimed by compare-and-set, restarting at the paused node's *successors*
      so a wait does not wait again.
      Then working hours, which is where the port's design was a **cautionary example** rather
      than an inspiration: its quiet-hours guard *blocks* the send (`blocked_quiet_hours`), so the
      customer never hears from you — and it is hardcoded 9pm–8am and opt-in per node, so out of
      the box it sends at 3am. This **defers** instead, and reuses the tenant's existing
      availability rather than the planned `tenants.quiet_hours_*` columns: a second definition of
      "when are we open" is exactly the BOOK-10 defect. Days are calendar days (9am stays 9am
      across a DST change); hours are real hours.
      Found on the way: `availability.service.ts` typed its `DbClient` as the bare handle, so it
      could not be called inside a transaction — third recurrence, after `job-stages.service.ts`
      and `recalculateJobTotals`; a waiting node log recorded nothing about what it was waiting
      for (the execution row's `resume_at` is overwritten by the next wait in the same run); and
      the builder described every wait as "for a length of time", its mode switch.
      Then `logic.merge` — the **only** AND join, and until it existed the traverser's
      readiness bookkeeping was unreachable code. OR stays the default, because an if/else whose
      branches converge would never fire under AND. Its failure mode is silence: a merge after an
      Only if waits forever for the branch that did not run, so `merge_never_completes` is an
      error, not a warning.
      Then the `invoice.overdue` **sweep** — a second audit finding, worse than the first:
      `trigger.invoice.overdue` had shipped *active* in P5 with a definition, payload schema,
      executor and palette entry, and **nothing anywhere raised the event**. Build the automation,
      publish it, switch it on, and it never fires — silently, forever. All four ship-gate
      assertions passed, because none of them checks that a *trigger* node's declared events have
      a producer; that is now a fifth. Hourly sweep, once per invoice per **tenant** day via the
      `dedupKey` `emit()` has always supported and nothing had used. Fires daily while overdue
      rather than once on transition, because the node filters `daysOverdue` with `equals` and a
      1/7/14-day chase needs the count each day. Deliberately not coupled to E-07's reminder
      throttle — that column throttles email, so automations would die with it.
      Remaining: `logic.switch`, `split.branch`, `logic.goto`, `logic.loop`,
      `goal.event` + `workflow_goal_listeners`. **Every P6 acceptance criterion is a runtime
      proof** — a pause surviving a deploy, version pinning across a publish, the DST boundary,
      the goal/delay race — and none has been run. **Internal alpha gate.**
- [ ] **P7** CRM pickers, node breadth, and `services/jobs/` extraction ([[architecture|ARC-05]])
- [~] **P8** Observability, replay, run-from-node — **run history written, unrun.** Pulled forward
      out of order because an audit found the thing the plan had not: `node_execution_logs` had a
      writer on every node since P3 and **no reader anywhere outside a test**, and neither did
      `workflow_executions`. An automation could be built, published, switched on and run with no
      way for its owner to know it had done anything — and six commits landed on that before
      anyone looked. Two endpoints, a service, a route at `/automations/[id]/runs` with the filter
      and the open run in the URL, and a step timeline that leads on `error_hint`/`skip_reason`
      rather than `error_message`, because the reader is the person who has to fix it.
      `waiting` and `cancelled` each get their own treatment — a three-day pause is not a failure
      and "stop chasing this paid invoice" is the automation working.
      The audit was mechanical (hooks vs caller counts, tables vs touching files) and also found
      three hooks with **0 callers**: `useWorkflowQuota`, `useWorkflowVersions`,
      `useWorkflowValidation`. Two remain unconsumed.
      Remaining: replay, run-from-node, and a global activity view.
- [~] **Retention sweep** (2026-08-09) — **written, unrun.** Audit angle: data lifecycle. There was
      none, and four tables grew forever. Everything it needed had shipped on day one — `RETENTION`
      in `limits.ts`, `idx_node_logs_started` commented "the retention sweep", and the
      `ON DELETE restrict` documented as existing *so that* the sweep's version check would be
      enforced. Only the worker was missing, which made all of that a to-do list in a design's
      clothes; and the `invoice.overdue` sweep had just started adding ~15k queue rows a year for
      a tenant with twenty unpaid invoices. Order follows the FKs (executions before versions, or
      it deletes nothing forever); terminal runs only (a `waiting` run at 90 days is a delay
      somebody set); `NOT EXISTS` not `NOT IN`; the live version protected separately from "most
      recent N", which commit 15's restore made necessary. The runs page now states the 90-day
      window, so absence does not read as "it never fired".
- [~] **Email purpose on `email.send`** (2026-08-09) — **written, unrun.** Audit angle: the consent
      gate, checked because templates had just made a three-email sequence one click. `email.send`
      **hardcoded `purpose: "marketing"`** for every automation email — true of a review request,
      false of an overdue invoice, and `email-consent.ts` says so itself. That module's rule is
      that the exemption is *an argument you pass, never an omission*; a node with no way to pass
      it made it one global decision, which is what the rule exists to prevent. The symptom was
      silent: `chase-overdue-invoices` skipped **every customer who had ever unsubscribed** — for
      money they owed — and the run log said "this customer unsubscribed", which reads as correct.
      Now a required field defaulting to `marketing`, shown only for customer sends, with copy
      carrying the legal distinction rather than reading as a bypass. Executor falls back to
      `marketing` on anything but the exact string, so a junk value cannot gain an exemption.
      Two chatbot entries claimed unsubscribing stops "anything an automation sends" — corrected.
- [~] **Templates** (P10, pulled forward) — **5 shipped, written and unrun.** The audit found
      nothing this round (the failure-notification path is wired), so the gap stopped being
      capability and started being that a solo contractor opens a blank canvas with 16 node types
      and closes the tab. **New automation** now opens a gallery; blank canvas is one click
      further. Only possible now: overdue fires, waits respect working hours, run history proves
      it worked. Templates are declarations with local keys (never uuids) and derived positions;
      `GRAPH_LAYOUT` moved to the shared package so the builder and templates cannot drift. The
      endpoint takes an **id, never a graph** — the browser has the same catalogue, which is
      precisely why it must not send nodes. Created off and unpublished like everything else.
      The test caught a design flaw pre-ship: `needsSetup` conflated "a required field is empty"
      (assertable) with "a tenant setting is unset" (not) — now `needsSetup` + `dependsOn`.
- [~] **Review pass** (2026-08-09) — read the last five commits as a reviewer rather than an
      author. **Two would not have compiled**: `RunStatusBadge` typed its lookup off
      `typeof RUN_STYLES` while both maps were `as const`, so `skipped` matched no literal in the
      run union; `runs.service.ts` cast a Zod-validated value back into the type it already had.
      **One grew without bound**: the overdue sweep had no horizon, so an invoice written off two
      years ago raised an event every day forever, matching no trigger — capped at 180 days, plus
      `::int` on the parameter because `date - integer` and `date - date` are both real operators.
      **And a fourth found by following the thread**: `execute()` refuses an over-quota run before
      writing anything, and the route surfaces that to whoever pressed Run — but an event-triggered
      run has no route and no watcher, and the refusal precedes any execution row. It appeared in
      no run history, no notification, no toast. Same class as the last two audits, one layer in.
      Now raises a `workflow_alert` throttled per limit-kind per day, and `QuotaNotice` spends
      `useWorkflowQuota` (silent below 80%).
- [~] **Version restore** (2026-08-09) — **written, unrun.** The last of the three orphan hooks.
      `GET /:id/versions` and `useWorkflowVersions` had existed since P5 with no consumer, because
      a list of versions with no way to use one is a museum. Restore writes the **draft**, never
      `active_version_id`: pointing that at the old snapshot would leave the builder showing one
      graph while the engine ran another, so the next Save would publish the breakage back — and
      it would put a version live with nobody looking at it. Node ids are kept, so a restored step
      keeps its run history. Goes through `saveGraph` for the same lock, token and size cap.
      Found while wiring it: the builder's load-once-per-id guard — which stops a background
      refetch discarding the user's work — **also swallowed the restore**. Fixed with a callback
      fired only on the actual write; clearing the marker on every close would have reinstated the
      bug the guard exists to prevent.
- [ ] **P9** Webhooks, schedules, recurring triggers — **public beta gate**
- [ ] **P10** Hardening, 10 templates, GA housekeeping

### Job Costing & Profitability (2026-08-07)
The CRM tracked what a job **charged** and nothing about what it **cost**, so it could not answer
"am I making money on this work". `jobs` had zero cost columns; `catalog_items` had a price and no
cost. Built end to end: capture on the job, a Costs tab, and a Profitability section on `/reports`.

**The rule the whole feature rests on:** an unknown cost makes a total *incomplete*, not lower.
A line item with no cost adds 0, which is arithmetically identical to costing nothing — and that is
exactly the danger, because zero cost reads as pure profit. So `CostCoverage` travels with every
money figure, and incomplete jobs are **excluded** from report aggregates rather than averaged in.

#### Schema + migration
- [x] `20260806000001_job_costing.sql`, idempotent throughout (`DO $$` guard on the enum, an
      `information_schema` guard on the generated column). New: `job_expenses`,
      `tenant_member_rates`, `expense_category` enum, `jobs.actual_hours`, `jobs.labor_cost_rate`,
      `job_line_items.unit_cost` + generated `cost_total`, `catalog_items.unit_cost`,
      `tenants.default_labor_cost_rate`, 3 supporting indexes.
- [x] **Every cost column is nullable with no zero default.** A `DEFAULT 0` would have made the
      whole feature quietly wrong on day one.
- [x] `jobs.labor_cost_rate` is **snapshotted**, not joined — a raise must not rewrite last year's
      margins. Same reasoning as `unit_price`, which line items have always copied.

#### API
- [x] `services/costing/` — `money.ts` (integer cents; a margin is a *difference* of two sums, so
      float error is doubled), `costing.service.ts` (`summarise()` — THE definition of a job's
      margin), `rates.ts` (member override → tenant default → **null**, never 0),
      `profitability.service.ts`, `queries/job-costs.ts`, `queries/profitability.ts`.
- [x] Three correlated `LEFT JOIN LATERAL`s, not joins. Joining line items **and** expenses to jobs
      multiplies the two sets — 4 items × 3 expenses counts each item 3× — and the wrong number
      looks entirely plausible.
- [x] `routes/jobs/costing.ts` (6 endpoints) and `routes/tenants/member-rates.ts` (3) as **sibling
      plugins** under the existing prefixes; `routes/jobs/index.ts` is 2,497 lines and is ARC-05's
      target. Every mutating handler runs `loadEditableJob` first; member rates are
      `requireOrgRole(["owner","admin"])` throughout, because a rate is payroll data.
- [x] `?section=profitability` on `/reports/stats`. Rolls up in TypeScript over per-job rows rather
      than a SQL `GROUP BY`, so the report cannot form a second opinion about margin that disagrees
      with the job's own Costs tab. Row set bounded at 2,000 and `totals.truncated` says when it bit.
- [x] Caught before shipping: `z.coerce.boolean()` on a raw-SQL row is `Boolean(value)`, so `"false"`
      → **true**. Same defect as `?showArchived=false` returning archived-only rows. Replaced with
      two integer counts.

#### Frontend
- [x] **Costs tab** on both the job sheet and the job detail page. Margin headline, the cost stack,
      hours + the snapshotted rate, expenses CRUD. Mounted only while selected — the summary is
      derived on every read.
- [x] `job-cost-stack.tsx` — one bar, scaled to `max(revenue, cost)` with a rule at what was billed,
      so an overrun has length instead of a minus sign. **The margin segment is hatched, not filled,
      when the cost side is incomplete**: that remainder is profit *or* an unentered cost, and a
      solid green bar over a half-costed job is the most misleading thing this feature could draw.
- [x] Line items and the catalog table print **"no cost"** rather than leaving the cell blank — a
      blank cell reads as zero and zero reads as profit.
- [x] **Profitability tab** on `/reports`: margin by job (thinnest first), service type, customer,
      assignee. Names how many jobs were left out and why. A "set up costing" empty state instead of
      a confident 100% margin for a tenant who has entered nothing.
- [x] Catalog **Your cost** field, Settings → Business **labour cost rate**, Settings → Team
      **Cost Rates** (all members listed, not just those with an override — "who is still on the
      default" is the question a list of exceptions cannot answer).
- [x] Housekeeping: REPO_MAP 1 + 2, API docs (10 new endpoints + `unitCost`/`defaultLaborCostRate`
      on 3 existing bodies), 6 chatbot knowledge-base entries, lessons (backend-stack, frontend-nextjs).

- [ ] **Not verified.** No typecheck/lint/build run this session — the user runs those.
- [x] **Migration applied** (2026-08-07). Found by the workflow audit: it had never been run, and
      because Drizzle names every schema column in an `INSERT`, *every* write to `tenants`, `jobs`,
      `job_line_items` and `catalog_items` was failing `42703` against Neon — onboarding, job
      creation, line items and the catalog were all broken on live, not just costing. Applied and
      re-run 4×; columns and indexes byte-identical after each.
- [ ] Follow-up: nothing prompts for hours at completion. The natural place is the completion gate
      in `PATCH /jobs/:id/status`, prefilled from `scheduled_start`/`scheduled_end` where both are set.
- [ ] Follow-up: quotes have no cost side, so there is no way to see margin *before* committing to
      a price. `quote_line_items` would need the same `unit_cost` + generated `cost_total` pair.

### Settings Sidebar Render Delay (2026-08-06)
Reported as "the sidebar takes time to render on reload or when I change settings page".
Two unrelated defects producing one symptom; the sidebar was innocent in the second.
- [x] **Reload — the nav shipped incomplete.** `settings-nav.tsx` gated Business and Billing on
      `useOrgRole()`, a bare `useEffect` fetch. `orgRole` is `null` for the whole server render
      and the whole first paint, so those two items were *always* absent from the HTML and
      arrived one browser → Vercel → Render → Neon round trip later, shoving Documents / Jobs /
      Scheduling down. The hook returned `isLoading`; the nav destructured it as `roleLoading`
      and never used it, so nothing even held the space. New `getServerOrgRole()` in
      `lib/auth-server.ts` resolves it in the settings layout and passes it as a prop — the
      nav is now complete in the server HTML and does nothing on mount.
      Uses `/organization/get-active-member-role` (returns `{ role }`) rather than
      `get-active-member` (the whole membership row); the role was all either caller wanted.
      `hooks/use-org-role.ts` deleted — one importer, now zero.
- [x] **Navigation — no Suspense boundary under `/settings`.** 6 of 12 settings pages are async
      server components awaiting a server action, and settings was the **only** route under
      `(dashboard)` with no `loading.tsx` (13 others have one). Next.js will not commit the
      transition until the RSC payload lands, so clicking a link left the old page up with the
      old item highlighted — `usePathname()` had not changed. The nav never unmounted and never
      re-rendered; the destination was blocking it. Added `settings/loading.tsx`.
- [ ] **Not verified.** No typecheck/build/browser run this session — the user runs those.
      Worth a look on `/settings/business` reload (Business + Billing should be in the initial
      paint, no shift) and on a click from Business → Pipelines (highlight should move instantly).
- [ ] Pre-existing, untouched: the nav links to `/settings/billing` and no `billing/page.tsx`
      exists, so that item 404s for owners.

### Security Audit Remediation (2026-08-06)
Whole-codebase security review (auth, public surface, tenant isolation, injection, storage,
web layer). 7 candidates, each put through an independent adversarial verification pass:
**2 confirmed HIGH, 1 confirmed LOW, 4 refuted.** The 4 refuted were all real code defects
whose exploit required guessing a UUID the app never discloses — fixed anyway, because the
invariant is one feature away from mattering.

#### Phase 1 — the two HIGH findings (one root cause)
- [x] **`/api/auth/admin/*` closed at the proxy** (`apps/api/src/server.ts:159`). The app models
      three admin tiers in `user.adminTier`, but `routes/admin/admins.ts:88` sets
      `role: "admin"` **unconditionally for every tier** — and `role` is the only thing
      better-auth's admin plugin checks. The catch-all forwards `/api/auth/*` to
      `auth.handler` with no preHandler, so `support`/`billing_admin` could call
      `set-role`, `create-user` and `impersonate-user` directly: mint a platform admin
      without the `super_admin` gate or the owner check, or take a full session as any
      tenant user — no reason, no `tenants.isActive` check, no `admin_audit_log` row.
      Plugin stays registered (it owns the `role`/`banned` columns); only its HTTP surface
      closes. Verified zero callers: `adminClient()` is registered but never used. The
      denylist folds case **and** percent-encoding before comparing — `/API/AUTH/ADMIN/…`
      and `/api/auth/%61dmin/…` are both refused, since a guard that normalizes less than
      the router it guards is decorative. Dot segments were already resolved by `new URL`.
- [ ] **Regression test — now unblocked, still unwritten.** The harness landed 2026-08-07 with
      workflow P0 (vitest in 3 workspaces, `withRollback` against real Neon). The denylist test
      that could not be written then can be written now: assert `/api/auth/admin/*` is refused in
      all four normalisation forms (plain, uppercase, percent-encoded, dot-segment).

#### Phase 2 — the LOW finding
- [x] **Open redirect on login** (`login/page.tsx:78`). `callbackUrl` went from the query
      string straight into `window.location.replace()`. `middleware.ts:82` only ever writes
      a pathname, but nothing enforced that on read. New `lib/safe-redirect.ts` — rejects
      absolute URLs and both protocol-relative forms (`//host` and `/\host`; browsers
      normalise the backslash while parsing the authority, so checking only `//` misses it).

#### Phase 3 — the refuted-but-real ownership gaps
Same defect in all three: a client-supplied FK written with no tenant check, plus read joins
with no tenant predicate. `jobs`/`invoices`/`quotes` all guard this; these never got it.
- [x] **`lib/tenant-guards.ts`** — canonical home for the `owns*` family, moved out of
      `job-guards.ts` (which re-exports, so `routes/jobs` is untouched). The filename was
      the bug: importing "job guards" into the calendar reads like a mistake, so nobody did,
      and invoices/quotes wrote their own copies instead.
- [x] **Conversations** — `ownsCustomer` on `POST /conversations`, plus a tenant predicate
      on all three `customers` joins (`service:95,150`, `routes:147`) and the bare
      `where(eq(customers.id, …))` at `service:188`. Worst of the three: the join chose who
      `POST /:id/messages` emails, so an unchecked id leaked name/email/phone **and** sent
      attacker-authored mail to another tenant's customer.
- [x] **Checklists** — `ownsCatalogItem` on both item writers, plus the two
      `leftJoin(catalogItems)` sites (`checklists:124`, `jobs:460`).
- [x] **Calendar events** — `ownsCustomer` on `POST` and `PATCH`. No read path joins this
      column today, so it was integrity rather than disclosure; the first page that renders
      a customer name beside an event is what would have converted it.

#### Phase 4 — housekeeping
- [x] REPO_MAP (both new modules), API docs (3 endpoints gained a 400/404; `POST
      /conversations` was undocumented entirely), lessons (`auth-flow`, `tenant-security`).
- [ ] **Not run: `pnpm typecheck`.** No verification command was executed in this session —
      the user runs those. Nothing here is confirmed compiling.
- [ ] Follow-up: `invoice-guards.ts:181` and `quote-guards.ts:193` still carry their own
      `ownsCustomer` copies — fold into `tenant-guards.ts`.
- [ ] Follow-up: conversations API docs describe `GET /conversations/:id` (embedded
      messages) and `POST /:id/send`; the code has `GET|POST /:id/messages`. Pre-existing
      drift, flagged inline in the doc, not reconciled here.

**Audited clean** (recorded so it isn't re-litigated): 49 `db.execute` sites all
parameterized, zero `sql.raw` repo-wide, sort/granularity identifiers resolve through closed
enums; public quote tokens are `randomUUID()` with accept/decline serialized under
`SELECT … FOR UPDATE`; no webhook handler exists yet (**review signature verification the day
Lemon Squeezy lands**); storage keys server-derived; SSE tenant-scoped; 3
`dangerouslySetInnerHTML` sites all render server-owned data.

### Landing Page De-Slop (2026-08-02) — UNCOMMITTED, awaiting review
Mode: Redesign-Overhaul, brand-preserved. Dials 5/3/5 → 7/5/5. 15 files in
`components/landing/`, nothing outside it. **Not committed at the user's instruction.**
- [x] **Eyebrow system retired.** `SectionHeading.label` is now optional; it was required,
      so all 10 sections rendered a mono-caps eyebrow *by construction*. That single
      templated rhythm was the loudest generic signal on the page. 15 `uppercase tracking`
      declarations → 3 (hero, the day-sheet date field, and the now-unused code path).
- [x] **Fabricated review rating removed**, on-page and from JSON-LD `aggregateRating`
      (claimed 4.9 from 500 ratings; the DB has one tenant and no users). This is a
      rich-results violation, not a taste call. Star rows on the 3 testimonial cards went
      with it, taking `amber-500` — a second accent existing only for those stars.
- [x] **Layout repetition broken.** 3 sections shared `md:grid-cols-3` → 1. How It Works
      became a ruled left-rail sequence (suits the 0:00/0:02/0:10 markers far better than
      3 equal cards, which actively hid the ordering); Testimonials became lead-plus-two.
- [x] **13 user-visible em-dashes → 0.** Includes 2 pricing table cells whose entire
      content was `"—"` standing in for "no cost". Voice untouched otherwise.
- [x] **Colour lock.** 4 accent families → 1. Deleted `ChartVisual` (12 hardcoded bars +
      an invented "+18%" in emerald, the page's only unsupported business-outcome claim);
      dropped the sky/emerald/brand kanban dots, which restated their own column headings.
- [x] **Hero.** 5 text elements → 4, subtext 29 words → 17, eyebrow's 4 middle dots → 0.
- [x] **`navbar.tsx` scroll listener → IntersectionObserver on a top sentinel.** A
      continuous input was driving React state and re-rendering the header every frame;
      the correct pattern was already in the same file, 10 lines below.
- [x] Preservation audit **empty**: 0 changes to routes, the 5 anchors, nav labels, footer
      hrefs, `<h1>`, metadata, sitemap, robots. Brand audit clean: `--brand`, the
      Space Grotesk/DM Sans/DM Mono stack and `logo.tsx` untouched.
- [ ] **Page still has zero photographs.** Blocked on real assets, not on code. Shot list:
      hero 4:5 technician on site; 6× industry tab 16:10; testimonial faces 1:1; and an
      OG image at 1200x630 (the `summary_large_image` card currently has nothing to show).
- [ ] Run `pnpm typecheck`, then check `/` at 390px for horizontal scroll (this page has
      regressed on that before).

### Production Build Repair (2026-08-02)
Three failures in a row on `main`, each hiding the next.
- [x] **`ERR_PNPM_OUTDATED_LOCKFILE`** — ARC-13/14 pruned 6 deps and deleted `packages/ui` without
      regenerating `pnpm-lock.yaml`. Vercel installs frozen, so it refused before compiling
      anything. Regenerated: 3 insertions, 544 deletions, no version bumps.
- [x] **`radix-ui` not found** — ARC-13 recorded 0 importers for the meta-package; the real count
      was 2 (`animate-ui/primitives/radix/{tabs,accordion}.tsx`, both load-bearing under
      `ui/tabs.tsx` and the landing FAQ). The stale lockfile had been installing it anyway for
      four days, which is why no earlier deploy caught it. Repointed at the scoped
      `@radix-ui/react-{tabs,accordion}`, already direct deps. ARC-13's table corrected.
- [x] **`QuoteFormData` not assignable** — pre-existing in `02d4441`, which died at install and so
      was never type-checked. `catalogItemId` is `string | null` on the form and
      `.uuid().optional()` on the API. New `lib/quote-payload.ts`; `/quotes` had the mapping
      inline, `/customers/[id]` had none — that page's New Quote flow could not have worked.
- [x] **Ran `pnpm typecheck`** — it found 8 more errors behind the one `next build` reported, in
      2 files, both from the same unverified commit. All fixed:
      - `actions/tags.ts` — the ARC-02 proof-of-concept migration left `apiGet<unknown[]>` and a
        bare `apiSend` whose `T` resolves to `unknown`, so `customer-tags-input.tsx` could not
        read `res.data.id`. Now typed with `Tag` from `@hvac-saas/types`.
      - `schedule-calendar.tsx` — the ARC-17 comment claimed `withDragAndDrop` "erases the
        generics" and cast around it. It doesn't; the *cast* erased `TEvent`, so all four
        `CalendarEvent` handlers were checked against `object`.
        `withDragAndDrop<CalendarEvent, object>(BigCalendar)` needs no cast, and removes an
        `as unknown as` that broke strict-rules §4.
      - `schedule-event.tsx` — `ScheduleEventProps` carried `[key: string]: unknown` to "accept"
        the library's spread props. Interfaces get no implicit index signature in TypeScript, so
        this made `EventProps` unassignable to it. Removed.
- [ ] **Re-run `pnpm typecheck`**, then push.

### Date Range Persistence (2026-08-02) — COMPLETE
The 2026-08-01 fix below stored a preset *as a preset* and recomputed it against today on every
load. That is the opposite of what the range picker is for: a selection the user made must stay
put until they change it.
- [x] **Everything is stored as two absolute dates**, shortcuts included. `StoredDateRange` now
      requires `from`/`to`; `preset` survives only to highlight the matching tab and never decides
      which dates are used. Entries in the old preset-only format fail `parse()` and are dropped,
      costing one re-selection.
- [x] **`inferPreset` is cosmetic now.** It was being used to *choose what to store*, so any
      hand-picked span of exactly 1, 7 or 30 days was saved as `1D`/`1W`/`1M` and replayed as the
      window ending today — deliberately picking an earlier week jumped it forward to this one.
- [x] **The picker shows the user's selection, not `stats.range`.** Reading the server's resolved
      range meant an in-flight refetch blanked the control and the SSR payload reasserted the
      tenant default — on 2026-08-02 that default is literally "Aug 1 – Aug 2", so a saved range
      looked like it reset on every visit.
- [x] Housekeeping: chatbot knowledge base (2 entries documented the old sliding behaviour),
      lessons.
- [x] **`/reports` now persists too** (2026-08-06). Its range was a plain
      `useState<DateRange>(undefined)` and reset on every visit. Rather than copy the fix,
      `use-dashboard-date-range.ts` became `use-stored-date-range.ts` and takes a storage key, so
      one implementation backs both pages and a future third one. Keys are separate
      (`DATE_RANGE_KEYS`): same control, same expectation, different selections — sharing a key
      would have made changing one silently change the other. Clearing the range still falls back
      to the tenant-resolved default and forgets what was saved.

### Dashboard Charts + Date Range Fix (2026-08-01) — COMPLETE
The dashboard answered "money in", "who owes", "what state is the work in" and "what's next (list)".
It did not answer **"am I billing as fast as I'm collecting"** or **"how loaded is my week"**.
Three payload fields — `kpis.activeCustomers`, `weeklyJobVolume`, `weeklyRevenue` — were fetched on
every load and rendered nowhere. **Verified 18/18 by execution against Neon.**
- [x] **Billed vs Collected** — the revenue hero gained a second series. New `getInvoicedTrend` +
      `getInvoicedTotal`, merged into `revenueTrend` **by bucket key, not by index** (the /reports
      audit's REP-02 bug). One `BILLED_FILTER` — excludes draft, void and archived — now shared with
      `getCollectionRate`, which had counted drafts: on the demo tenant a single **$12,669.58 draft**
      against $19,079.08 genuinely billed, a 66% overstatement of what had been invoiced.
- [x] **Week Ahead** — full-width load strip under the mid-grid: stacked jobs/bookings/events per
      day, today outlined, busiest and open days named. Derived client-side from `stats.agenda`, so
      **no new query**. The harness caught that `agenda.from → to` is **8** days, not 7 — a hardcoded
      seven columns dropped a real booking the Agenda still listed.
- [x] **Active Customers** as a 4th KPI pill — spends `kpis.activeCustomers` instead of dropping it.
      New `teal` accent keyed to the shared series token.
- [x] Deleted `weeklyJobVolume` / `weeklyRevenue` end to end (queries, Zod rows, type, service).
      Net query count unchanged: two dead queries out, two live ones in.
- [x] **Date range picker fixed.** Two defects: (1) `react-day-picker` v9 folds every click into the
      selected range, so with a complete range always applied, clicking either endpoint returned
      `{from: day, to: day}` — the "Aug 1, 2026 – Aug 1, 2026" the control kept collapsing to; fixed
      with `resetOnSelect` plus a local draft so no half-finished selection reaches the page.
      (2) The range was component state, so every visit reset to month-to-date — which on the 1st of
      a month *is* a single day. A new persistence hook stored presets **as presets** and recomputed
      them against today — superseded the next day by the entry above, and now
      `use-stored-date-range.ts`.
- [x] Layout: Top Customers + Activity Feed share one two-column row; the skeleton now matches the
      real default widget set.
- [x] Housekeeping: REPO_MAP, API docs (dashboard stats shape), knowledge base, lessons.

### Page-by-Page Audits (2026-07-27)
Reports live in [[reports/README|docs/claude/reports/]]. One file per page.
- [x] `/dashboard` — [[dashboard|report]]: 29 findings audited and **all 29 fixed** (2026-07-27)
- [x] `/reports` — [[reports-page|report]]: 28 findings audited and **all 28 fixed** (2026-07-27)
- [x] Bookings & Calendar — [[bookings-calendar|report]]: 34 findings audited and **all 34 fixed** (2026-07-27)
- [x] `/customers` — [[customers|report]]: 35 findings audited and **all 35 fixed** (2026-07-27)
- [x] Jobs — [[jobs|report]]: 42 findings audited and **all 48 fixed** (2026-07-29) — the 42 plus 6 found while fixing. (The report header had undercounted its own medium section as 16; it is 20.)
- [x] Invoices — [[invoices|report]]: 42 findings audited and **all 42 fixed** (2026-07-29)
- [x] Quotes — [[quotes|report]]: **35 findings, all open** (2026-08-01). Verified 24 checks by
      execution (6 pass, 18 fail). The page is the control group for [[invoices|§2]]'s process
      change: **6 of 6** patterns that were swept repo-wide arrived here, **0 of 19** applied
      only in place did. Worst finding is a regression of a fix three days old —
      `lib/quote-to-job.ts` writes `jobs.status` by hand and never sets `stage_id`, so every job
      created from a quote is outside the stage model, counts as 0 in the pipeline stage counts
      and matches no lifecycle filter. Also: `bulk-status-update` can flip a draft to `sent`
      with no token and no PDF, after which `/send`, `PATCH` and `DELETE` all refuse it — the
      quote is unusable and undeletable; the public accept/decline pair is an unserialised
      read-then-write, so an accept racing a decline leaves a scheduled job on a declined quote;
      and `quoteOnlineAcceptanceEnabled` is enforced in exactly one place — building the email
      link — so turning it off leaves every issued portal link live.
- [ ] Next page to audit — user picks (suggested: Assets & Service Agreements, or Catalog +
      Checklists together — both are settings-shaped and share the catalog line-item model)

### Quotes Remediation (2026-08-01) — COMPLETE
All 35 findings in [[quotes|the report]] are fixed; the record is [[quotes|§8]]. **Verified 32/32 by
execution** against Neon, `tsc` clean on both packages.
- [x] **Phase 1 — QUO-02, 27** — `lib/quote-to-job.ts` now resolves through
      `job-stages.service.ts` and writes `stage_id`. This was a regression of a fix three days old:
      the jobs audit converted every `jobs.status` writer inside `routes/jobs` and never grepped
      outside it, so for four days every job created from a quote counted **0** in the stage-keyed
      pipeline counts and matched no `?lifecycle=` filter. `resolveStage` already refused a
      cross-pipeline stage, so QUO-27 closed with it. Found on the way: `job-stages.service.ts`
      typed its `Db` as `ReturnType<typeof getDb>`, which a transaction does not satisfy — the
      service literally could not be called from inside one.
- [x] **Phase 2 — QUO-01, 35** — new `lib/quote-guards.ts` holds the transition table, and
      `draft → sent` is absent *by construction*: `sent` is not a value `bulkQuoteStatusBody`
      accepts, because only `/send` can mint the token and PDF that make a sent quote usable.
- [x] **Phase 3 — QUO-03, 04, 12** — `claimQuoteResponse` re-reads status inside
      `SELECT … FOR UPDATE`; the online-acceptance kill switch and the archived check moved into
      `resolveQuoteByToken` so they gate the mutations, not just the email link; rate limits copied
      from `public/booking.ts`.
- [x] **Phase 4 — money + time** — QUO-08, 09, 10, 11. Subtotal sums the **stored** per-row total,
      so `31.00` now equals what the customer's line items add up to (was `30.99`); expiry is
      derived in tenant time on read and swept hourly by the cron instead of `UPDATE`-ing on every
      `GET`; dashboard, portal and E-13 email finally print the same date.
- [x] **Phase 5 — schemas + guards** — QUO-17…23, 28, 29, 30. `isoDate` rejects all 7
      magic/invalid dates on both verbs, `loadEditableQuote` on all 10 mutating handlers,
      `services/quotes/` created.
- [x] **Phase 6 — migration** `20260801000001_quotes_audit.sql` applied to Neon, idempotent across
      4 runs. UNIQUE index on `access_token` (verified: duplicate raises `23505`), index on
      `quote_line_items` (it had none at all), `archived_at` index, plus the QUO-02 backfill.
- [x] **Phase 7 — frontend** QUO-05, 06, 07, 13, 14, 15, 16, 26, 31…34. Six hooks that had **zero
      callers** are now the only way the page mutates; the portal's scheduling step — built end to
      end on the server in April and never once reachable — is wired up.
- [x] **Phase 8 — docs** 7 undocumented endpoints written up, plus 3 corrections to existing docs
      (`taxRate` was documented as a percentage when the API wants a 0–1 fraction; `POST /quotes`
      was documented as accepting a `lineItems` array it has never accepted).

### Architecture Audit (2026-08-02) — 14 of 21 fixed, 1 withdrawn, 6 open
[[architecture|The report]] answers why the page sweeps kept failing to propagate: **there was
nothing to propagate into.** [[decisions|ADR-002]] now names the one data-access pattern.
- [x] **ARC-02 (the seam)** — `lib/api-fetch.ts`: one module, one `fetch`, owns cookies, timeouts
      (there were none), and a `{data, error, status, notFound}` contract. `tags.ts` migrated as
      proof: 99 lines → 25, no behaviour change
- [x] **ARC-04** — deleted `use-admin.ts` entire: 21 hooks, 225 lines, zero callers (superadmin is
      pure RSC). 160 hooks → 140
- [x] **ARC-06** — 4 pages now consume their SSR payload via new `hooks/queries/seed.ts`
- [x] **ARC-10/17** — 0 `as never` and 0 `as any` left in code
- [x] **ARC-12** — 6 files onto shared `formatDateOnly`
- [x] **ARC-13/14/19** — 6 dead deps gone, `packages/ui` deleted (it was `export {}`), lucide
      retired, `@types/*` moved to devDependencies
- [x] **ARC-16** — equipment history off its bare browser fetch; bespoke rewrite deleted. Its catch
      block was literally `// silent fail`
- [x] **ARC-18/21** — sequential loop fixed; ADR-002 written
- [x] **Found while fixing** — `catalogListQuery.showArchived` used `z.coerce.boolean()`, so
      `?showArchived=false` returned **archived only** (CUST-29 recurrence); `PaginationData` was
      declared 8 times and is now `lib/pagination.ts`
- [x] **ARC-08 withdrawn** — all 16 schema-less handlers read no input at all. The original count
      came from a regex that missed multi-line options objects. See [[architecture|§7.2]]
- [ ] **ARC-02 (rest)** — 19 action files still to migrate onto `api-fetch`. Mechanical
- [ ] **ARC-01** — reads off Server Actions. Needs the `/api/*` rewrite **and** a rate-limiter IP
      review (`req.ip` → `x-forwarded-for`). One file now that the client exists
- [ ] **ARC-05** — extract services for `jobs` (2,497 lines) and `customers` (1,316). Own pass
- [ ] **ARC-07** — 16 pages with no error state. Wants a shared list shell, not 16 copies
- [ ] **ARC-09** — 6 components with inline `useQuery`; this is also the fix for the ~37 remaining
      callerless hooks (`useJobs` is dead *because* `/jobs` bypasses it)

### Cross-Page Sweeps — OPEN (baseline measured 2026-08-01)
[[quotes|§8.2]] is the first audit to *measure* the propagation problem instead of asserting it was
solved. The quotes remediation fixed quotes; these counts are what remains repo-wide. Re-measure
when closing — the number is the deliverable, not the intent.
- [ ] **`isError` on list pages** — 17 `*-page-client.tsx` still have none (was 18). `/dashboard` is
      a false positive (per-widget error boundaries). Real targets: assets, catalog, checklists,
      conversations, service-agreements, 3 settings pages, 7 superadmin pages.
- [ ] **`new Date(col).toLocaleDateString`** — 20 sites left in `components/dashboard/` (was 23).
      3 render `timestamptz`, where it is correct; the rest shift a `date` column back a day.
- [ ] **Bare `z.string()` on a date reaching a `::date` cast** — 1 file left: `schemas/equipment.ts`.
      `isoDate` in `common.ts` has been the fix since BOOK-04.

### Invoices Remediation (2026-07-29) — COMPLETE
All 42 findings in [[invoices|the report]] are fixed; the record is [[invoices|§7]]. The headline
from [[invoices|§2]] — of 17 remediation patterns established by the previous five audits exactly
**one** had reached this page — was answered by running the sweeps repo-wide and recording the
counts, which is the process change §2 asked for.
- [x] **Phase 1 — money model** (INV-01, 02, 03, 04, 09) — done. INV-01/02/03 turned out to be *one*
      defect: status was being **assigned** rather than **derived**. `services/invoices/status.service.ts`
      computes it from the payment rows, so "delete the last payment → set sent" is no longer
      expressible — a void invoice stays void and a never-sent draft stays a draft. The transition
      table then only governs what a human legitimately chooses, which is why `paid` and
      `partially_paid` appear on no row of it. `recordPayment`/`deletePayment` are one transaction
      with `SELECT … FOR UPDATE` — the transaction alone would not have fixed the race.
      `lib/invoice-guards.ts` took the archived check from **0 of 14** mutating handlers to all of them.
- [x] **Phase 2 — criticals + overdue split** (INV-05, 06, 07, 08) — done. One `overdueCondition()`
      backs the list, the stats endpoint and the cron. INV-06 was worse than "three definitions":
      the cron restricted to `('sent','overdue')`, so a **partially_paid** invoice past its due date
      was counted as overdue everywhere in the UI and **never chased** — a customer who paid half and
      stopped was silently dropped. INV-08 made that moot for the primary flow anyway: `from-job`
      set no `dueDate` at all, so those invoices were never overdue, never aged, never dunned, and
      printed "Terms: Net 30" above a blank due date.
- [x] **Phase 3 — propagation sweep, repo-wide** (INV-10, 11, 12, 13, 17, 18, 22, 31, 32) — done, with
      counts in [[invoices|§7.3]]. `escapeLike` reached **7 more route files** (0 unescaped `ilike`
      patterns remain repo-wide); the PDF logo guard covers **quotes as well as invoices**;
      `formatMoney`/`formatDateOnly` replace **four** hand-rolled copies. `useInvoice` had **0 callers** —
      so the hover prefetch was filling a cache nothing read, and sheet mutations invalidated nothing.
- [x] **Phase 4 — medium** (INV-15, 16, 19, 20, 21, 23–30, 33, 34) — done. Server-rendered data was
      fetched, passed, destructured and **never referenced**, so every load paid twice and still showed
      a skeleton; E-12 review requests moved out of a 2-hour in-memory `setTimeout` into a column plus
      a 15-minute sweep; both crons now **claim** rows with `UPDATE … RETURNING`, so N instances split
      the work instead of duplicating it and a crash-loop stops being a mailing-loop.
- [x] **Phase 5 — low + docs** (INV-35 … 42, INV-14) — done. Sortable and keyboard-reachable rows,
      six new indexes, PDF fetched through a server action. All **22** endpoints documented (was 9,
      and the one payment endpoint that was documented was wrong three ways).
- [x] Closed the 5 entries in [[deferred-fixes/invoices]] (DF-INV-01 … 05, open since 2026-04-12),
      each with a Resolution line.
- [x] **Applied `20260729000002_invoices_audit_money_model.sql` to Neon** (2026-07-29).
      **79/79 verified by execution.** Structure 23/23 — the before-state confirmed INV-33 exactly:
      `invoice_line_items` and `invoice_payments` had **no index at all** beyond their primary keys,
      so every detail fetch and every recalculation was a sequential scan. `EXPLAIN` now shows an
      index scan. Idempotent across 4 runs (NOTICE-only; index and column sets byte-identical after
      each). The two repair `UPDATE`s matched **0 rows** because the table is empty, so they were
      exercised separately against 8 seeded corruption rows and rolled back: `paid` with zero payment
      rows → `sent`, a paid-then-edited invoice → `partially_paid` with its balance restored from the
      clamped `0.00` to `500.00`, a $50 overpayment recovered into `credit_amount` — and the negative
      cases hold, a void invoice is never re-derived out of void and a genuine draft is never promoted.
      Re-running the repair matches 0 rows, so it converges. Then 38/38 round-tripping the real
      service layer against Neon, including the exact INV-02 scenario: adding a line item to a paid
      invoice now re-derives `partially_paid` and clears the credit instead of reading **Paid** with
      $511.88 owed.

### Jobs Remediation (2026-07-29) — COMPLETE
All 48 findings in [[jobs|the report]] are fixed and verified. §5.1 answered **full split**: `job_pipeline_stages.lifecycle`
maps each stage to one of the four real statuses; `jobs.stage_id` becomes the pointer; `jobs.status`
stays as the denormalised stage name but is now always derived from a validated stage.

- [x] **Phase 1 — data model** (JOB-01, 02, 03, 06, 08, 09, 27, 28, 35) — done 2026-07-29. Applied
      `20260729000001_jobs_audit_stage_split.sql` to Neon (13/13 verified: FK enforces, re-run is a
      no-op, stage delete SET NULLs instead of cascading). New `services/job-stages.service.ts` is the
      one place a job changes column. `/reorder` no longer writes status at all — the board calls
      `PATCH /:id/status`, so a drag to Completed now hits the checklist gate, the E-05 email, the
      notification and the activity row. Verified 33/33 by execution against Neon (a custom
      `awaiting_parts` stage resolves and accepts a job) and 19/19 on the Zod probes that failed in
      the audit. **Found 3 new defects while verifying — see [[jobs|§8]].** The worst: Drizzle renders
      an embedded column inside a `` sql`…` `` template as a bare `"id"`, which Postgres binds to the
      *subquery's* table, so `/settings/pipelines` has been reporting "0 stages · 0 jobs" for every
      pipeline (measured: 4 stages and 1 job read as 0 and 0). Same bug in `/checklists` itemCount.
- [x] **Phase 2 — remaining criticals** (JOB-04, 05) — done 2026-07-29. **All 5 criticals now closed.**
      New `lib/upload-limits.ts` derives each route's `bodyLimit` from its advertised ceiling, so the
      number the handler checks and the number Fastify enforces can't drift again. Verified 9/9 by
      HTTP round trip: a 2MB photo now reaches auth instead of dying at the parser, 60MB is still
      refused, and an ordinary endpoint still enforces 1MB. `initialData` now seeds only the exact
      key the server rendered, with an honest `initialDataUpdatedAt` — verified 9/9 against a real
      QueryClient, including a BEFORE run that reproduces the stale-pipeline defect.
      **2 more new defects found by grepping the class** ([[jobs|§8]]): the tenant logo upload had
      the identical bodyLimit bug (2MB promised, ~786KB real), and the jobs page was storing a bare
      string under `queryKeys.tenant.settings()` — a key 5 other components read as `{data, error}`,
      which silently reinstated the CUST-06 timezone fallback on /invoices, /quotes and /bookings.
- [x] **Phase 3 — high** (JOB-07, 10, 11, 12, 13, 14; 08/09 landed in Phase 1) — done 2026-07-29.
      **All 9 high now closed, so every P1 and P2 on this page is fixed.** New
      `lib/job-guards.ts`: `loadEditableJob` took the archived check from **4 of 14** mutating
      handlers to all of them (you could not *add* a line item to an archived job but could edit or
      delete one — both recalculate its money), and `findForeignRef` closed the 4 FKs written
      straight from the request body. Upload got a MIME allowlist (`text/html` was servable from our
      own storage domain) and a real base64 check. Bulk-delete now cleans R2 via the same helper as
      the single delete, and both report how many invoices lose their job link. Verified 28/28
      against Neon. **2 more found by grepping the class** ([[jobs|§8]]): `EntityDetailShell`
      rendered *nothing* when a fetch failed — a shared component, so all four detail sheets opened
      blank on a 500; and deleting the `as never` in `job-helpers.ts` made the compiler surface a
      second untyped enum in `lib/quote-to-job.ts`.
- [x] **Phase 4 — medium** (JOB-15 … JOB-34) — done 2026-07-29. **All 16 medium closed.** Highlights:
      the "Today" badge compared against the **UTC** date, so a tech's board said Today on tomorrow's
      jobs from 6pm Central — `components/dashboard/jobs/` had *zero* references to `timeZone`
      despite tenant tz being plumbed for the dashboard and `lib/tenant-time.ts` written for the
      calendar; the completion email stamped the *server's* date (proved: 02:30 UTC is Aug 1 in
      Chicago and Aug 2 in UTC); `bulk-status-update` sent no completion email at all, so completing
      ten jobs at once notified nobody; un-checking a catalog checklist item left its auto-added line
      item — and its money — on the job; `POST /jobs` became one transaction (was five statements, so
      a mid-way failure left a job with no checklist); `GET /pipeline-stages` stopped writing on every
      read; a drop onto a card in another column fired **two** concurrent `/reorder` writes.
      Verified 29/29 against Neon.
- [x] **Phase 5 — low** (JOB-36 … JOB-41; 35/42 landed in Phase 1) — done 2026-07-29. Deleted a
      component with 0 importers and a byte-identical duplicate of `invalidateAll`; fixed the deep-link
      bounce (two effects raced on the view preference, so `/jobs/[id]` pushed straight back to
      `/jobs`); migrated the detail page onto `useJob()` so mutations made there invalidate the list;
      and made the **assignee filter reachable** — it was honoured by the API and `jobListQuery` all
      along, but the server action never forwarded it and no control existed.
- [x] **Phase 6 — docs + verification** — done 2026-07-29. Wrote up all **13 undocumented
      endpoints** and corrected the ones this work changed (`PATCH /jobs/:id` no longer takes
      `status`; `DELETE` reports `unlinkedInvoices`; stage `lifecycle` documented with what it
      actually controls). REPO_MAP gained `job-guards.ts`, `upload-limits.ts`,
      `job-stages.service.ts`, `job-load-error.tsx` and the migration, and lost the deleted
      component. Chatbot knowledge base now explains stage types and the completion gate.
      **Final harness: 45/45 across all six phases**, `tsc` clean on all three packages.

**Verify against real data.** The DB now has one tenant — **Shihab Housing** (`/book/shihab-housing`, `America/Chicago`, 1 user, 1 customer, 1 job, Mon–Fri 08:00–17:00 seeded). Most of this is now runnable; email delivery still isn't (no verified Resend domain).
- [x] Applied `20260727000001_booking_calendar_audit.sql` (2026-07-27) — FK + index + `booking_slot_capacity`. Verified 10/10: FK enforces (`23503` on a bogus id, rollback-tested), re-running the file is a no-op, exactly one FK. The `UPDATE` and backfill both matched 0 rows — there were no dangling links to clear.
- [ ] DASH-07 — confirm the revenue headline equals the sum of the chart across a week/month boundary
- [ ] Confirm dashboard job counts match the Jobs page after a bulk archive
- [ ] Confirm the overdue banner count equals the row count on `/invoices?status=overdue`
- [ ] REP-02 — confirm the "previous period" line on `/reports` plots the period immediately before the selected one (alignment is proven; the *numbers* have never been seen)
- [ ] Confirm `/reports` booking and customer totals now match their list pages after a bulk archive
- [ ] Walk `/book/shihab-housing` end-to-end: submit → confirm → convert → cancel. Emails will 403 until a Resend domain is verified, so check the DB rows and `booking_activities` timeline rather than the inbox
- [ ] Create a booking + a calendar event on the same day, then confirm the portal stops offering those hours (BOOK-21 — occupancy across all three sources, the finding with no data to exercise it yet)
- [ ] Raise Booking Capacity above 1 in Settings → Scheduling and confirm a slot stays sellable until that many things overlap it
- [ ] Set `INTERNAL_PROXY_SECRET` in both env files, then confirm two browsers on different IPs get separate rate-limit buckets

### Storage Buckets — Remaining (blocked on R2, see [[decisions|ADR-001]])
- [ ] Create the `quotes` prefix/bucket in Cloudflare R2 (quote PDFs)
- [ ] Create the `job-attachments` prefix/bucket in Cloudflare R2 (job photos + documents)

### Unified List Page Migration (2026-04-04)
Migrating all dashboard list pages to the Unified List Page Pattern (see `docs/design.md`).
- [x] Reusable components created: `SearchInput`, `StatusFilterTabs`, `PageHeader`
- [x] `StatsCards` updated with `filterValue` prop support
- [ ] Customers page — migrated to unified pattern
- [ ] Invoices page — migrated to unified pattern
- [ ] Quotes page — migrated to unified pattern
- [ ] Bookings page — migrated to unified pattern
- [ ] Assets page — migrated to unified pattern
- [ ] Catalog page — migrated to unified pattern
- [ ] Checklists page — migrated to unified pattern
- [ ] Service Agreements page — migrated to unified pattern

### Chatbot Upgrade to AI (2026-04-04)
- [ ] Migrated from `compromise` NLP to Groq LLM (`llama-3.3-70b-versatile`) with Vercel AI SDK v6
- [ ] 10 AI tools: greet, answer_help, create customer/event/job/invoice/quote/catalog_item/equipment/booking

### Design System Docs (2026-04-04)
- [ ] Update `docs/project_docs/REPO_MAP.md` with new files

---

## Backlog

### Post-Neon Cleanup (2026-07-26)

- [ ] **Provision Cloudflare R2 and fill in the credentials** — code is done and the API boots without it, but uploads fail until set. Create two buckets (public + private; see [[decisions|ADR-001]] for why two), then set `R2_*` in the root `.env` and `NEXT_PUBLIC_R2_PUBLIC_URL` in `apps/web/.env.local`. The startup banner reports whether it is configured.
- [ ] **Verify a real sender domain in Resend** — API key is valid but the account has zero verified domains and `RESEND_FROM_EMAIL` is still `noreply@yourdomain.com`. Every send 403s until this is done; the API startup banner warns about it.
- [ ] **Set `ADMIN_SEED_EMAIL` to a real address, then run `pnpm seed:admin`** — the Neon database has no users yet.
- [ ] **Reconcile `supabase/migrations/`** — 32 of 42 files are missing from `meta/_journal.json`, so `db:migrate` skips them. Either re-baseline the journal or move the hand-written SQL somewhere it can't be mistaken for a tracked migration. (Folder name is now a misnomer — Supabase is gone.)
- [ ] **Declare `env` keys in `turbo.json`** — no task declares any, so hosted builds (env from the platform, not a file) can cache-hit stale and inline a wrong `NEXT_PUBLIC_API_URL`.
- [ ] **End-to-end test the SSE stream with a real session** — the event bus is unit-verified (routing, tenant isolation, unsubscribe) and `/events` correctly 401s unauthenticated, but no authenticated browser round-trip has been run because the database has no users yet.

### Deferred / Blocked

- [ ] **E-01 Welcome Email** — needs org creation refactor
- [ ] **E-11 Welcome Paid Email** — needs Lemon Squeezy webhook
- [ ] **Billing/Subscription** — Lemon Squeezy subscription management in settings
- [ ] **Affiliate Program** (#13) — Lemon Squeezy integration, referral tracking, affiliate dashboard

### Future Ideas

_(Add items here as they come up)_

---

## Completed

- [x] **Demo Data Seed** (2026-07-31) — New `pnpm seed:demo` (`apps/api/src/scripts/seed-demo-data.ts`
      + `seed-demo-dataset.ts`). Resolves a tenant from the owner's email, then fills it with a working
      dataset: 13 customers, 19 jobs across all three stages, 12 invoices, 7 quotes, 8 bookings,
      15 catalog items, 10 equipment records, 4 checklist templates, contracts, calendar events,
      notes and activity. Seeded **Shihab Roofing Corp** (`shihab.sharetasking@gmail.com`).
      Correctness came from reading the schema rather than guessing: job/invoice/quote numbers are
      left empty so the `generate_*_number()` **triggers** issue them; `total` on line items is a
      GENERATED column and is never inserted; `jobs.status` is written from the resolved stage's name
      with `stage_id` alongside it; and invoice status is produced by importing the live
      `deriveStatus`/`splitPayment`/`dueDateFromTerms` rather than asserted, so the seed cannot
      contradict the rules the app enforces. Payments state intent ("settle the rest", "overpay by
      50") and are resolved against the computed total — hardcoded figures had silently turned two
      paid invoices into `partially_paid`. Everything is scoped to one `tenant_id`; auth tables are
      never touched; `--reset` re-runs cleanly. **Verified 18/18 by execution against Neon**,
      including the overpayment landing in `credit_amount` ($50) rather than being clamped, a genuine
      overdue invoice, both sides of the booking↔job link, and zero cross-tenant references.
- [x] **Landing Page Redesign + Navbar Rebuild** (2026-07-31) — Rebuilt `/` end-to-end and retuned the
      global colour tokens. Fixed by measurement: **491px of horizontal overflow** on a 390px viewport
      (the industry tab strip was an `overflow-x-auto` inside a grid item, which never clips because
      grid items default to `min-width: auto`); a **24px hamburger**; a **mobile scroll lock that did
      nothing** — `body { overflow: hidden }` is a no-op because globals.css makes `<html>` the
      scroller, which turned out to affect **every Dialog and Sheet in the app** and is now fixed once
      via `html:has(body[data-scroll-locked])`; and a **dark-mode elevation inversion** where `--card`
      (10%) sat below `--surface-alt` (12%), so cards sank into the sections behind them. Neutrals are
      now a warm ramp that ascends `background ≤ surface < surface-alt < card` in both themes — brand
      orange is untouched, so the dashboard stays in sync. Design: the MacBook mockup and animated
      aurora are gone (with the `react-device-frameset` dependency); the hero is a live time-ruled
      **day sheet**, and a ruled work-order header is the page's structural device. The rotating word
      left the `<h1>` (layout shift on the largest text). Rebuilt on shadcn throughout — mobile menu is
      a `Sheet` (focus trap, Escape, overlay), industries are `Tabs` (roving focus), the replacement
      costs are a real `Table` that totals. Also: scroll-reveal moved off framer-motion to CSS scoped
      to `html.js` so a slow bundle can no longer render a blank page; `scroll-margin-top` so anchors
      clear the navbar; JSON-LD rating aligned to the visible page; dead footer links removed; **5 dead
      CSS utilities deleted** (0 consumers). Page height 8532px → 7045px, horizontal overflow 491px → 0.
      `tsc` clean, production build green.
- [x] **Customers Audit + Full Remediation** (2026-07-27) — Audited `/customers` and `/customers/[id]` ([[customers|report]]), found 35 issues, fixed all 35. Critical: the delete guard counted only *non-archived* jobs while `jobs.customer_id` is `ON DELETE CASCADE`, so archiving a job — the move the product recommends as safe — hid it from the guard but not the cascade, and deleting the customer **destroyed it silently while reporting success**; the whole detail page had no error state, so a 500 rendered as "No outstanding invoices"; and every bulk action toasted success for records the server had refused. That last one was never a customers bug — **22 endpoints across 7 domains return `{succeeded, failed, errors}` and none returns the `message` all 23 hooks read**, so it was fixed once in `lib/bulk-toast.ts`. Structural: `lib/phone.ts` retires four divergent copies whose input helper truncated at ten digits and destroyed every non-NANP number (`+44 20 7946 0958` → `4420794609`); `GET /customers/:id/summary` replaces five list fetches reduced in the browser, where "Outstanding" was the sum of whichever invoices fell on page one; `lib/search.ts` carries `escapeLike` out of `routes/jobs`. Also: tags became reachable (`?tagId=`, chips in the table, click to filter) after being fully built and unusable, bounded+validated schemas on the domain that feeds every PDF and email, `''`→`NULL` on both verbs, tenant timezone on the "upcoming" cutoff, sort UI, keyboard-reachable rows, tab state in the URL, note-delete confirmation, 5 activity types that had been silent, two dead panels and a dead hook deleted. Verified 28/28 by execution against Neon, `tsc` clean on both packages. 5 endpoints were undocumented; those plus 2 new ones are now written up. §4 of the report is the finding that matters most: **seven of eight remediation patterns from the previous three audits had never reached this page.**
- [x] **Bookings & Calendar Audit + Full Remediation** (2026-07-27) — Audited `/bookings`, `/schedule`, `/settings/bookings` and the public `/book/[slug]` portal together ([[bookings-calendar|report]]), found 34 issues, fixed all 34. Critical: a failed convert-to-job returned `reply.send(...)` from a `.catch()`, and reply objects are truthy, so `if (!job) return` never fired — an impatient double-click emailed the customer a **second confirmation**, logged a `job_created` event for a job that didn't exist, and double-sent the reply (the same bug in the public submit route threw a `TypeError` after the 409 was already out); the portal prefetched slots for every open date in three months = **51 requests, 51% of the production rate limit, per page load**, all keyed to one IP because they go through server actions; three tenant-scoped writes had no `tenantId`; and the *authenticated* booking schema accepted `bookingDate: "infinity"` while the public one had been hardened in April. The structural fix is `services/availability.service.ts` — one resolver for "is the business open, is that slot free" now used by the portal, the calendar and dashboard rescheduling, collapsing four findings (portal ignored jobs and events, calendar ignored date overrides, reschedule validated nothing, end-time minutes were discarded) into one implementation. Also: `convertedToJobId` finally written + backfilled (the April log claimed it was), FK on `jobs.booking_id`, bulk-delete refuses converted bookings, one status-transition table shared by single and bulk, per-tenant slot capacity, `lib/entity-links.ts` ending the third recurrence of the `?booking=` vs `?bookingId=` mismatch, `lib/tenant-time.ts` so the calendar stops rendering in browser time, the `booking_activities` timeline that had been writing rows since April with no reader, Active/Archived tabs, E-14 cancellation email, and route-level rate limits with authenticated client-IP forwarding. Verified 105/105 by execution (slots, control flow, status machine, Zod probes, tenant-filter scan), `tsc` clean. Swept the 5 tenant-filter violations found outside scope; 0 remain repo-wide. Calendar-events endpoints were undocumented — now written up.
- [x] **Reports Audit + Full Remediation** (2026-07-27) — Audited `/reports` end-to-end ([[reports-page|report]]), found 28 issues, fixed all 28. Critical: a failed request rendered as "No data available for this period" (a 500 read as "you earned nothing this quarter"); the previous-period comparison zipped two `generate_series` results *by index* so "Last month" plotted March against January and dropped February; the CSV export was an OWASP formula-injection vector reachable from the unauthenticated booking portal (now [[security-rules]] §7). Also: new `queries/buckets.ts` gives every trend day/week/month granularity ("Last 7 days" was a one-bar chart), a bucket-aligned `compareFrom`/`compareTo` window that makes the comparison line and the KPI deltas agree, `archived_at` filters on booking/customer/invoice/quote analytics (the Jobs tab already had them, so one page applied two rules), tenant timezone in `getActiveVsInactiveCustomers` and every `created_at` boundary, the two hardcoded-zero KPI fields computed, the whole data path typed as a union discriminated on `section` (was `any` + five casts), per-card error boundaries, sr-only tables on 13 charts, SSR prefetch, a complete CSV with BOM and the range in the filename, and drill-through to `/customers/:id`. `WidgetErrorBoundary`, `ChartDataTable` and `LoadErrorState` moved to `components/reusable/`. Verified 134/134 SQL + date-maths against Neon, 31/31 CSV, 5/5 endpoint contract. The API docs for this page described six endpoints that never existed — rewritten.
- [x] **Dashboard Audit + Full Remediation** (2026-07-27) — Audited `/dashboard` end-to-end ([[dashboard|report]]), found 29 issues, fixed all 29. Critical: unhandled rejection in the analytics cache's background revalidate could kill the API process; agenda rendered every job at "12:00 AM" (`parseISO` on a Postgres `time` column); `initialData` seeded every query key so changing the date range showed stale data and never refetched. Also: tenant timezone plumbed end-to-end (was UTC everywhere despite `tenants.timezone` existing), one definition of "overdue" derived from `due_date` across dashboard + invoice list + stats, revenue chart clamped to the requested window, uniform `archived_at` filtering, priority colours keyed off the real DB enum (`emergency` had rendered identically to `standard`), query fan-out 27→21 by deleting unused payload, new `GET /dashboard/pipeline`, cache gained in-flight dedup + a size bound + write invalidation via one `onResponse` hook, per-widget error boundaries, chart a11y tables, drill-through links (which required teaching Jobs/Invoices/Quotes to read filter params, and fixed a pre-existing bug where agenda rows never opened their detail sheet). Default widget set trimmed 11→6.
- [x] **Dashboard Redesign** (2026-04-17) — New widget set (KpiPill trio, RevenueRangeChart with 1D–ALL tabs, JobsManagementPanel, RetentionChart, AgendaTimeline, RevenueByServiceChart, TopCustomersCard), CustomizeWidgetsPopover + localStorage prefs, agenda folded into `/dashboard/stats` to kill a 3-call waterfall.
- [x] **Drop Supabase: R2 Storage + SSE Realtime** (2026-07-26) — Removed Supabase entirely ([[decisions|ADR-001]]). Storage → Cloudflare R2 via `@aws-sdk/client-s3` (new `apps/api/src/lib/storage.ts`, 9 call sites across jobs/invoices/quotes/tenants, two buckets for public/private separation). Realtime → SSE: new `lib/event-bus.ts` + `GET /events`, replacing 5 broadcast senders and 6 browser listeners with a shared `EventSource` (`lib/event-stream.ts` + `hooks/use-event-stream.ts`). Deleted `packages/database/src/supabase.ts` and `apps/web/src/lib/supabase-client.ts`, dropped `@supabase/supabase-js` from both packages. Fixed two latent bugs found on the way: the impersonation indicator listened on a channel nothing published to, and Supabase channels had no authorization (any user could listen to any tenant) — `/events` now scopes by session and gates cross-tenant access to admins.
- [x] **Neon Migration + Env Audit** (2026-07-26) — Moved `DATABASE_URL` from the deleted Supabase project to Neon (PostgreSQL 18.4); `db:push` created 50 tables, then applied the 2 unjournaled trigger migrations by hand (4 functions, 12 triggers). Split env by boundary: root `.env` = backend only, `apps/web/.env.local` = frontend only; rewrote both `.env.example` files and added `apps/web/.env.example`. Added Zod env validation for web (`apps/web/src/lib/env.ts`) + `experimental.instrumentationHook` so it runs at boot. Fixed `@types/react` v19→v18 in `apps/api` (unblocked `pnpm build`/`typecheck`, 167→0 errors), `/health` returning 500 on a raw JSON Schema, `seed-admin` bypassing the shared `passwordSchema`, and the placeholder `RESEND_FROM_EMAIL` default.
- [x] **TanStack Query Migration (Phases 1-4)** (2026-04-15) — Full client-side data layer: QueryClientProvider, centralized query keys, 18 reusable hook files (queries + mutations), all 14 page-clients migrated to reusable hooks, global background refetch indicator, hover-prefetch on 4 tables, pagination prefetch on 9 pages, staleTime tuning per domain. Conversations page deferred (Supabase Realtime architecture).
- [x] **Public Quote Acceptance Portal** (2026-04-11) — DB migration, public API (3 endpoints), email template, public quote page with review/respond/scheduling/confirmation steps, server actions, settings UI, quote detail UI. Manual step remaining: create `quotes` Supabase Storage bucket.
- [x] **EntityDetailShell Refactor** (2026-04-04) — Extracted reusable entity detail shell from 4 duplicated files. Removed ~1,350 lines of duplication.
- [x] **Job Photo & File Attachment System** (2026-04-05) — Full upload UI, tag pills, lightbox, before/after comparison, customer photo timeline, invoice photo selector. Manual step remaining: create `job-attachments` Supabase Storage bucket.
- [x] **Deferred Tenant Fixes (DF-TEN-01 to 12)** (2026-04-14) — Fixed 11 of 12 deferred tenant issues: idempotent /tenants/initialize with onConflictDoNothing, admin slug uniqueness check + format validation, max lengths on all text fields, HTML tag stripping for email/PDF-rendered fields, defaultTaxRate coercion, logo MIME allowlist (blocks SVG), filename path traversal prevention. DF-TEN-11 (slug redirect warning) deferred as low-priority UI concern.
- [x] **Jobs Page & Conversion Flow Audit Fixes** (2026-04-13) — Fixed 28 bugs across 6 phases: frontend stale data (refreshBothViews helper, pipelineChangingRef guard), optimistic update snapshot timing, line item numeric validation, time ordering validation, delete confirmation, SSR hydration mismatch, loading flash, timezone normalization, empty states for 0 stages/0 pipelines, dynamic import fallback, externally-deleted-job handling in detail sheet, duplicate invoice prevention (void-aware), dead code removal in quotes route.
- [x] **Job API Route Audit Fixes** (2026-04-13) — Fixed 22 issues across 5 phases: schema enum mismatches (priority, itemType, status), status transition state machine, bulk checklist gate, assignee/pipeline tenant validation, archived job guards, storage bucket fix, LIKE escaping, reorder transaction, tenantId defense-in-depth. Frontend: Active/Archived tabs with bulk archive/restore in jobs table view.
- [x] **Bulk Actions for List Pages** (2026-04-10) — Full-stack bulk operations across all 8 list pages. DB: `archived_at` column on 6 tables (customers, jobs, invoices, quotes, bookings, equipment) with partial indexes. API: 28 new bulk endpoints (archive/restore/delete/status-update/toggle-active) with filter-then-execute pattern and partial failure reporting. Frontend: `useRowSelection` hook, `BulkActionBar` floating bar, `BulkConfirmDialog`, checkbox columns on all 8 tables, Active/Archived filter tabs. Shared Zod schemas in `apps/api/src/lib/schemas/bulk.ts`.
- [x] **Customer-to-Job Flow Fixes** (2026-04-13) — Pre-delete cascade guard (single + bulk), booking→job atomic transaction with `SELECT FOR UPDATE` row lock, case-insensitive email match, tenant ownership validation for pre-linked customerId, customer jobs tab pagination (20/page), customer picker lazy fetch.
- [x] **Conversations Page** (2026-04-06) — Chat-app-style email messaging with customers. Two-panel layout (conversation list + thread), real-time updates via Supabase Realtime, desktop browser notifications with Settings toggle, SMS placeholder ("Coming Soon"), in-app `message_received` notifications.
- [x] **Job Assignee Feature** (2026-04-07) — Full-stack: DB migration, Drizzle schema, API (GET/POST/PATCH + new GET /jobs/assignees), AssigneePicker component, kanban card avatar, create dialog, detail sheet inline picker. Fixed all 548 pre-existing TypeScript errors by migrating all 29 route files from `FastifyInstance` → `FastifyPluginAsyncZod`.
- [x] **Zod Schema Migration** (2026-04-05) — Added Zod schemas to all ~178 API route handlers across 17 domains. Created 16 schema files in `apps/api/src/lib/schemas/`. Removed all `request.body as Record<string, unknown>` casts. Updated CLAUDE.md with mandatory Zod rules.

### Phase 1 Features (Build Order)

All 14 Phase 1 features have been implemented:

| # | Feature | Status | Completed |
|---|---------|--------|-----------|
| 1 | Organization/Tenant creation flow | Done | — |
| 2 | Customer CRUD | Done | — |
| 3 | Service Catalog + Settings | Done | — |
| 4 | Job Management (Kanban) | Done | — |
| 5 | Invoicing | Done | — |
| 6 | Quote Builder | Done | — |
| 7 | KPI Dashboard | Done | — |
| 8 | Booking Portal | Done | — |
| 9 | Calendar/Schedule View | Done | — |
| 10 | Checklists | Done | — |
| 11 | Super Admin Panel (4 phases) | Done | — |
| 12 | Email Templates (14 templates) | Done | — |
| 13 | Affiliate Program | Deferred | Needs Lemon Squeezy |
| 14 | Settings Pages | Done | — |

### Recent Milestones

- [x] **Booking & Tenant Flow Audit** (2026-04-13) — Full E2E audit of public booking submit, booking→customer linking, booking→job conversion, schedule/availability, tenant init/settings/slug/logo. 38 issues logged across `deferred-fixes/bookings.md` (26 issues) and `deferred-fixes/tenants.md` (12 issues).
- [x] **Page Header + Nav Cleanup** (2026-04-04) — Added PageHeader component to all list pages, removed duplicate titles from navbar
- [x] **Performance Optimization** (2026-04-04) — Server-side prefetch, batch stats endpoints, loading skeletons, dynamic imports for heavy libs
- [x] **Jobs Kanban Board Redesign** (2026-04-04) — Full visual redesign: new pipeline-tabs, badge-forward cards, pill-style column headers, motion.div stagger, AnimatePresence cross-fade
- [x] **Reports/Analytics Page + Frontend Migration** (2026-04-03) — 5-tab reports (revenue, jobs, customers, quotes/invoices, bookings) with Recharts, CSV export, date range picker
- [x] **Multi-Pipeline Feature** (2026-04-03) — Multiple pipelines per tenant, pipeline CRUD, scoped Kanban/table views, settings management
- [x] **Job Photo & File Attachment System** (2026-04-05) — Full upload UI (photo + document), tag pills (before/after/general), lightbox, before/after comparison, customer photo timeline, invoice photo selector. Vertical-agnostic — works for every trade on the platform.
- [x] **Security Hardening** (2026-04-02) — Fixed IDOR vulnerabilities, added rate limiting, Zod validation on all inputs
- [x] **Landing Page Redesign** (2026-04-02) — Full visual overhaul
- [x] **Help Chatbot** (2026-04-02) — Floating chat widget, knowledge base, AI tool calling via Groq
- [x] **Multi-Channel Notifications** (2026-04-01) — In-app (Supabase Realtime) + email, NotificationBell UI, preferences page
- [x] **Assets & Service Agreements** (2026-04-01) — Equipment/asset CRUD, service agreements, customer tab integration, refrigerant logs
- [x] **Email Templates** (2026-03-31) — 14 React Email templates, cron jobs for overdue/renewal/trial, team invitation template
- [x] **Team Management** (2026-03-31) — Better Auth org plugin, roles (owner/admin/member), invitations, team settings page
- [x] **Super Admin Panel** (2026-03-30) — 4 phases: tenant management, analytics/dashboard, support/search/audit, system health/affiliates, ghost + visible impersonation
- [x] **Enterprise UI/UX Overhaul** (2026-03-30) — Stats card headers, grouped sidebar, action buttons in toolbars, badge system
- [x] **Calendar/Schedule View** (2026-03-29) — Month/Week/Day views, drag-to-reschedule, availability overlay, filters
- [x] **Booking Portal** (2026-03-28) — Public `/book/[slug]` portal, dashboard bookings management
- [x] **KPI Dashboard** (2026-03-27) — Revenue chart, job pipeline chart, activity feed, overdue alerts
- [x] **Quote Builder** (2026-03-26) — 13 endpoints, PDF, send/accept/decline, convert-to-job, activity timeline, 16 bug fixes
- [x] **Invoicing** (2026-03-25) — 15 endpoints, PDF generation, payments, generate-from-job
- [x] **Custom Pipeline Stages** (2026-03-24) — Per-tenant Kanban columns, color presets, drag reorder
- [x] **Job Management (Kanban)** — 15 endpoints, drag-drop, 5-tab detail sheet, line items, checklist, photos
- [x] **Service Catalog + Settings** — Catalog CRUD, settings layout, profile/password forms
- [x] **Customer Detail Page** — 3-panel layout, inline editing, tags, notes, activity log
- [x] **Customer CRUD** — API routes, server actions, dashboard table, search, pagination
- [x] **Organization/Tenant creation** — Auto-creates tenant + subscription on org creation
- [x] **Better Auth migration** — Replaced Supabase Auth with Better Auth (unified auth)
- [x] **Frontend foundation** — Next.js 14, Tailwind, shadcn/ui, auth pages, middleware
- [x] **Landing page** — Hero, features, pricing, FAQ, testimonials
- [x] **API foundation** — Fastify server, CORS, Swagger, env validation, Drizzle ORM
