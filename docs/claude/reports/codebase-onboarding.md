# Codebase Onboarding Audit

> Related: [[reports/README|Page Reports]] | [[architecture]] | [[decisions]] | [[todo]] | [[REPO_MAP_1]] | [[wf-PROGRESS]] | [[strict-rules]] | [[security-rules]]

**Date:** 2026-10-15 · **HEAD:** `a605c67` (2026-08-15) · **Method:** read-only. Six parallel
investigations covered API, web, database, workflow engine, config/integrations/tests and git
history. The highest-impact claims were then re-read directly. Nothing was compiled, run or
queried, so live database state is taken from the project's own docs.

**Verification marks used in this report:**
- ✔ — confirmed by reading the code in this audit.
- ◐ — reported by a sub-investigation and not re-checked here.
- 📄 — taken from `docs/claude/todo.md` or other project docs, not re-executed.

Finding IDs are `ONB-NN`. They follow the [[reports/README|reports convention]], so commits and
[[todo]] can cite them.

---

## TL;DR

1. **Zaxvio is a multi-tenant field-service CRM.** It covers customers, jobs, quotes, invoices,
   bookings, scheduling, assets, contracts and reports for 1–3 person trade businesses.
2. **Phase 1 was built in March–April 2026.** It was rebuilt and hardened in a 20-day sprint,
   2026-07-27 → 2026-08-15: 5 PRs, about 80 commits, 858 files and +115k lines. **There has been
   no commit for 61 days.**
3. **That sprint delivered four things.**
   - The stack moved: Supabase was replaced by Neon, R2 and SSE.
   - The app became deployable: the API on Render, the web app on Vercel, plus CI.
   - Seven page audits found 291 defects, and all were fixed.
   - Three new products shipped:
     - an **n8n-style Automations engine**: new package, 54 nodes, 38 events, 11 tables;
     - **Job Costing & Profitability**;
     - **Job Time Tracking**.
4. **Most of the newest code has never been executed** 📄. The P7–P10 automation work and time
   tracking compile, but `pnpm test` is recorded as never run, and CI runs typecheck and lint only.
   Migration `20260815000002_job_time_entries.sql` is recorded as **not applied**, and merged code
   on `main` already queries that table (**ONB-01**).
5. **This audit found 11 defects it confirmed itself** ✔, plus about 15 more reported but not
   re-checked. The two that matter most before email goes live:
   - **ONB-02:** customers cannot unsubscribe, because the middleware sends them to `/login`.
   - **ONB-04:** the embeddable booking widget is blocked by `X-Frame-Options: DENY`.

---

# Product Overview

Zaxvio CRM is a **service-management SaaS for small trade businesses**. The launch target is solo
HVAC contractors on a $49/mo plan, but every feature is written to be industry-agnostic.

A business signs up and becomes a **tenant**. Technically, one Better Auth organization maps to
one `tenants` row. It can invite teammates as owner, admin or member, and then runs its whole
operation in one place:

- **Win the work.** A public booking portal (`/book/[slug]`, plus an embeddable widget), an online
  quote that customers accept at `/quote/[token]`, and a chatbot that can create records.
- **Do the work.** A job board with configurable pipelines and stages, checklists, photos,
  assignees, a calendar, time tracking with a running timer, expense capture, and an
  equipment/asset register with refrigerant logs.
- **Get paid.** Invoices generated from jobs, partial payments, overdue chasing, receipts and
  review requests.
- **Know the numbers.** A dashboard covering billed vs collected, week-ahead load and retention;
  6 report tabs including **profitability per job, service type, customer and assignee**; and CSV
  export.
- **Automate it.** A visual automation builder: triggers from 38 business events, schedules and
  webhooks; actions such as email, notes, tags, moving a job through stages, waits until working
  hours, and goals like "stop chasing once paid".

A **platform super-admin panel** sits on top of the tenants. It covers tenant management, MRR and
churn analytics, a cross-tenant search, an audit log and impersonation of a tenant (ghost or
consent-based).

**Not built:** billing and subscriptions (Lemon Squeezy appears only as columns), online
payment collection, SMS and voice, and the affiliate program.

---

# Recent Updates

The timeline runs from the 2026-04-17 baseline to HEAD. The previous inventory,
`docs/PROJECT_ANALYSIS.md`, is dated 2026-04-15, so everything below is new since then.

| Date | Change | Evidence |
|---|---|---|
| 06-23 | Docs only: `docs/PROJECT_MAP.md` added. It still describes Supabase. | `2481bed` |
| 07-26/27 | **Dropped Supabase**: Neon Postgres, Cloudflare R2 storage, SSE realtime (`GET /events`) — ADR-001. Zod env validation on web. | PR #15 `d29e451` |
| 07-27 | **Dashboard + Reports audits** (29 + 28 findings fixed): tenant timezone end-to-end, previous-period alignment by bucket, CSV formula-injection guard (security-rules §7) | `d29e451` |
| 07-27 | **Bookings & Calendar audit** (34 fixed): the shared `services/availability.service.ts` resolver, slot capacity, E-14 cancellation email, `booking_activities` timeline | `50652f7`, `f787e17` |
| 07-27 | **Customers audit** (35 fixed): `GET /customers/:id/summary`, `lib/phone.ts`, `lib/bulk-toast.ts` (fixed bulk toasts across 22 endpoints), tags filterable | `bc2f7e5` |
| 07-29 | **Jobs audit** (48 fixed): `jobs.status` is split into stage + `lifecycle`; `stage_id` FK; `services/job-stages.service.ts`; `lib/job-guards.ts`; `lib/upload-limits.ts` | PR #16 `b1ddf0d` |
| 07-29 | **Invoices audit** (42 fixed): invoice status is **derived** from payments (`services/invoices/status.service.ts`); `SELECT … FOR UPDATE` on payments; one `overdueCondition()` | `515c5f8` |
| 07-29 | **Deployable**: `render.yaml` (API, free plan, tsx with no build step), Vercel web, `.github/workflows/ci.yml` (typecheck + lint) | `fd85ad0`, `a188cea` |
| 07-31 | Landing page redesign plus an app-wide scroll-lock fix; `pnpm seed:demo` tenant demo data | `194a11b`, `32c4e11` |
| 08-01 | **Dashboard redesign**: Billed vs Collected, Week Ahead, Active Customers KPI; shared `BILLED_FILTER` | `7f5055a` |
| 08-02 | **Quotes audit** (35 fixed) + **Architecture audit** (ADR-002: `lib/api-fetch.ts`, `hooks/queries/seed.ts`); `packages/ui`, `use-admin.ts` (21 dead hooks), chart.js, lucide and others deleted. One 102-file commit titled "Update". | `02d4441` |
| 08-02 | Build repair: stale lockfile, a missing `radix-ui` import, and 9 hidden type errors | `56c1bf1`, `3eaeafb`, `df1b6d4` |
| 08-02 / 08-06 | Date ranges persist exactly as selected, on `/dashboard` and `/reports` (`use-stored-date-range.ts`) | `abe1e70`, `40d8641` |
| 08-06 | **Security**: native Better Auth `/api/auth/admin/*` closed at the proxy; open redirect fixed; three unguarded FKs scoped (`lib/tenant-guards.ts`) | PR #17 `d3b1eb0` |
| 08-07 | Settings org role resolved on the server; settings `loading.tsx` | `5db267b` |
| 08-07 | **Job Costing & Profitability**: expenses, member cost rates, Costs tab, Profitability report | `53e7eb5` |
| 08-07 → 08-09 | **Automations P0–P6**: vitest harness, `packages/workflow-nodes`, transactional outbox, engine, builder canvas (`@xyflow/react` + zustand), branching, durable waits, merge, goals, run history, templates, version restore, retention | `c939864` … `0b9342d` |
| 08-09 | Trigger matcher fixed — it had **never** matched (`844523c`), then failed with `22P02` (`eb57a3a`). First event-triggered run proven. API boot fixed: `tsx watch` deadlocks under turbo, now `node --watch --import tsx` | `844523c`, `eb57a3a`, `cb8337e` |
| 08-10 | Global error handler: 5xx responses no longer leak SQL (`lib/error-handler.ts`). Job executors routed through `moveJobStage` / `assignJob`; causation-depth loop guard | `8e8d7c6`, `c402b54`, `fe746a7`, `ebb2232` |
| 08-15 | **Automations P7–P10**: 13 CRM pickers, nodes 23→54, webhooks, schedules, `http.request` (SSRF guard), 10 templates. **ESLint actually exists now.** `db:apply` added; `db:migrate` disabled | PR #18 `32192b4`, `662fffb` |
| 08-15 | **Job Time Tracking**: `job_time_entries`, running-timer bar, Time tab; `jobs.actual_hours` becomes a cache | PR #19 `6db2f52`, `14c9b5c`, `719332c` |
| 08-15 | Template gallery redesign; Vercel Speed Insights | `c340f05`, `3fe8493` |

