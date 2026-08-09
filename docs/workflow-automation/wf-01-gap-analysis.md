# WF-01 — Gap Analysis

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-00-decisions]] | [[wf-02-architecture]] | [[wf-10-security]] | [[architecture]] | [[REPO_MAP_1]] | [[decisions|ADRs]]

The [[README|SiloCRM port guide]] describes a system built on a different stack, for a different
product, with different infrastructure. This is the audit of **what actually transfers**, read out
of the Zaxvio source at the paths cited. Nothing here is assumed.

Verdict up front: **the ideas transfer almost completely; the code transfers not at all.** Every
load-bearing design decision in [[10-audit-findings|Part A]] is right for Zaxvio. Every
implementation detail — ORM, timestamps, tenancy, locking, queueing, node catalog, field types —
has to be rebuilt against this repo's conventions.

---

## 1. Stack delta

| Concern | SiloCRM | Zaxvio | Consequence |
|---|---|---|---|
| Monorepo | pnpm + Turborepo | pnpm + Turborepo | ✅ same |
| API | Fastify | Fastify 5 + `fastify-type-provider-zod` | ✅ same shape, stricter Zod discipline ([[api-rules]]) |
| ORM | Prisma, multi-file schema | **Drizzle**, `packages/database/src/schema/*.ts` | ❌ full rewrite of every table |
| Timestamps | **BigInt epoch ms** | `timestamp with time zone` | ❌ `resume_at`, `started_at` etc. are `timestamptz` |
| Soft delete | `is_deleted` + `deleted_at` + `deleted_by` + `deletion_reason` | `archived_at timestamptz` on 6 tables; hard delete elsewhere | ❌ adopt `archived_at`, drop the four-column pattern |
| Tenancy | **Postgres RLS** + `withoutRLS()` escape hatch | **Application-level only** — `requireTenant` + `tenantFilter()` | 🔴 biggest delta, see §4 |
| Org resolution | `?organizationId=` query param on every route | Session `activeOrganizationId` → `tenants` row, server-side | ❌ keep Zaxvio's; do not introduce the param |
| Replicas | Many (Railway) | **One** (Render free, `render.yaml`) | ⚠️ see §5 |
| Queue / locks | `pg_try_advisory_lock` via `withCronLock` | `setInterval` + `UPDATE … RETURNING` row claims | ✅ Zaxvio's pattern is better here ([[wf-00-decisions|D-18]]) |
| Rate limiting | **Redis** | `@fastify/rate-limit`, in-process, proxy-secret keyed | ⚠️ acceptable at one instance; documented swap point |
| Realtime | — | In-process `EventEmitter` → SSE at `GET /events` ([[decisions|ADR-001]]) | ✅ reuse for live test-run visuals |
| Frontend | Next 16, client `openapi-fetch` through a proxy | **Next 14**, `api-fetch` → server action → TanStack Query ([[decisions|ADR-002]]) | ⚠️ see §6 |
| Canvas | `@xyflow/react` v12 | **not installed** | ➕ new dependency |
| Builder state | Zustand | **not installed** | ➕ new dependency |
| Rich text | Lexical | **not installed** | ❌ not needed — see §7 |
| Code sandbox | `quickjs-emscripten` | — | ❌ out of scope ([[wf-00-decisions|D-12]]) |
| Tests | vitest, with fixtures | `pnpm test` runs `vitest run`; **vitest is not installed and there are 0 test files** | 🔴 Phase 0 blocker ([[wf-00-decisions|D-25]]) |
| Migrations | Prisma migrate | Hand-written **idempotent** SQL in `supabase/migrations/`, applied manually ([[strict-rules|§1]]) | ❌ different discipline, same rigour |

---

## 2. Domain delta — the node catalog does not port

SiloCRM's 156 nodes are built on contacts, leads, pipelines with stages, tags, custom fields,
calls, SMS, Facebook, Slack, Google Ads/Analytics/Sheets, and OpenAI. Zaxvio's domain is different
enough that **the catalog must be rebuilt from scratch**, even though the *contract* copies verbatim.