---

# Feature Inventory

**Status key:**
- ✅ shipped and audited with execution evidence
- 🟢 shipped, not specifically audited
- 🟡 written and merged, never executed
- 🟠 partial
- 🔴 broken or blocked
- ⚪ not started

## 1. Auth, Organizations & Team — 🟢
- **Purpose:** email/password sign-in. Each organization is a tenant, with owner/admin/member roles and 7-day invitations.
- **Files:** `apps/api/src/lib/auth.ts` (Better Auth; the `organization.afterCreate` hook creates the tenant, a 14-day trial subscription, the default pipeline and 4 stages), `lib/auth-middleware.ts` (`requireAuth`, `requireTenant`, `requireOrgRole`, `requireAdmin`, `requireAdminTier`), `apps/web/src/lib/auth-client.ts`, `lib/auth-server.ts` (`getServerOrgRole`), `app/(auth)/*`, `app/(dashboard)/settings/team`.
- **APIs:** `/api/auth/*`, proxied by `server.ts:177-260` (10/min on sign-in, sign-up and reset); `POST /tenants/initialize`; `GET /tenants/current`.
- **DB:** `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`, `tenants`, `tenant_subscriptions`.
- **Status:** works. E-01 welcome email has **zero call sites** ◐. `/invite/[id]` is unreachable while logged out (ONB-03).

## 2. Tenant Settings — 🟢
- **Purpose:** business profile and logo, invoice/quote defaults and the three quote toggles, availability and slot capacity, the share/embed widget, pipelines, notification preferences, team and cost rates.
- **Files:** `app/(dashboard)/settings/*` (12 pages, one `loading.tsx`), `components/dashboard/settings/settings-nav.tsx`, `routes/tenants/{index,member-rates}.ts`, `routes/availability`, `routes/pipelines`, `routes/pipeline-stages`.
- **APIs:** `GET|PATCH /tenants/current` (PATCH is owner/admin), `POST|DELETE /tenants/current/logo`, `GET|PUT|DELETE /tenants/member-rates` (owner/admin), `GET|PUT /availability`, overrides, pipeline and stage CRUD with reorder.
- **DB:** `tenants`, `availability_schedules`, `schedule_overrides`, `pipelines`, `job_pipeline_stages`, `tenant_member_rates`.
- **Status:**
  - The **Billing** nav item points at a page that does not exist (404) ✔.
  - `settings/business` is hidden from members in the nav but has no server-side role check ◐. The API PATCH is still owner/admin.

## 3. Customers — ✅ (audit 2026-07-27, 35/35)
- **Files:** `routes/customers/index.ts` (1,422 lines), `services/customers/customers.service.ts`, `components/dashboard/customers/` (16 files), `app/(dashboard)/customers/[id]`, `lib/phone.ts`.
- **APIs:** 20 endpoints — CRUD, `/stats`, `/check-duplicate`, `/:id/summary`, notes ×4, tags ×3, activities, photos, bulk archive/restore/delete.
- **DB:** `customers` (`archived_at`, `email_opt_out_at`), `customer_notes` (can be authored by a workflow), `customer_activities`, `tags`, `customer_tags`.

## 4. Jobs (Kanban / List / Table) — ✅ (audit 2026-07-29, 48 fixed; P7a extraction 08-10…15)
- **Purpose:** the core of daily work. A job moves through pipeline stages, and each stage maps to one of 4 lifecycles: `scheduled`, `in_progress`, `completed`, `cancelled`.
- **Files:**
  - `routes/jobs/index.ts` (1,860 lines)
  - `services/jobs/jobs.service.ts` (998 lines: `createJob`, `updateJob`, `moveJobStage`, `assignJob`)
  - `services/job-stages.service.ts`, `services/jobs/totals.ts` (`recalculateJobTotals`)
  - `lib/job-guards.ts` (`loadEditableJob`, `findForeignRef`)
  - `components/dashboard/jobs/` (32 files; `kanban-board.tsx` uses dnd-kit)
  - `app/(dashboard)/jobs/jobs-page-client.tsx` (1,228 lines)
- **APIs:** 28 endpoints — CRUD, `PATCH /:id/status` (the **only** stage writer), `/reorder` (sort only), line items, checklist completion, upload/photos/documents, activities, bulk ×4.
- **DB:** `jobs` (`status` = denormalised stage name, `stage_id`, `assignee_id`, `actual_hours` cache, `archived_at`), `job_line_items` (generated `total`/`cost_total`), `job_photos`, `job_documents`, `job_activities`, `job_checklist_completions`.

## 5. Job Costing & Profitability — 🟢, but 🔴 at risk (ONB-01)
- **Purpose:** answer "am I making money on this job?". The rule behind it: an unknown cost makes a total *incomplete*, not lower. `CostCoverage` travels with every figure.
- **Files:** `services/costing/{costing.service,money,rates,profitability.service}.ts`, `services/costing/queries/{job-costs,profitability}.ts`, `routes/jobs/costing.ts`, `components/dashboard/jobs/{job-detail-costs,job-cost-stack}.tsx`, `components/dashboard/reports/profitability-tab.tsx`.
- **APIs:** `GET /jobs/:id/costs` (breaking shape change on 08-15), expenses CRUD ×4, member rates ×3, `GET /reports/stats?section=profitability`.
- **DB:** `job_expenses`, `tenant_member_rates`, `job_line_items.unit_cost`, `catalog_items.unit_cost`, `tenants.default_labor_cost_rate`. Since 08-15 it also reads **`job_time_entries`** ✔.

## 6. Job Time Tracking — 🟡 (merged 2026-08-15, migration not applied 📄)
- **Purpose:** replace a hand-typed `actual_hours` with real clock-in/out entries. Each entry snapshots its own rate, so a two-person job costs what it actually cost.
- **Files:** `routes/jobs/time.ts`, `services/jobs/{time.service,time-sweep}.ts`, `lib/schemas/job-time.ts` (`MAX_ENTRY_HOURS = 12`), `components/dashboard/reusable/running-timer-bar.tsx` (mounted on every dashboard page, polls every 60s), `components/dashboard/jobs/{job-detail-time,job-timer-button}.tsx`, `actions/job-time.ts`, `hooks/queries/use-job-time.ts`.
- **APIs:** `GET /jobs/time-entries/running` (declared before `/:id`), `GET|POST /jobs/:id/time-entries`, `POST …/start`, `POST …/stop`, `PATCH|DELETE …/:entryId`. Rates are visible only to owner/admin (`canSeeLaborRates`).
- **DB:** `job_time_entries`. A partial unique index on `(tenant_id, user_id) WHERE ended_at IS NULL` enforces one running timer per person, plus a `CHECK` that the entry ends after it starts.
- **Background:** an hourly auto-stop sweep (`server.ts:376-382`).

## 7. Quotes + Public Acceptance Portal — ✅ (audit 2026-08-01, 35/35)
- **Files:** `routes/quotes/index.ts` (1,606 lines), `routes/public/quote.ts`, `services/quotes/{quotes.service,quote-views.service}.ts`, `lib/quote-guards.ts` (transition table), `lib/quote-to-job.ts`, `app/quote/[token]`.
- **APIs:** 19 authenticated; public `GET /public/quote/:token` (60/min), `POST …/accept` and `POST …/decline` (10/min).
- **DB:** `quotes` (`access_token` UNIQUE, `first_viewed_at`, `converted_to_job_id`), `quote_line_items`, `quote_activities`.
- **Status:** `quote.viewed` tracking (P9) is 🟡. Expiry runs as an hourly sweep.

## 8. Invoices & Payments — ✅ (audit 2026-07-29, 42/42)
- **Files:** `routes/invoices/index.ts` (1,615 lines), `services/invoices/{invoices,status,pdf}.service.ts`, `lib/invoice-guards.ts`, `lib/cron/email-cron.ts` (E-07 overdue, E-12 review requests).
- **APIs:** 21 — CRUD, `/stats`, line items, payments, pay-in-full, `/send` and `/remind` (10/min), `/pdf` (20/min), `/void`, `/status`, bulk ×4, `POST /from-job/:jobId`.
- **DB:** `invoices` (`amount_paid`, `balance_due`, `credit_amount`, `review_email_scheduled_at`), `invoice_line_items`, `invoice_payments`.
- **Not built:** online payment collection ⚪.

## 9. Bookings, Availability & Public Booking Portal — ✅ (audit 2026-07-27, 34/34) — widget 🔴 (ONB-04)
- **Files:** `routes/bookings/index.ts` (1,278 lines), `routes/public/booking.ts`, `services/{availability,bookings}.service.ts`, `app/book/[slug]`, `apps/web/public/widget.js`, `settings/share`.
- **APIs:**
  - Public: `GET /public/booking/:slug`, `/availability` and `/slots` (60/min); `POST /:slug/submit` (5/min); `GET /:slug/status/:id` (10/min).
  - Authenticated: 11 — list, stats, detail, activities, PATCH, `convert-to-job`, delete, bulk ×4.
- **DB:** `bookings`, `booking_activities`, `availability_schedules`, `schedule_overrides`. Slot occupancy counts jobs, bookings and calendar events together.

## 10. Schedule / Calendar — ✅ (with Bookings audit)
- **Files:** `components/dashboard/schedule/schedule-calendar.tsx` (react-big-calendar with drag-and-drop), `routes/calendar-events`, `apps/web/src/lib/tenant-time.ts`.
- **DB:** `calendar_events`.

## 11. Dashboard — ✅ (audit 07-27, redesign 08-01)
- **Files:** `services/analytics/{dashboard.service,cache}.ts`, `services/analytics/queries/*`, `components/dashboard/home/` (12 widgets, prefs in `hooks/use-dashboard-widget-prefs.ts`), `hooks/use-stored-date-range.ts`.
- **APIs:** `GET /dashboard/stats`, `GET /dashboard/pipeline`. Cached in-process; any successful write invalidates (`server.ts:266-273`).

## 12. Reports — ✅ (audit 2026-07-27)
- **Files:** `services/analytics/reports.service.ts`, `queries/buckets.ts`, `components/dashboard/reports/` (6 tabs: revenue, profitability, jobs, customers, quotes-invoices, bookings), `export-csv-button.tsx` (`escapeCell`).
- **APIs:** `GET /reports/stats?section=…`.

## 13–16. Catalog, Checklists, Assets, Service Agreements — 🟢 (none audited yet)

| Feature | Route file (lines) | Endpoints | Tables |
|---|---|---|---|
| Catalog | `routes/catalog` | 8 | `catalog_items` |
| Checklists (completion gate on jobs) | `routes/checklists` | 8 | `checklist_templates`, `checklist_items`, `job_checklist_completions` |
| Assets / Equipment + EPA refrigerant logs | `routes/equipment` (783) | 11 | `equipment`, `refrigerant_logs` |
| Service Agreements (+ E-09 renewal cron) | `routes/maintenance-contracts` (621) | 8 | `maintenance_contracts` |

The todo names these as the next page audit. `schemas/equipment.ts` still has a bare `z.string()` date 📄.

## 17. Conversations (email messaging) — 🟠
- **Files:** `routes/conversations`, `services/conversations.service.ts`, `components/dashboard/conversations/`, `hooks/use-conversation-realtime.ts`.
- **DB:** `conversations`, `messages`.
- **Status:**
  - Email only. SMS returns **501** (`routes/conversations/index.ts:172-176`) ◐.
  - The sidebar shows a **"Dev"** badge.
  - `hooks/queries/use-conversations.ts` is entirely unused ◐.

## 18. Notifications — 🟢 in-app; email ⚠
- **Files:** `apps/api/src/lib/notifications.ts`, `services/notifications.service.ts`, `routes/notifications`, `routes/events/index.ts` (SSE), `components/dashboard/notifications/notification-bell.tsx`, `hooks/use-desktop-notifications.ts`.
- **DB:** `notifications` (partial unique dedup), `notification_reads`, `notification_deliveries`, `notification_channel_config`.
- **Status:** SMS and voice preference columns exist but nothing sends ◐. The `zaxvio-desktop-notifications` localStorage key is written and never read ◐.

## 19. Workflow Automations — 🟡 (P0–P6 largely proven; P7b–P10 written and unrun 📄)
- **Purpose:** an n8n-style builder native to the CRM's data model.
- **Files:**
  - `packages/workflow-nodes/src/` — node definitions, `registry/`, event taxonomy `events/registry.ts`, `graph/validate.ts` (906 lines), `templates/catalogue.ts`, `active-nodes.ts`, `limits.ts`
  - `apps/api/src/services/workflow/{engine,events,goals,graph,http,runs,sweeps,templates,triggers,webhooks,workers}/`
  - `routes/workflows/{index,graph,runs,webhooks}.ts`, `routes/public/workflow-webhook.ts`
  - `apps/web/src/components/dashboard/automations/` (29 files, 6,973 lines), `lib/workflow/store.ts` (zustand, 672 lines)
  - `app/(dashboard)/automations/{,[id],[id]/runs}`
- **APIs:** 24 authenticated, plus the public `POST /public/hooks/:token` (60/min).
- **DB (11 tables):** `workflows`, `workflow_versions`, `workflow_nodes`, `workflow_edges`, `workflow_folders`, `workflow_executions`, `node_execution_logs`, `workflow_goal_listeners`, `workflow_event_queue` (outbox), `workflow_webhooks`, `workflow_schedule_state`.
- **Counts:**
  - 54 nodes: 29 triggers, 8 CRM, 10 logic, 3 data, 2 communication, 2 integration.
  - 38 events and 10 templates.
- **Live state at last audit** 📄: 0 `workflow_executions`, and one real automation ("Whatever", `job.created`) with 0 runs.

## 20. Transactional Email & Consent — 🔴 (blocked, not delivering)
- **Files:** `packages/email/src/templates/` (E-01 … E-15 plus `team-invitation`), `apps/api/src/lib/email.ts` (three-state `EmailOutcome`, List-Unsubscribe headers), `lib/email-consent.ts` (`canEmailCustomer`, HMAC unsubscribe token), `routes/public/unsubscribe.ts`, `app/unsubscribe/[token]`.
- **Status:**
  - The Resend account has **zero verified domains** 📄, so no email has ever been delivered.
  - The unsubscribe page is unreachable for logged-out recipients (**ONB-02** ✔).
  - E-01 and E-11 are never sent ◐.

## 21. AI Help Chatbot — 🟢 (requires `GROQ_API_KEY`)
- **Files:** `apps/web/src/app/api/chat/route.ts` (Groq `llama-3.3-70b-versatile` via AI SDK v6), `lib/chatbot/{knowledge-base,ai-tools,action-executor}.ts`, `components/dashboard/chatbot/help-chatbot.tsx`.
- **Tools:** greet, answer_help, and `create_{customer,event,job,invoice,quote,catalog_item,equipment,booking}`. They execute client-side after the user confirms.
- **Status:** `create_booking` actually creates a **calendar event**, not a booking ✔ (`action-executor.ts:127-133`).

## 22. Super Admin Panel — 🟢
- **Files:** `app/(superadmin)/superadmin/*` (8 pages; the role check is in `(superadmin)/layout.tsx`), `routes/admin/*` (33 endpoints), `lib/admin-audit.ts`, `components/superadmin/*`.
- **Status:**
  - The `system/crons` and `system/webhooks` panels read `cron_job_history` and `webhook_logs`, which **nothing writes**, so they are always empty ◐.
  - Affiliates is UI-only; it filters the first 100 tenants in the browser ◐.

## 23. Landing, Blog & SEO — 🟢 landing / 🔴 blog
- **Files:** `app/(landing)/page.tsx`, `components/landing/*`, `app/(blog)/*`, `app/robots.ts`, `app/sitemap.ts`.
- **Status:** `/blog`, `/robots.txt` and `/sitemap.xml` redirect logged-out visitors to `/login` (**ONB-03** ✔).

## 24. Billing, Subscriptions & Affiliates — ⚪
`tenant_subscriptions.lemonSqueezy*` columns, a `subscription_status` enum, commented env names and a superadmin placeholder. There is no code. `app/api/webhooks/`, `app/ref/[code]/`, `routes/webhooks/` and `settings/billing/` are empty `.gitkeep` folders ✔ (billing) ◐ (others).

## 25. Developer Tooling — 🟢
- **Seeding:** `pnpm seed:admin` (super_admin), and `pnpm seed:demo` (`apps/api/src/scripts/seed-demo-{data,dataset}.ts`; defaults to a hardcoded owner email at line ~139).
- **Database:** `pnpm db:apply <file>` (`packages/database/scripts/apply-migration.mts`).
- **Tests and lint:** a vitest harness (`apps/api/src/test/db.ts`: `withRollback`, `expectViolation`), and a custom ESLint config (`packages/config/eslint.config.js`).
- **Claude tooling:** context-monitor hooks (`.claude/`) and the nightly memory consolidation (`scripts/memory/`).