| SiloCRM concept | Zaxvio equivalent | Note |
|---|---|---|
| Contact | `customers` | thinner: name, email, phone, address, notes. **No custom fields, no tags-on-contact source/status, no attribution/UTM.** |
| Lead + pipeline + stage | **`jobs` + `pipelines` + `job_pipeline_stages`** | Zaxvio's pipeline is a *work* board, not a sales board. `stages.lifecycle` maps a custom stage to one of four real statuses — a concept SiloCRM has no equivalent for and every action node must respect. |
| Opportunity value | `jobs.total_amount`, and now `job_expenses` / margin | Zaxvio can trigger on **profitability**, which SiloCRM cannot. |
| Custom fields (12 picker types depend on them) | **do not exist** | Drops `customFieldSelect`, `customFieldList`, `contactFieldUpdateList`, `trigger.customfield.changed`. |
| Tags | `tags` + `customer_tags` | Exists, customer-scoped only. |
| Appointments / bookings (two families) | `bookings` + `calendar_events` + `job.scheduled_date/start/end` | Zaxvio has three scheduling surfaces and one resolver (`services/availability.service.ts`) — **better** than SiloCRM's historical `appointment.*` / `booking.*` split ([[10-audit-findings|B-14]]). |
| Calls / SMS / voicemail (12 triggers, 8 actions) | **nothing** | Dropped. `conversations` has an `sms` channel enum and every send path is a stub. |
| Facebook / Meta / Google Ads / GA4 / Sheets / Slack (8 nodes) | **nothing** | Dropped. Not a marketing CRM. |
| AI agent assign / nurture bot | **nothing** | Dropped. |
| — | **`invoices` + `invoice_payments` + derived status** | New. Dunning, payment, partial payment are first-class automation subjects. |
| — | **`quotes` + public accept/decline portal** | New. Quote follow-up is the highest-value template. |
| — | **`equipment` (assets) + warranty + refrigerant logs** | New. Warranty-expiry automation has no SiloCRM analogue. |
| — | **`maintenance_contracts`** | New, and the single highest-value automation for a service business: recurring visits. |
| — | **`checklists` + templates** | New. `job.attachChecklist` is a real action. |
| — | **`catalog_items` with `unit_cost`** | New. |

Net: roughly **30 triggers and 30 actions** for a full v1 ([[wf-04-node-catalog]]), against SiloCRM's
156 — and about a third of them have no counterpart in the source at all.

---

## 3. What ports verbatim (the whole reason to read the guide)

Every one of these is adopted. Cited to the source doc so the reasoning survives.

| # | Idea | Source |
|---|---|---|
| A-01 | Declarative node registry shared by builder + engine; behaviour in an executor keyed by node id | [[10-audit-findings\|A-01]] |
| A-02 | Transactional outbox with `FOR UPDATE SKIP LOCKED`, backoff, dead-letter, stale recovery | [[10-audit-findings\|A-02]] |
| A-03 | Durable delays — serialize context, `resume_at`, resume from a worker; cheap `count()` pre-check | [[10-audit-findings\|A-03]] |
| A-04 | **Compare-and-set on every status transition** (`UPDATE … WHERE id = ? AND status = 'running'`) | [[10-audit-findings\|A-04]] |
| A-05 | Active-node whitelist so a definition can ship before its executor | [[10-audit-findings\|A-05]] |
| A-07 | Unresolved-variable diagnostics with "did you mean" | [[10-audit-findings\|A-07]] |
| A-08 | Layered timezone resolution that **never** falls back to the server zone | [[10-audit-findings\|A-08]] |
| A-09 | Format by **declared path**, never by value shape | [[10-audit-findings\|A-09]] |
| A-10 | Test-a-single-node + run-from-node replay | [[10-audit-findings\|A-10]] |
| A-11 | `+` on unconnected outputs and on edge midpoints | [[10-audit-findings\|A-11]] |
| A-12 | Relink-on-delete | [[10-audit-findings\|A-12]] |
| A-14 | Pause machinery reused for approvals/gates, with an expiry reaper | [[10-audit-findings\|A-14]] |

A-08 and A-09 land on already-fertile ground: Zaxvio has `lib/timezone.ts` and `lib/tenant-time.ts`
precisely because the same bugs were fixed the hard way here (BOOK-30, JOB-*, QUO-10). **The engine
must use those, not new copies** — the repo has a documented history of two timezone helpers
drifting apart.

---

## 4. 🔴 The security delta: there is no RLS

SiloCRM's engine can be sloppy about tenant scoping because Postgres is the backstop —
`getDb()` returns an RLS-scoped client and bypassing it is a greppable `withoutRLS()`.

**Zaxvio has no such backstop.** Isolation is `requireTenant` on the route plus `tenantFilter()` in
the query, and [[security-rules|§1]] exists because the repo has repeatedly found queries that
matched on record id alone.

The workflow engine is the first subsystem in this codebase that **runs outside a request**. There
is no `request.authUser`, no session, no preHandler. Every consequence:

1. `tenantId` must be threaded explicitly from the workflow row into every query
   ([[wf-00-decisions|D-16]]).