---

# User Flows

Each flow runs left to right: UI → server action → Fastify → service → tables.

**F1 — Sign-up and tenant bootstrap**
1. `/signup` (`app/(auth)/signup`) → `authClient.signUp` → `/api/auth/sign-up/email`. The web origin rewrites this (`next.config.mjs`) to the Fastify catch-all (`server.ts:177`), which calls `auth.handler`.
2. The organization is created → `organization.afterCreate` in `lib/auth.ts` inserts `tenants` and `tenant_subscriptions` (trialing, 14 days), a default `pipelines` row and 4 `job_pipeline_stages`.
3. → `/dashboard`.

**F2 — Customer books online → job → invoice**
1. `/book/[slug]` → `actions/bookings.ts` forwards `x-client-ip` with `x-internal-proxy-secret` → `GET /public/booking/:slug/slots` → `availability.service.ts` (business hours ∩ free capacity across jobs, bookings and events).
2. `POST /public/booking/:slug/submit` (5/min) inserts `bookings` and links or creates `customers` → emits `booking.created` into `workflow_event_queue`, sends E-02/E-03 and creates a `notifications` row.
3. The owner reviews at `/bookings` → `POST /bookings/:id/convert-to-job`, one transaction with `FOR UPDATE` → `jobs` with `stage_id`, `bookings.converted_to_job_id`, and `booking_activities`.

**F3 — Quote → acceptance → job**
1. `/quotes` → `POST /quotes` with line items → `POST /quotes/:id/send` mints `access_token`, writes the PDF to the private R2 bucket and sends E-13.
2. The customer opens `/quote/[token]` → `GET /public/quote/:token` sets `quotes.first_viewed_at` by compare-and-set and emits `quote.viewed`.
3. `POST …/accept` → `claimQuoteResponse` (`SELECT … FOR UPDATE`) → optional scheduling step (`quotePostAcceptanceScheduling`) → `lib/quote-to-job.ts` creates the job through `job-stages.service`.
4. The `quoteOnlineAcceptanceEnabled` kill switch is checked inside `resolveQuoteByToken`.

**F4 — Job completion → invoice → paid**
1. Dragging on the kanban or picking a stage → `PATCH /jobs/:id/status` → `moveJobStage()` (`services/jobs/jobs.service.ts`), which:
   - checks the archived and required-checklist gates;
   - writes `jobs.stage_id` and `jobs.status`;
   - writes `job_activities`;
   - emits `job.stage_changed` and `job.completed`;
   - creates a notification and sends the E-05 email;
   - **stops running timers**.
2. `POST /invoices/from-job/:jobId` → `invoices` with a `dueDate` from terms → `POST /:id/send` (E-06).
3. `POST /invoices/:id/payments` → `recordPayment` (`FOR UPDATE`) → `status.service` **derives** the status (`partially_paid` or `paid`) → E-08 receipt, and E-12 is scheduled through `review_email_scheduled_at`.