2. A node config field holding a foreign id (`pipelineId`, `catalogItemId`, `checklistId`,
   `assigneeId`) is **client-supplied data** exactly like a request body, and needs the same
   `owns*` guard from `lib/tenant-guards.ts`. The 2026-08-06 security audit found this exact class
   in conversations, checklists and calendar events; a node config is a fourth place for it to hide,
   and one that is written once and re-read for years.
3. Validation must happen **at save time** (so the user is told) **and at execution time** (because
   the referenced row can be deleted, or the workflow can be duplicated into another tenant).
4. `withoutRLS`-equivalent surfaces — the event queue, goal listeners, the delay worker — are
   cross-tenant by nature. Each one gets a comment justifying why, matching
   [[09-security-and-multitenancy|§9.3]]'s discipline.

## 4b. A cache-invalidation hole the engine will fall into

`server.ts:250` invalidates the analytics cache in an `onResponse` hook keyed on
`request.authUser?.tenantId`. **Engine writes have no request**, so a workflow that creates a job or
records a payment will leave the dashboard and `/reports` showing stale numbers for up to the TTL
(30s realtime / 5min trends / 10min reports).

Fix, small and easily missed: the engine calls `analyticsCache.invalidateTenant(tenantId)` after any
node whose definition declares `mutates`. Recorded in [[wf-05-execution-engine]].

---

## 5. Infrastructure delta: one instance, no Redis

`render.yaml` runs a single `plan: free` web service, and its own comment explains why the API needs
a persistent container: in-process crons, an in-memory event bus behind SSE, and an in-memory
analytics cache.

| SiloCRM assumes | Zaxvio has | Plan |
|---|---|---|
| N replicas, so every cron holds `pg_try_advisory_lock` | 1 instance | Claim rows with `UPDATE … RETURNING` instead. Correct at 1 *and* at N, and already the house pattern (`email-cron.ts`, verified by execution in [[invoices\|INV-30]]). |
| Redis for webhook rate limits | none | `@fastify/rate-limit` route config. In-process is correct at 1 instance. Documented as the swap point, same as [[decisions\|ADR-001]] does for the event bus. |
| Redis / external queue | none | Postgres outbox. Right answer regardless — it is transactional with the write that caused the event. |
| 5s poll only | in-process `EventEmitter` already exists | Poll **and** nudge ([[wf-00-decisions\|D-18]]) — sub-second in the common case. |

None of this is a compromise: for a single-instance, Postgres-backed, one-tenant-today product, the
Zaxvio-native pattern is simply better than the ported one.

---

## 6. Frontend delta: ADR-002 vs the builder's data appetite

[[07-frontend-builder|§7.5]] and [[11-frontend-guidelines|FE-P5]] both insist the builder loads its
reference data (pipelines, stages, tags, users, custom fields) **in parallel, client-side**, because
Next.js serialises concurrent server-action calls per client and turns five parallel queries into a
five-deep waterfall.

Zaxvio's [[decisions|ADR-002]] says the opposite: one data-access pattern, `api-fetch` → server
action → TanStack Query. ARC-01 (reads off server actions) is open but not done.

**Resolution: do not fight ADR-002. Batch on the server instead.**
`GET /workflows/:id/builder-context` returns the graph plus every reference list the palette and the
pickers need, in one round trip. This is strictly better than five parallel client fetches, and the
repo already has the precedent — `GET /customers/:id/summary` replaced five list fetches that were
being reduced in the browser, and fixed a correctness bug while doing it ([[customers|CUST]]).

Second-order benefit: the batch endpoint is the natural place to enforce that every picker option a
tenant can *see* is one they *own*, which §4 point 2 needs anyway.

---

## 7. Frontend delta: what Zaxvio already has, and what Lexical was for

Already present and reusable: shadcn/ui + Radix (full set), Tailwind, TanStack Query with a
centralised key factory, `sonner` toasts, `motion`, `recharts`, `@dnd-kit`, `react-day-picker`,
`date-fns`, a reusable-component library under `components/dashboard/reusable/`, an SSE hook
(`use-event-stream.ts`), row selection, bulk-action bar, `use-view-preference`, skeleton conventions.

Genuinely new: `@xyflow/react` (canvas) and `zustand` (builder store). That is the whole dependency
delta.

**Lexical is not needed.** SiloCRM uses it for one thing: the rich-text body of `email.send`. Zaxvio
sends React Email templates from `packages/email` — the workflow email node supplies *fields*
(subject, message body, CTA label/URL) into a designed template, not raw HTML. A textarea with
variable pills is the correct control, and it dodges the entire HTML-sanitisation surface
([[09-security-and-multitenancy|§9.6]]).

---

## 8. Findings from this audit — real defects in Zaxvio, surfaced by the port

Three things this feature depends on that are broken or absent today. Each is a prerequisite, not a
side quest.

### 8.1 🔴 Notification emails never send

`apps/api/src/lib/notifications.ts:293` does:

```ts
if ("sendNotificationAlertEmail" in email) { … } else { console.log(…) }
```

**`sendNotificationAlertEmail` is exported from nowhere.** `apps/api/src/lib/email.ts` exports 16
send functions and that is not one of them; `packages/email/src/templates/` has 15 templates
(E-01…E-14 plus the team invitation) and there is no generic one. So the `default` branch of the
switch — which is **every notification type except `booking_received`** — falls through to a
`console.log`. Every user who has email notifications enabled receives nothing, and the
`notification_deliveries` row is written with `status: 'sent'` regardless.

Consequence for this feature: `notification.internal` and `email.send` both need a generic
transactional template. **Phase 0 builds E-15 (generic notification) and wires it**, which fixes the
existing bug as a side effect.

### 8.2 🔴 No customer communication opt-out

`customers` has no `email_opt_out`, there is no suppression table, and no send path checks anything.
Survivable today because every email follows a human action. An automation engine makes it a
CAN-SPAM and sender-reputation problem on day one. Blocking requirement, [[wf-00-decisions|D-15]].

### 8.3 🔴 No test harness

`pnpm test` → `vitest run`; vitest appears in no `package.json` and there are zero `*.test.ts` files
repo-wide. Already recorded in [[todo]] as the reason a security regression test could not be
written. A traversal engine with OR-joins, durable pauses and compare-and-set transitions cannot be
verified by looking at a page. Blocking, [[wf-00-decisions|D-25]].

### 8.4 🟡 Two more, worth knowing

- `jobs` has **no service layer** — creation, update and status logic live inside a 2,514-line route
  handler ([[architecture|ARC-05]]). Action nodes cannot call it. Phase 7 forces the extraction.
- `apps/api/src/routes/webhooks/` and `apps/api/src/plugins/` are **empty directories**. The webhook
  trigger has a home already reserved.

---

## 9. What Zaxvio can do that SiloCRM cannot

Worth stating, because it is where the product value is and none of it appears in the port guide.

| Capability | Why Zaxvio has it |
|---|---|
| **Recurring service automation** | `maintenance_contracts` with `visits_per_year` and `service_frequency`. "Contract visit due → create job → email the customer to schedule" is the single highest-value automation for an HVAC contractor and has no SiloCRM analogue. |
| **Margin-aware automation** | `job_expenses`, `job_line_items.unit_cost`, `tenant_member_rates`, and `services/costing/` shipped 2026-08-07. A condition on *profitability* — "job margin under 20% → notify the owner" — is expressible on day one. |
| **Asset lifecycle** | `equipment` with warranty dates and refrigerant logs. Warranty-expiry and compliance automations. |
| **One availability resolver** | `services/availability.service.ts` already answers "is the business open, is that slot free" across bookings, jobs and calendar events. Business-hours-aware delays get this for free; SiloCRM re-derives it. |
| **Derived invoice status** | `services/invoices/status.service.ts` computes status from payment rows rather than assigning it. Automations cannot corrupt invoice state, because "set status" is not expressible. |
| **Stage lifecycle mapping** | `job_pipeline_stages.lifecycle` means a tenant can name a stage anything and the engine still knows whether it means *completed*. SiloCRM's stage filters are string matching. |
| **Job costing at completion** | An automation can prompt for actual hours at completion, closing the open follow-up in [[todo]]. |

---

## 10. Summary judgement

| Layer | Port? |
|---|---|
| Node-definition contract | **Copy the shape**, rewrite as TypeScript ([[wf-00-decisions\|D-23]]) |
| Execution engine design | **Copy wholesale**, including all seven invariants in [[04-execution-engine\|§4.9]] |
| Outbox / worker design | **Copy wholesale**, swap advisory locks for row claims |
| Durable pause/resume | **Copy wholesale** |
| Data model *shape* | **Copy**, with the four fixes [[02-data-model\|§2.11]] recommends, plus versioning by snapshot |
| Data model *implementation* | Rewrite in Drizzle + `timestamptz` + `archived_at` |
| Trigger filters | **Copy the corrected design** ([[10-audit-findings\|B-02]]), never the implementation |
| Variables | **Copy the corrected design** ([[06-variables-and-templating\|§6.7]]), one declaration |
| Builder UI rules | **Copy [[11-frontend-guidelines]] almost literally** — it is the best chapter in the guide |
| Node catalog | **Rebuild from zero** against Zaxvio's domain |
| Security model | **Rebuild** — no RLS, no Redis, one instance |
| Frontend data access | **Zaxvio's own** — ADR-002 + a batch endpoint |