**F5 — Time tracking → costing**
1. Start on the job header (`job-timer-button.tsx`) → `POST /jobs/:id/time-entries/start` inserts `job_time_entries`. A `23505` from the partial unique index becomes a "stop your other timer?" prompt.
2. `running-timer-bar.tsx` polls `GET /jobs/time-entries/running` every 60s, and Stop works from any page.
3. Each write calls `recalculateJobHours()`, which updates the `jobs.actual_hours` cache in the same transaction.
4. The Costs tab → `GET /jobs/:id/costs` → `queries/job-costs.ts` (4 `LEFT JOIN LATERAL`s, labour = Σ hours × each entry's rate) → `summarise()` adds coverage.

**F6 — Build and run an automation**
1. `/automations` → template gallery → `POST /workflows/from-template` → builder (`lib/workflow/store.ts`) → `PUT /workflows/:id/graph` → `POST /:id/publish` validates, writes `workflow_versions` and fills `trigger_types` → `POST /:id/active`.
2. Later, a domain write calls `emit()` inside the same transaction (`services/workflow/events/emit.ts`), writing one `workflow_event_queue` row per subscriber.
3. `events/worker.ts` claims rows (`FOR UPDATE SKIP LOCKED`, 5s poll) → `triggers/index.ts` matches with `trigger_types && ARRAY[…]::text[]` plus declarative filters → `enroll.ts` (idempotency key) → `engine/execute.ts` → `traverser.ts` → executors → `node_execution_logs`.
4. The owner reads the result at `/automations/[id]/runs` (`runs.service.ts`).

**F7 — Overdue chasing (two parallel paths)**
- `lib/cron/email-cron.ts` runs every 6h: an atomic `UPDATE invoices … RETURNING` claim, then the E-07 email.
- `workers/sweeps.ts` runs hourly: `sweeps/invoice-overdue.ts` emits `invoice.overdue` once per invoice per tenant day, which feeds automations.

**F8 — Admin impersonation**
1. Starting a session:
   - **ghost:** `/superadmin/tenants/[id]` → `POST /admin/impersonation/start` (super_admin or support) → `admin_impersonation_sessions` is active immediately;
   - **visible:** `POST /admin/impersonation/request` creates a pending session; the tenant receives it over the SSE `impersonation` channel and calls `POST /tenants/impersonation/respond`.
2. The browser sets the `x-impersonation-id` cookie → `requireTenant` injects the tenant context (2h cap) → `/admin/impersonation/end`. See ONB-08.

**F9 — Unsubscribe (broken: ONB-02)**
- Email footer → `${FRONTEND_URL}/unsubscribe/<token>` → `apps/web/src/middleware.ts` → **307 to `/login`**.
- What should happen: the page → `POST /public/unsubscribe/:token` → `customers.email_opt_out_at`.

---

# Architecture Summary

```
apps/web  (Next.js 14, Vercel)              apps/api  (Fastify, Render free plan, tsx — no build)
  RSC page / *-page-client.tsx                server.ts — plugins, guards, ~265 endpoints
    └─ TanStack Query hook (hooks/queries)      routes/<domain>/*.ts   (Zod via fastify-type-provider-zod)
         └─ Server Action (actions/*.ts)  ──►     preHandler: requireAuth → requireTenant → requireOrgRole?
              api-fetch.ts (4/24 files)            └─ services/<domain>/*  (business logic; ~50% of domains)
              legacy fetch (16/24 files)                └─ Drizzle → Neon Postgres (64 tables, 28 enums)
  /api/auth/* and /events are REWRITTEN to the API (same-origin cookies)
  In-process background: 6 email/sweep crons + 5 workflow workers (setInterval)
  Integrations: Better Auth · Cloudflare R2 (2 buckets) · Resend · Groq · in-process SSE bus
```

**Tenancy.** One shared schema, and every tenant table has `tenant_id`. **RLS was dropped**
(`20260315000001_drop_rls_for_better_auth.sql`), so isolation is entirely application-level: an
explicit `and(eq(t.tenantId, tenantId), …)` in every query, plus the `owns*` guards in
`lib/tenant-guards.ts`.

CLAUDE.md names a `tenantFilter()` helper as the isolation mechanism. It is **never imported**
(`lib/db/tenant-scope.ts:13`) ◐. Do not go looking for it.

**Read path.** Server components prefetch and seed TanStack Query through
`hooks/queries/seed.ts`. Client components never call the API directly; they go through
server actions. Query keys are centralised in `lib/query-keys.ts`. ADR-002 names `api-fetch.ts`
as the one fetch path, but only 4 of 24 action files use it (ARC-02 is open).

**Write path.**
- Thin route: validate → service → respond.
- Domain events are written to the **transactional outbox** inside the same transaction as the
  domain write. An event can never fire for a rolled-back write, and a committed write cannot
  lose its event.
- Status-like fields are **derived, never assigned**: invoice status from payments, job hours
  from time entries, the job lifecycle from its stage. This one design principle shows up across
  three audits, and knowing it explains most of the newer code.

**Realtime.** `lib/event-bus.ts` is an in-process `EventEmitter`, exposed through `GET /events`
(SSE, tenant-scoped, 25s heartbeat). Channels: notifications, conversations, quotes,
impersonation.

**Migrations.** `supabase/migrations/` holds 55 hand-written idempotent SQL files, but the Drizzle
journal knows only 10 ✔. They are applied one at a time with `pnpm db:apply <file>`. `db:migrate`
is deliberately disabled, and `db:generate` must be avoided because it diffs against the journal
rather than the database. **Which files have been applied is recorded only in docs** ◐.

**Deployment.**
- `main` auto-deploys the API to Render (`render.yaml`: `plan: free`, `autoDeploy: true`) ✔. The
  web app deploys to Vercel.
- CI (`.github/workflows/ci.yml`) runs `pnpm install`, `typecheck` and `lint`, **and no tests** ✔.

---

# Hidden Functionality

## Feature flags & runtime toggles
There is **no flag system**: no hits for `FEATURE_`, `featureFlag` or `isEnabled` ◐. Behaviour is
switched by the following.

**Environment variables:**

| Variable | Effect when set / unset |
|---|---|
| `R2_*` (six variables) | `isStorageConfigured()` decides whether uploads and PDFs work |
| `RESEND_API_KEY` | Unset: every email is a logged no-op |
| `GROQ_API_KEY` | Unset: the chatbot returns "not configured" |
| `INTERNAL_PROXY_SECRET` | Set: per-visitor rate limiting via `x-client-ip` |
| `NODE_ENV=production` | Swagger off, real rate limits (dev allows 100k/min) |

**Tenant columns** (`packages/database/src/schema/tenants.ts`):

| Column | Default | Note |
|---|---|---|
| `quoteOnlineAcceptanceEnabled` | true | |
| `quotePostAcceptanceScheduling` | false | |
| `quoteAutoConvertToJob` | false | |
| `bookingSlotCapacity` | 1 | |
| `isActive` | | |
| `reviewRequestEnabled` | | **dead column**, never read; E-12 gates on `googleReviewUrl` ◐ |

**Workflows:**
- `workflows.is_active` defaults to false.
- Each node has a `disabled` flag.
- `RELEASED_NODE_IDS` / `ACTIVE_NODES` in `packages/workflow-nodes/src/active-nodes.ts` are hand-kept lists that decide which nodes appear in the palette.

**Per-viewer localStorage:**
- Sidebar state, dashboard widget visibility, the dashboard and reports date ranges.
- Jobs view, pipeline and card fields; calendar view.
- Automation config-panel width.
- `chatbot-messages`: not namespaced per user and not cleared on sign-out ◐.

## Admin-only tools
The platform-admin tiers are `super_admin`, `support` and `billing_admin`. All three hold
`user.role = "admin"`; the tier comes from `user.admin_tier`.

| Capability | Endpoint(s) | Tier |
|---|---|---|
| Tenant list, detail, analytics; platform dashboard | `GET /admin/tenants*`, `/admin/dashboard` | any admin |
| Deactivate/activate, edit, **hard-delete a tenant** (requires typing the business name) | `/admin/tenants/:id/*`, `DELETE` | super_admin |
| Extend trial | `/admin/tenants/:id/extend-trial` | super_admin, support |
| Override subscription | `/admin/tenants/:id/override-subscription` | super_admin, billing_admin |
| MRR, signups, active users, churn, trial conversion, inactive alerts, feature adoption | `/admin/analytics/*` | any admin |
| Audit log, impersonation log, cross-tenant search | `/admin/audit-log`, `/admin/search` | super_admin, support |
| System health; cron and webhook history (always empty) | `/admin/system*` | super_admin |
| Manage admins (only an owner can mint a super_admin) | `/admin/admins*` | super_admin |
| **Impersonate** — ghost (immediate) or visible (tenant consents) | `/admin/impersonation/*` | super_admin, support |
| **Listen to any tenant's SSE stream** | `GET /events?tenantId=` | **any admin, no audit** ✔ (ONB-09) |
| Swagger UI | `/docs` | dev only (`server.ts:134`) |

## Experimental / in-development
- **Conversations:** the sidebar badge reads `"Dev"`, and SMS is disabled in the UI and returns 501 in the API.
- **Webhook management API** (`routes/workflows/webhooks.ts`, 5 endpoints): it has **no UI anywhere** ◐, yet the chatbot knowledge base tells users they get a URL and a secret.
- **Untested automation features:** `http.request` / `webhook.send` outbound integrations, `workflow.run` (sub-automations), `logic.switch` / `goto` / `loop`, and schedule triggers. All are written and never executed 📄.
- **`job.margin_below`:** declared in the event taxonomy with **no producer** ◐.
- **`workflow_folders`:** the table exists with no UI.
- **Draft automations:** their on/off toggle is disabled (`automations-table.tsx:55`).

## Disabled / removed routes
- `/api/auth/admin/*`: 404 at the proxy, the guard for the H-1 finding of 2026-08-06 (`server.ts:224-237`).
- `PATCH /jobs/:id/labor`: removed 2026-08-15; a tombstone comment remains at `routes/jobs/costing.ts:235`.
- `pnpm db:migrate`: exits 1 with an explanation.
- `pnpm test:e2e`: calls `playwright test`, but Playwright is not installed and there is no config ◐.
- The keep-alive GitHub Action schedule was removed (manual dispatch only). An external pinger is assumed but not provable from the repo.

## Dead code (◐ unless marked)
- **API:**
  - `tenantFilter` (`apps/api/src/lib/db/tenant-scope.ts:13`)
  - `bulkStatusUpdateBody`
  - `getOpenDatesInRange`
  - `expireLapsedQuotes` (the cron uses its own SQL)
  - Duplicate helpers: `slugify` ×2, `broadcast` ×2, `formatDateOnly` ×3
- **Web:**
  - 42 of 183 exported query hooks have no caller. `use-conversations.ts` and `use-tags.ts` are entirely unused. `use-jobs.ts` is mostly unused because `/jobs` runs an inline `useQuery`.
  - `useNotifications` is exported under one name from two modules.
  - Components with no importers: `components/under-development.tsx`, `components/superadmin/reauth-dialog.tsx`, `booking-portal/booking-step-confirmation.tsx`.
- **Database:**
  - `jobs.labor_cost_rate` (`@deprecated`; only the unapplied backfill reads it).
  - `tenants.reviewRequestEnabled`.
  - The `webhook_logs` and `cron_job_history` writers do not exist.
- **Other:** the matcher's `equipment/[^/]+/history` exclusion is stale. `favicon.ico` is referenced by desktop notifications but does not exist.

## Incomplete implementations
- Billing and Lemon Squeezy, affiliates, and online payments.
- SMS and voice.
- E-01 welcome and E-11 welcome-paid emails (written, never called).
- ARC-02 (16 of 24 action files still legacy), ARC-01, ARC-05 (the jobs route is still 1,860 lines), ARC-07 (17 list pages without `isError`), ARC-09.
- Goal filters: `goalFilter: {}` is written and never evaluated.
- P8 replay and run-from-node.
- The invoice Activity tab is a placeholder (`invoice-tabs-panel.tsx:72`).
- 0 `error.tsx` / `not-found.tsx` files in the whole web app ◐.

---

# Critical Files

These are the files that drive most behaviour. Read them before anything else in their area.

| # | File | Why it matters |
|---|---|---|
| 1 | `apps/api/src/server.ts` | Composition root: plugin order, every route prefix, the auth proxy and admin denylist, the error handler, the cache-invalidation hook, and **every background worker** started at boot (`:336-456`). |
| 2 | `apps/api/src/lib/auth-middleware.ts` | Every guard, and how tenant context is resolved, including impersonation (`:125-175`). Any authz bug lives here or in a missing call to it. |
| 3 | `apps/api/src/lib/auth.ts` | Better Auth config; `organization.afterCreate` is the tenant bootstrap. |
| 4 | `apps/api/src/lib/tenant-guards.ts` | `owns*`, `isOrgMember`, `resolveOrgRole`, `canSeeLaborRates`: the cross-tenant FK protection consolidated after five divergent copies. |
| 5 | `packages/database/src/schema/{jobs,invoices,tenants,enums,relations}.ts` | The data model. Note `jobs.status` (text, the stage name) vs `stage_id` vs `job_pipeline_stages.lifecycle`. |
| 6 | `apps/api/src/services/jobs/jobs.service.ts` | `createJob`, `updateJob`, `moveJobStage`, `assignJob`: the single writers that both HTTP routes and automations call. |
| 7 | `apps/api/src/services/job-stages.service.ts` | The one place a job changes column. |
| 8 | `apps/api/src/services/invoices/status.service.ts` | Invoice status is derived, not assigned — the money model. |
| 9 | `apps/api/src/services/availability.service.ts` | The one answer to "is the business open and is that slot free", used by the portal, the calendar and rescheduling. |
| 10 | `apps/api/src/services/costing/costing.service.ts` + `queries/job-costs.ts` | `summarise()` is **the** definition of a job's margin; the four-lateral query avoids join multiplication. |
| 11 | `apps/api/src/services/workflow/events/{emit,worker}.ts` | The transactional outbox and its worker: how any domain change reaches automations. |
| 12 | `apps/api/src/services/workflow/engine/{execute,traverser,node-executor}.ts` | The automation runtime. |
| 13 | `packages/workflow-nodes/src/{node-definition.ts,registry/index.ts,graph/validate.ts,active-nodes.ts}` | The node contract, the catalogue, the publish validator, and which nodes are released. |
| 14 | `apps/api/src/lib/{email,email-consent}.ts` + `lib/cron/email-cron.ts` | Every outbound email, consent gating, and all non-workflow crons. |
| 15 | `apps/web/src/middleware.ts` | Decides what logged-out visitors can reach (ONB-02/03). |
| 16 | `apps/web/src/lib/api-fetch.ts` | The ADR-002 seam: cookies, timeouts, and the `{data, error, status, notFound}` contract. |
| 17 | `apps/web/src/lib/query-keys.ts` + `hooks/queries/index.ts` | Cache keys and the mutation hooks (strict-rules §11). |
| 18 | `apps/web/src/app/(dashboard)/layout.tsx` | Session check, shell, chatbot and running-timer bar for every authenticated page. |
| 19 | `apps/web/src/lib/workflow/store.ts` | The builder's state: undo, insert-on-edge, relink-on-delete. |
| 20 | `docs/claude/reference/decisions.md` + `docs/claude/todo.md` | ADR-001/002/003 and the living record of what is proven vs written. Read with the caveats under Risks → Documentation drift. |

---

# Developer Cheat Sheet — the first hour

| Min | Read | What to take away |
|---|---|---|
| 0–5 | `CLAUDE.md`, `docs/claude/rules/{strict,api,security}-rules.md` | The non-negotiables: tenant predicate in every query, Zod on every route, thin routes, no `as unknown`, mutations through hooks, idempotent SQL. |
| 5–12 | `docs/claude/reference/decisions.md` (ADR-001, 002, 003) | Why Neon/R2/SSE, the one data-access pattern, and the 12 standing engine rules. |
| 12–22 | `apps/api/src/server.ts` top to bottom | The entire runtime surface in one file. |
| 22–28 | `lib/auth-middleware.ts`, `lib/tenant-guards.ts` | How a request becomes `{userId, tenantId, role}`. |
| 28–36 | `packages/database/src/schema/{enums,jobs,invoices}.ts` | The core entities and the derived-state design. |
| 36–44 | `routes/jobs/index.ts` (the `PATCH /:id/status` handler) → `services/jobs/jobs.service.ts` (`moveJobStage`) | A canonical thin route calling a single-writer service that emits events in the same transaction. |
| 44–52 | One modern vertical slice: `components/dashboard/jobs/job-detail-time.tsx` → `hooks/queries/use-job-time.ts` → `actions/job-time.ts` → `lib/api-fetch.ts` → `routes/jobs/time.ts` → `services/jobs/time.service.ts` | Read this before copying an older page: it uses the target pattern every layer down. Most older pages still use legacy fetch. |
| 52–60 | `services/workflow/events/emit.ts` → `events/worker.ts` → `triggers/index.ts` → `engine/execute.ts` (skim) | How automations hang off domain writes. |

**Commands you will actually use:**
- `pnpm dev` starts the API on :4000 and the web app on :3000.
- `pnpm db:apply <file.sql>` applies one migration.
- `pnpm seed:demo` creates a populated tenant.
- `pnpm lint` checks only; `pnpm lint:fix` rewrites files.
- **Never** run `db:generate`, `db:migrate` or, for now, `db:push` (ONB-12).

---

# Risks & Technical Debt

## Bugs waiting to happen (ranked)

| ID | Sev | Finding | Evidence | Check |
|---|---|---|---|---|
| **ONB-01** | 🔴 Critical (if still true) | Migration `20260815000002_job_time_entries.sql` is recorded as **not applied**, but merged code on `main` queries `job_time_entries`. Render auto-deploys `main`. The **Costs tab, the Profitability report, the timer and the hourly auto-stop sweep** would all raise `42P01`. | `services/costing/queries/job-costs.ts`, `services/jobs/{time.service,time-sweep}.ts`; `docs/claude/todo.md` In Progress, "Still not executed" | ✔ code dependency, 📄 DB state. **First action: check the live DB.** · **RESOLVED (2026-10-16)** — no change needed: the table, its CHECK, 4 FKs and 4 indexes all exist on Neon. The todo entry was stale. |
| **ONB-02** | 🔴 High (compliance; latent until email sends) | **Customers cannot unsubscribe.** `unsubscribeUrl()` is `${FRONTEND_URL}/unsubscribe/<token>`, and `List-Unsubscribe` is the same URL plus `/one-click`. `middleware.ts` `publicPaths` does not include `/unsubscribe`, so every logged-out recipient — every customer — gets a 307 to `/login`, and RFC 8058 one-click POSTs from mail providers are redirected too. DF-NOT-01 was marked fixed, but its own entry point is unreachable. | `apps/api/src/lib/email-consent.ts:241-242`, `lib/email.ts:115`, `apps/web/src/middleware.ts:4-11` | ✔ · **FIXED (2026-10-16)** — `/unsubscribe` added to `publicPaths`. |
| **ONB-03** | 🟠 High | The same middleware gap also redirects **`/blog`** (linked from the landing navbar and footer), **`/robots.txt`**, **`/sitemap.xml`** (SEO), **`/widget.js`** (`.js` is not in the matcher's static-extension exclusion), **`/invite/[id]`** (its logged-out branch can never render) and `/api/chat`. `/ref` is listed as public and has no page. | `middleware.ts:4-11` and the matcher at the end of the file | ✔ · **FIXED (2026-10-16)** — all six paths plus `/api/chat` added. |
| **ONB-04** | 🟠 High | The **booking widget cannot embed.** `X-Frame-Options: DENY` is set on `/:path*`, and `public/widget.js` opens `/book/<slug>` in an iframe, so the Settings → Share embed snippet does not work on any customer site. | `apps/web/next.config.mjs:88-90`, `public/widget.js:78` | ✔ · **FIXED (2026-10-16)** — `/book/*` sends `frame-ancestors *`; every other path `DENY` + `frame-ancestors 'none'`. |
| **ONB-05** | 🟠 High | **SSRF bypass in `http.request`.** The IPv4-mapped IPv6 check matches only the dotted form, but `new URL()` normalises `[::ffff:169.254.169.254]` to the hex form `[::ffff:a9fe:a9fe]`. That is the cloud metadata endpoint. NAT64 and 6to4 are also uncovered ◐. Any tenant member can build this node (ONB-10). | `services/workflow/http/url-validator.ts:91-108` | ✔ · **FIXED (2026-10-16)** — IPv6 parsed into groups; mapped, translated, compatible, NAT64 and 6to4 all judged by their v4. 32/32 by execution. |
| **ONB-06** | 🟠 High | **Schedule triggers cross-wire.** The clock claims a dedup key per *workflow*, but the emitted event's dedup key is per *tenant*, and `atTime` declares no filter. With two daily automations in one tenant, both run at the earlier time and the later one never runs. | `sweeps/clock.ts:137-174` vs `events/producers/schedule.ts:30,50`; `registry/triggers/schedule-daily.ts` | ✔ · **FIXED (2026-10-16)** — schedule events carry `workflowId` + `triggerNodeId` and reach that step only; claim and dedup keys are per step. |
| **ONB-07** | 🟡 Medium | **An event run always starts at the first trigger.** `findTriggerNode` reads `nodeConfig.parameters.triggerEvents`, but `triggerEvents` lives on the *definition* and is never a parameter. The validator allows 3 triggers per graph. | `engine/execute.ts:590-601` | ✔ · **FIXED (2026-10-16)** — the matcher passes `triggerNodeId`; the fallback reads the definition. |
| **ONB-08** | 🟡 Medium | **Impersonation consent can be skipped.** `requireTenant` accepts any session with `endedAt IS NULL` and never checks `status = 'active'`, so a *pending* visible request already grants access. Any tenant member can approve a request (`requireTenant` only), and that route has **no Zod schema** (security-rules §2). Not an escalation, since the same tiers can start a ghost session, but the consent and audit trail stop being true. | `lib/auth-middleware.ts:139-153`; `routes/tenants/impersonation.ts:27-38` | ✔ · **FIXED (2026-10-16)** — guard requires `status = 'active'`; `/respond` is Zod-validated, owner/admin only, compare-and-set. |
| **ONB-09** | 🟡 Medium | **SSE tenant override.** `GET /events?tenantId=` lets any admin tier, including billing_admin, stream another tenant's events, with no audit row. | `routes/events/index.ts` (handler top) | ✔ · **FIXED (2026-10-16)** — needs super_admin/support with an open visible session on that tenant; `impersonation` channel only. |
| **ONB-10** | 🟡 Medium | **No role gating inside a tenant** beyond tenant settings and cost rates. Any member can create and publish automations (outbound HTTP, webhooks), delete records, and edit pipelines and catalog. | `routes/workflows/*`; `requireOrgRole` used only in `tenants/index.ts` and `member-rates.ts` | ◐ |
| **ONB-11** | 🟡 Medium | **Secrets in run logs.** `redact()` checks top-level keys only, and `http.request.headers` is a nested `keyValue`, so `Authorization` header values are persisted in `node_execution_logs.resolved_params`. | `engine/node-executor.ts:404-415`, `registry/integration/http-request.ts:82-83` | ✔ |
| **ONB-12** | 🟡 Medium | **`db:push` is still enabled,** and 21 indexes exist only in migrations, not in the Drizzle schema. A push could propose dropping them. The Neon baseline was itself built by `db:push`, so some April indexes may never have existed. | `packages/database/package.json`; the schema/migration index diff | ◐ |
| **ONB-13** | 🟡 Medium | **Duplicate enrolment is mis-detected.** `isUniqueViolation` checks `err.code`, else whether the message contains `"23505"`. A drizzle `DrizzleQueryError` has neither (its message is `Failed query: …`), so a concurrent duplicate surfaces as a failure. | `engine/execute.ts:614-622` | ✔ logic, ◐ wrapper behaviour |
| ONB-14 | 🟡 Medium | **Deletes cascade history away.** Deleting a **customer** cascades its invoices *and payments*, quotes and equipment. Deleting a **user** cascades their `job_time_entries`, which rewrites historic labour cost. | `schema/{jobs,invoices,costing}.ts` FK options | ◐ |
| ONB-15 | 🟡 Medium | **Engine operational gaps:** <br>• Executions stuck in `running` are never reaped, and the concurrency quota counts `running` + `waiting`. <br>• `withTimeout` is a `Promise.race`, so side effects continue after a timeout. <br>• Resume ignores `isActive`, so switching an automation off does not stop paused runs. <br>• Webhook runs execute inline in the HTTP request (up to 5 min) with no idempotency. <br>• `workflow.run` nesting double-increments its depth. <br>• Sweeps `LIMIT 501` without skipping already-deduped rows, so the tail can starve. <br>• Date triggers ignore `leadDays`. | `engine/{quotas,errors,resume}.ts`, `workflow-webhook.ts:143`, `executors/workflow-run.ts`, `sweeps/*` | ◐ |
| ONB-16 | 🟡 Medium | **E-09 renewal and E-10 trial crons claim rows with select-then-stamp,** which is not atomic, so two instances would double-send. Shutdown does not stop the schedule worker, the email crons or the time sweep. | `lib/cron/email-cron.ts`; `server.ts:345-352` | ◐ |
| ONB-17 | 🟢 Low | **Chatbot:** <br>• Unsanitised history allows forged assistant turns. <br>• The rate limit is in-memory per serverless instance. <br>• `create_booking` creates a calendar event. <br>• History is shared in localStorage across users on one device. | `app/api/chat/route.ts`, `lib/chatbot/action-executor.ts:127` | ✔ (booking) / ◐ |
| ONB-18 | 🟢 Low | **Middleware loop and lost filters.** A stale cookie bounces between `/login` and `/dashboard`, because middleware trusts the cookie and the layout rejects the session. `callbackUrl` also drops the query string. | `middleware.ts`, `(dashboard)/layout.tsx` | ◐ |

**Resolution (2026-10-16):** ONB-01…09 are closed — eight fixed, and ONB-01 needed no change. The
record is in [[todo]] under Completed. Two of them changed shared contracts that are worth
knowing about: `schedule.daily`/`schedule.weekly` payloads now carry `workflowId` and
`triggerNodeId` (they are delivered to one trigger step, not broadcast), and `execute()` takes an
optional `triggerNodeId`. ONB-10…18 are still open.

## Performance concerns
- **Render free plan** (`render.yaml:20`) ✔ spins down when idle. Every cron, outbox worker, resume worker and schedule clock is an in-process `setInterval`, so all of them **pause while the instance sleeps**. Delays resume late and schedules miss their 15-minute grace window. The keep-alive depends on an external pinger nobody can see from the repo.
- **Single-instance design:** the SSE bus, analytics cache, chatbot and webhook rate limits are all in-process. Scaling the API horizontally breaks realtime and caching silently.
- **The chatbot inlines the whole 1,279-line knowledge base** into every system prompt (`lib/chatbot/ai-tools.ts:37`) ◐, so every chat message pays for it in tokens and latency.
- **The running-timer bar polls every 60s on every dashboard page** for every user (`use-job-time.ts:44`) ◐.
- **Missing indexes** ◐: `tenants.organization_id` (looked up about 11 times), `job_photos.job_id`, `checklist_items.template_id`, `refrigerant_logs.*`, `customer_tags.tag_id`, and none at all on `admin_audit_log`.
- **Webhook-triggered runs** hold the request open for up to 5 minutes (ONB-15).

## Security issues
In priority order:
1. **ONB-02** (unsubscribe, compliance)
2. **ONB-05** (SSRF)
3. **ONB-08 / ONB-09** (impersonation consent, SSE override)
4. **ONB-10** (no in-tenant authorization)
5. **ONB-11** (secrets in logs)

Also:
- **No Content-Security-Policy** ✔ (`next.config.mjs` sets every other required header).
- **RLS is off,** so tenant isolation rests on every query being written correctly. The audits swept this repeatedly; 0 violations were recorded at the last sweep 📄.
- `messages.tenant_id` has no FK, and `customer_tags`, `notification_reads` and `notification_deliveries` have no `tenant_id` ◐.
- The strict auth rate limit compares the raw `req.url`, so a percent-encoded `/api/auth/%73ign-in` may fall into the 120/min bucket ◐.
- **Audited clean** 📄: 0 `sql.raw`, all ~60 `db.execute` calls are tagged templates, `escapeLike` is on every `ilike`, and public quote tokens are `randomUUID()`.

## Complex areas
Change these with care:
- **Workflow engine.** Node ids are hand-kept in **four** lists (registry, `EXECUTORS`, `ACTIVE_NODES`, `RELEASED_NODE_IDS`). Handle names (`main`/`loop`/`done`) and `startsWith("trigger.")` are string seams. The parameter-wiring test is a one-way regex, and it missed `leadDays`.
- **The job stage model:** `status` text, `stage_id` and `lifecycle`, with four previous stage writers consolidated into one.
- **The invoice money model:** derived status, credit, and payments under `FOR UPDATE`.
- **The availability resolver:** three occupancy sources, capacity, overrides and timezones.
- **The costing laterals.**
- **Impersonation.**
- **Migrations:** applied state lives only in prose.

## Missing tests
- **CI runs no tests at all** ✔. 21 test files exist: 5 API unit, 9 API integration, 1 web, 6 workflow-nodes.
- **Whether the suite has ever passed is unclear.** `todo.md` says on 2026-08-15 both "`pnpm test` has still never run" and "`test` 235/235 still pass" 📄. Treat it as unproven until CI runs it.
- `job-time.integration.test.ts` and `job-move-stage.integration.test.ts` are recorded as never executed 📄.
- **There are no route-level or guard tests.** Nothing tests tenant isolation, `requireOrgRole`, impersonation, the public endpoints, rate limits or the middleware. Every ONB finding above would have been caught by one of those.
- No e2e tests (Playwright is not installed), no web component tests beyond one node-coverage test, and no email rendering tests.
- The 2026-08-06 security fix's regression test (the denylist in four normalisation forms) is still unwritten 📄.

## Documentation drift
The docs are unusually thorough, but they disagree with each other and with the code:
- **Stale descriptions of the stack:**
  - `README.md` still lists Supabase, Lemon Squeezy, Mapbox, pdfkit and `packages/ui`.
  - `docs/PROJECT_MAP.md` (06-23) says "Supabase Postgres".
  - `docs/PROJECT_ANALYSIS.md` is the April inventory.
- **Stale progress records:**
  - The **`wf-PROGRESS.md` START HERE block is dated 2026-08-09** and says P9/P10 are not started; `todo.md` is newer.
  - `reports/architecture.md`'s own header says "all OPEN" while the index says 14 fixed.
- **Contradictory migration records:**
  - `todo.md` says migration `20260815000001` is both "not applied" (In Progress) and "applied 22/22" (Completed).
  - Similar stale "not applied" notes exist for `20260807000003`, `20260727000001` and the invoices migration ◐.
- **Stale comments in code:**
  - `server.ts` says jobs is 2,497 lines (it is 1,860) and "~200 endpoints" (263).
  - The `api-fetch.ts` header reads as though the migration is finished.
  - The CI comment says "zero test files".
  - `apply-migration.mts` says 32 unjournaled files; the real number is 45.

## Process observations (from git)
- **Unreviewed changes:** 9 engine commits, including **2 migrations**, landed directly on `main` between PR #17 and #18 without a PR (`eb57a3a` … `ebb2232`). So did `02d4441`, a 102-file "Update" carrying a whole audit, ADR-002 and the deletion of `packages/ui`.
- **Repository hygiene:** `7f5055a` committed `.pyc` files under `.claude/skills`.
- **Concentrated churn:** `apps/web/src/lib/chatbot/knowledge-base.ts` is the most-churned file (24 commits since 07-27), followed by `server.ts` (12) and `routes/jobs/index.ts` (10).

---

## "What Changed Since I Last Looked At This Project?"

The baseline is the last time the project had a full inventory: **2026-04-15/17**
(`docs/PROJECT_ANALYSIS.md`, commit `3d53844`). Little happened between then and late July: one
docs-only commit on 06-23. **Everything below happened between 2026-07-27 and 2026-08-15**, and
**nothing has been committed since**.

### 1. The platform underneath changed
- **Supabase is gone** (ADR-001, PR #15 `d29e451`).
  - Postgres now runs on **Neon**, and files on **Cloudflare R2**: two buckets, private for invoices and quotes, streamed through the API (`apps/api/src/lib/storage.ts`).
  - Realtime is now **SSE** (`lib/event-bus.ts`, `routes/events/index.ts`, `apps/web/src/lib/event-stream.ts`).
  - The old Supabase channels had **no authorization**; the new stream is session-scoped.
  - `@supabase/supabase-js` was removed everywhere.
- **It became deployable** (`fd85ad0`).
  - The API runs on Render, starting with `tsx` and no build step; the web app runs on Vercel.
  - Browser traffic for `/api/auth/*` and `/events` is rewritten to the web origin, so cookies are first-party.
  - CI runs typecheck and lint.
- **The dev loop was repaired.** The API had silently stopped booting under turbo; `dev` is now `node --watch --import tsx` (`cb8337e`).
- **Database workflow:** `pnpm db:apply` is the supported migration path, and `db:migrate` is disabled (`662fffb`, `719332c`).
- **Tooling now exists.**
  - A vitest harness that rolls back against the real database (`apps/api/src/test/db.ts`).
  - **ESLint for the first time**, with rules for this repo's recurring mistakes (`packages/config/eslint.config.js`).
  - `pnpm seed:demo`.

### 2. Every core page was audited and rebuilt around shared modules
Seven audits covered Dashboard, Reports, Bookings & Calendar, Customers, Jobs, Invoices and
Quotes. They found 291 defects, and all are recorded fixed (`docs/claude/reports/*`). A cross-cutting
architecture audit added 21 more, with 14 fixed. The lasting result is a set of
**single sources of truth** that did not exist in April:

| Concern | Now lives in |
|---|---|
| Job stage / lifecycle | `services/job-stages.service.ts`, `job_pipeline_stages.lifecycle`, `jobs.stage_id` |
| Every job write (HTTP **and** automations) | `services/jobs/jobs.service.ts` |
| Invoice status | `services/invoices/status.service.ts` (derived from payments) |
| Quote transitions | `lib/quote-guards.ts` |
| Availability / slots | `services/availability.service.ts` |
| Cross-tenant FK checks | `lib/tenant-guards.ts` |
| "Can this record be edited?" | `lib/{job,invoice,quote}-guards.ts` (`loadEditable*`) |
| Upload limits | `lib/upload-limits.ts` |
| Error responses | `lib/error-handler.ts` (5xx no longer leaks SQL) |
| Email consent | `lib/email-consent.ts` |
| Web fetch path | `lib/api-fetch.ts` (ADR-002; adoption 4/24) |

### 3. Workflows that behave differently than in April
- A job's column is changed **only** through `PATCH /jobs/:id/status`, and that now enforces:
  - the checklist gate;
  - the E-05 email, the notification and the activity row;
  - stopping timers.

  `/reorder` sorts only, and `PATCH /jobs/:id` no longer accepts `status`.
- **Invoice status cannot be set to paid or partially paid by hand;** payments decide it.
- **Hours are no longer typed.** The Costs tab's hours box is gone, and `PATCH /jobs/:id/labor` was removed. Hours come from time entries.
- **Bulk endpoints** now report per-record `{id, message}` errors, and toasts reflect partial failure (`lib/bulk-toast.ts`).
- **Customer emails respect opt-out** (`canEmailCustomer`, with `purpose` required). Note: the unsubscribe page itself is unreachable (ONB-02).
- **Date ranges** on the dashboard and reports persist exactly as picked.
- **Quote expiry** is an hourly sweep in tenant time, not a write on every GET.

### 4. Three new products
1. **Job Costing & Profitability** (`53e7eb5`): expenses, member cost rates, a Costs tab with a cost-stack bar, and a profitability report that *excludes* incompletely-costed jobs rather than averaging them in.
2. **Automations** (`c939864` → `662fffb`):
   - New package `packages/workflow-nodes`, 11 new tables, 6 workflow migrations, 24 + 1 endpoints, 3 pages, a React Flow builder.
   - 54 nodes, 38 events, 10 templates.
   - A transactional outbox, durable waits, goals, version pinning, retention, webhooks, schedules, and outbound HTTP behind an SSRF guard.
3. **Job Time Tracking** (PR #19 `6db2f52`): a running timer on every page, a Time tab, and per-entry rate snapshots.

### 5. Removed
- `packages/ui` (it was `export {}`) and `apps/web/src/hooks/use-admin.ts` (21 hooks, 0 callers) (`02d4441`).
- The `chart.js`, `react-chartjs-2`, `lucide-react`, `radix-ui` meta-package and `react-device-frameset` dependencies.
- The global fetch progress bar and `page-header.tsx` (`291bbe3`, `a78f1f4`).
- The settings `use-org-role.ts` client fetch (`5db267b`).

### 6. By the numbers

| | April 2026 | Now | Source |
|---|---|---|---|
| API route files | 31 | **41** | ✔ `find routes -name '*.ts'` |
| API endpoints | "100+" | **263** (+ auth proxy, `/health`) | ◐ |
| Zod schema files | 22 | **27** | ✔ |
| Web pages | ~48 | **53** | ✔ |
| Server-action files | 20 | **24** | ✔ |
| Tables / enums | 30+ / 17 | **64 / 28** | ✔ `pgTable(` / `pgEnum(` |
| Migrations (SQL) | 42 | **55**; the journal knows 10 | ✔ |
| Email templates | 14 | **16** (E-01 … E-15 + team invite) | ✔ |
| Test files | 0 | **21** (not run in CI) | ✔ |
| Workspace packages | 5 incl. `ui` | 5: `config`, `database`, `email`, `types`, **`workflow-nodes`** | ✔ |

### 7. What did *not* change, and is still open
- **No email has ever been delivered** (no verified Resend domain).
- **R2 buckets** for `quotes` and `job-attachments` are still listed as to-do 📄.
- **Billing, subscriptions and affiliates** have not been started.
- **ARC-01/02/05/07/09** are open.
- **Assets, Catalog, Checklists and Service Agreements** have never been audited.
- **The newest work has not been executed:** P7b–P10, time tracking, and `pnpm test` in CI.

### Recommended first moves
1. Check whether `job_time_entries` exists in Neon. If not, apply `20260815000002` with `pnpm db:apply` (ONB-01).
2. Add `/unsubscribe` and `/invite` to the public paths, and add `/blog`, `/robots.txt`, `/sitemap.xml` and `/widget.js` too. Then scope `X-Frame-Options` so `/book/*` can be framed (ONB-02/03/04).
3. Add `pnpm test` to `.github/workflows/ci.yml`. Then write the missing guard and middleware tests, which would have caught ONB-02/03/08/09.
4. Fix the SSRF validator to normalise hex-mapped IPv6 (ONB-05), and recurse `redact()` into nested params (ONB-11).
5. Fix the schedule dedup key and trigger-node selection (ONB-06/07) before anyone builds a second scheduled automation.
6. Refresh the `wf-PROGRESS` START HERE block and the contradictory lines in `todo.md`, so the next reader is not misled.
