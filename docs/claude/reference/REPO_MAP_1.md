# REPO_MAP.md — HVAC SaaS Platform (Zaxvio CRM)

> **Part 1 of 2** — Root config, apps (API + web), routes, components
> - [[REPO_MAP_1|Part 1]]: Root config, API routes, web app structure, components *(this file)*
> - [[REPO_MAP_2|Part 2]]: Packages, database schema, auth architecture, build progress

> **Product**: HVAC Field Service Management SaaS for solo contractors (1-3 person teams)
> **Stack**: Next.js 14 + Fastify + Neon Postgres + Drizzle ORM + Better Auth + Cloudflare R2 + Lemon Squeezy
> **Monorepo**: Turborepo + pnpm workspaces
> **Subscription**: $49/month per tenant

> **Legend**: `+` = exists and implemented | `~` = folder exists but empty/placeholder | `-` = planned, not yet created

> **RULE**: When ANY file or folder is created, renamed, moved, or deleted — update this map immediately in the same PR/commit. Treat this like updating `docs/todo.md` and `docs/lessons.md`.

---

## Root Configuration

```
zaxvio-crm/
+-- package.json              # Root scripts: dev, build, lint, typecheck, test, db:*, seed:admin
+-- pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
+-- turbo.json                # Pipeline: build, lint, typecheck, test, dev
+-- tsconfig.json             # Base TS config (ES2022, strict)
+-- .prettierrc               # Semi, double quotes, trailing comma, width 100
+-- .npmrc                    # auto-install-peers, no strict peer deps
+-- .env                      # BACKEND ONLY — DATABASE_URL (Neon) + Better Auth + Resend + Cloudflare R2 (not committed)
+-- .env.example              # Template for the backend env. Frontend has its own: apps/web/.env.example
+-- .gitignore
+-- CLAUDE.md                 # AI assistant instructions + strict rules
+-- README.md
+-- pnpm-lock.yaml
|
+-- docs/
|   +-- todo.md               # Task tracking (In Progress / Upcoming / Done)
|   +-- lessons.md            # Non-obvious insights and patterns
|   +-- materials/
|   |   +-- frontend_materials.md
|   +-- project_docs/
|       +-- HVAC_SaaS_Phase1_PRD_v2.md                          # PRD (source of truth)
|       +-- HVAC_SaaS_System_Diagrams_and_Unified_Auth.md       # Architecture diagrams
|       +-- HVAC_Saas_Proposal.md                               # Business proposal
|       +-- REPO_MAP.md                                         # <-- This file
|
+-- scripts/
|   +-- memory/
|       +-- consolidate-memory.mjs    # Memory consolidation script
|       +-- install-memory-task.bat   # Windows scheduled task installer
|       +-- long-term-memory.md       # Stable facts, preferences (gitignored)
|       +-- project-memory.md         # Active project snapshot (gitignored)
|       +-- recent-memory.md          # Rolling 48hr summaries (gitignored)
|
+-- skills/
|   +-- consolidate-memory.md         # Claude skill for in-session memory consolidation
|
+-- supabase/
    +-- migrations/
        +-- 0000_amused_shape.sql                    # Initial schema (30KB)
        +-- 0001_fearless_risque.sql                 # Tenant organizationId NOT NULL
        +-- 0002_lucky_roulette.sql                  # Schema modifications
        +-- 0003_living_nitro.sql                    # Pipeline stages
        +-- 0004_add_default_tax_rate.sql            # Tax rate on tenants
        +-- 0004_skinny_sentinel.sql                 # Additional changes
        +-- 0005_add_pipeline_stages.sql             # Pipeline stages table + enum-to-text
        +-- 0006_add_invoice_settings.sql            # 5 invoice setting columns
        +-- 0007_add_quote_settings.sql              # Quote terms/footer columns
        +-- 0008_add_quote_activities.sql            # Quote activity log table
        +-- 20260314000001_rls_triggers.sql          # RLS policies + triggers
        +-- 20260315000001_drop_rls_for_better_auth.sql  # Drop RLS (app-level isolation)
        +-- 20260315000002_triggers.sql              # Auto-numbering + updated_at triggers
        +-- 20260329000001_admin_tier_and_system_tables.sql  # Admin tier enum + system health tables
        +-- 20260329000002_add_is_owner_column.sql           # Owner flag on org members
        +-- 20260329000003_visible_impersonation.sql         # Visible impersonation support
        +-- 20260331000001_set_org_creator_owner_role.sql    # Auto-set owner role on org creation
        +-- 20260331000002_add_email_tracking_fields.sql     # Email tracking columns
        +-- 20260331000003_fix_refrigerant_logs_job_fk.sql   # Fix refrigerant_logs.job_id FK + nullable
        +-- 20260331000004_add_service_frequency.sql         # Service frequency enum + column
        +-- 20260331000005_add_equipment_id_to_jobs.sql      # Equipment reference on jobs
        +-- 20260402000001_add_multi_pipelines.sql   # Multi-pipeline: pipelines table, FK on stages+jobs, data migration
        +-- 20260404000001_add_sort_order_to_jobs.sql # Sort order column on jobs
        +-- 20260405000001_add_booking_source.sql     # Booking source column
        +-- 20260405000002_job_attachments.sql        # Photo tags, job documents table
        +-- 20260406000001_add_conversations.sql      # Conversations + messages tables
        +-- 20260407000001_add_assignee_to_jobs.sql   # Assignee FK on jobs
        +-- 20260410000001_add_archived_at.sql        # archived_at column on 6 tables + partial indexes
        +-- 20260727000001_booking_calendar_audit.sql # FK on jobs.booking_id, tenants.booking_slot_capacity,
        |                                             # backfill of bookings.converted_to_job_id
        +-- 20260729000001_jobs_audit_stage_split.sql # job_pipeline_stages.lifecycle + jobs.stage_id (FK,
        |                                             # ON DELETE SET NULL) + backfill; FKs on
        |                                             # calendar_events.job_id and job_documents.customer_id;
        |                                             # job_line_items.updated_at. Applied to Neon by hand
        +-- meta/                                    # Drizzle snapshots + journal
```

---

## Apps

### `apps/api/` — Fastify Backend (Port 4000)

REST API server. Multi-tenant middleware, Better Auth, PDF generation, dashboard stats.

```
apps/api/
+-- package.json              # deps: fastify, @fastify/cors, better-auth, @react-pdf/renderer, etc.
+-- tsconfig.json             # jsx: "react-jsx" (for PDF rendering)
+-- src/
|   +-- server.ts             # Entry point — Fastify with CORS, Swagger, Better Auth mount, routes
|   |
|   +-- lib/
|   |   +-- auth.ts               # Better Auth server config (drizzle adapter, org + admin plugins)
|   |   +-- auth-middleware.ts     # requireAuth, requireAdmin, requireAdminTier(), requireTenant preHandlers
|   |   +-- env.ts                 # Zod-validated env loading (dotenv from monorepo root)
|   |   +-- timezone.ts           # THE tz module: todayInTimezone() + getTenantToday/Tomorrow,
|   |   |                         # getMaxBookingDate(), getDayOfWeek(), formatDateInTimezone()
|   |   |                         # (customer emails stamped the *server's* date). analytics re-exports
|   |   +-- job-helpers.ts        # attachChecklistToJob(), deleteJobAttachments(),
|   |   |                         # countLinkedInvoices(), sendJobCompletionEmailFor() — the side
|   |   |                         # effects single and bulk job endpoints must share
|   |   +-- job-guards.ts         # loadEditableJob()/assertEditable() (archived-job guard, was on
|   |   |                         # 4 of 14 mutating handlers) + findForeignRef()/ownsX() tenant checks
|   |   +-- upload-limits.ts      # UPLOAD_LIMITS + bodyLimitFor() so the number a handler enforces
|   |   |                         # and the number Fastify enforces cannot drift; MIME allowlist
|   |   +-- invoice-guards.ts     # loadEditableInvoice()/assertPayable()/assertDraft() + the FK
|   |   |                         # ownership checks. No mutating invoice handler checked archivedAt,
|   |   |                         # and a draft could take a payment and email a receipt (INV-01)
|   |   +-- admin-audit.ts        # logAdminAction() — append-only audit log helper
|   |   +-- plan-prices.ts        # PLAN_PRICES map, getPlanPrice() for MRR calculations
|   |   +-- platform-events.ts    # emitPlatformEvent() — fire-and-forget activity tracking
|   |   +-- notifications.ts      # dispatchNotification() — multi-channel dispatch (in-app, email, SMS stub, voice stub)
|   |   +-- storage.ts            # Cloudflare R2 (S3-compatible): uploadFile/downloadFile/deleteFiles/getPublicUrl
|   |   +-- event-bus.ts          # In-process pub/sub backing the SSE stream (replaced Supabase Realtime)
|   |   +-- search.ts             # escapeLike()/containsPattern() — LIKE metacharacters are operators,
|   |   |                         # so an unescaped `%` matched every row. Was private to routes/jobs
|   |   +-- schemas/              # One Zod schema file per domain (see api-rules §2)
|   |   |   +-- common.ts          # idParam, paginationQuery + isoDate/isoTime/isoMonth/boundedText.
|   |   |   |                      # The iso* guards keep Postgres magic strings ('infinity',
|   |   |   |                      # 'today', 'epoch') out of every ::date / ::time cast
|   |   |   +-- bookings.ts        # + bookingStatusSchema, shared by route and service
|   |   |   +-- calendar-events.ts # + colour enum, endTime-after-startTime refinement
|   |   |   +-- availability.ts    # weekly schedule + overrides + slotCapacity
|   |   |   +-- public-booking.ts  # The hardened public submit body
|   |   |   ~ ...one file per remaining domain
|   |   +-- db/
|   |   |   +-- tenant-scope.ts    # tenantFilter() helper for app-level tenant isolation
|   |   +-- pdf/
|   |   |   +-- logo.ts                  # safeLogoUrl()/withSafeLogo(): a tenant logo must be an R2 URL
|   |   |   |                            # under that tenant's own prefix. @react-pdf/renderer fetches a
|   |   |   |                            # remote <Image src> from the API process, so an arbitrary
|   |   |   |                            # logoUrl was a blind SSRF probe on both documents (INV-05)
|   |   |   +-- generate-invoice-pdf.ts  # Invoice PDF generation entry point
|   |   |   +-- generate-quote-pdf.ts    # Quote PDF generation entry point
|   |   |   +-- invoice-pdf.tsx          # Invoice PDF template — VOID watermark, credit row, exact tax
|   |   |   |                            # %, tz-safe dates, thousands separators
|   |   |   +-- quote-pdf.tsx            # Quote PDF React template (@react-pdf/renderer)
|   |   +-- cron/
|   |       +-- email-cron.ts      # E-07 overdue, E-09 renewal, E-10 trial, E-12 review request.
|   |                              # Each processor CLAIMS its rows with one UPDATE…RETURNING before
|   |                              # sending, so N instances split the work instead of duplicating it,
|   |                              # and a crash-loop is no longer a mailing-loop. sendOverdueReminder()
|   |                              # backs the manual POST /invoices/:id/remind
|   |
|   +-- routes/
|   |   +-- availability/
|   |   |   +-- index.ts          # GET/PUT /availability (+ slotCapacity), POST/DELETE /availability/overrides
|   |   +-- bookings/
|   |   |   +-- index.ts          # GET/PATCH/DELETE /bookings, /stats, /:id/activities, convert-to-job, 4 bulk ops
|   |   +-- catalog/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /catalog (+ /categories)
|   |   +-- checklists/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /checklists (templates + items)
|   |   +-- customers/
|   |   |   +-- index.ts          # 20 endpoints: CRUD, stats, check-duplicate, :id/summary, 3 bulk ops,
|   |   |                         # notes, activities, tags, photos. DELETE counts ARCHIVED jobs too —
|   |   |                         # jobs.customer_id is ON DELETE CASCADE, so skipping them destroyed data
|   |   +-- dashboard/
|   |   |   +-- index.ts          # GET /dashboard/stats (21 parallel SQL queries) + GET /dashboard/pipeline
|   |   +-- invoices/
|   |   |   +-- index.ts          # 22 endpoints: CRUD, line items, payments (+ pay-in-full), PDF, send,
|   |   |                         # remind, void, status, 4 bulk ops, from-job. Thin — the money maths,
|   |   |                         # the transitions and the PDF all live in services/invoices/
|   |   +-- jobs/
|   |   |   +-- index.ts          # 15 endpoints: CRUD, line items, checklist, photos, activities
|   |   +-- pipelines/
|   |   |   +-- index.ts          # CRUD /pipelines (list, create, update, delete)
|   |   +-- pipeline-stages/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /pipeline-stages + /reorder
|   |   +-- public/
|   |   |   +-- booking.ts        # Public booking portal API (no auth): branding, availability, slots, submit
|   |   +-- quotes/
|   |   |   +-- index.ts          # 13 endpoints: CRUD, line items, PDF, send, accept, convert-to-job
|   |   +-- tags/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /tags (tenant-level reusable tags)
|   |   +-- tenants/
|   |   |   +-- index.ts          # GET/PATCH /tenants/current, POST /tenants/initialize (+availability seeding)
|   |   +-- calendar-events/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /calendar-events
|   |   +-- equipment/
|   |   |   +-- index.ts          # CRUD /equipment, sub-resource /equipment/:id/refrigerant-logs, /equipment/:id/history
|   |   +-- maintenance-contracts/
|   |   |   +-- index.ts          # CRUD /maintenance-contracts, GET /maintenance-contracts/expiring
|   |   +-- notifications/
|   |   |   +-- index.ts          # 6 endpoints: GET list, GET unread-count, PATCH read, PATCH read-all, GET/PATCH preferences
|   |   +-- conversations/
|   |   |   +-- index.ts          # Messaging endpoints (list, detail, send, mark-read, etc.)
|   |   +-- events/
|   |   |   +-- index.ts          # GET /events — SSE stream (text/event-stream), tenant-scoped; ?tenantId= admin-only
|   |   +-- reports/
|   |   |   +-- index.ts          # GET /reports/stats?section=&from=&to=&granularity= — one endpoint, 5 sections
|   |   +-- admin/                 # Super admin API routes (prefix: /admin)
|   |   |   +-- index.ts          # Master plugin, registers sub-routes
|   |   |   +-- tenants.ts        # 8 endpoints: list, detail, deactivate, activate, extend-trial, override-sub, edit, delete
|   |   |   +-- analytics.ts      # 7 endpoints: MRR, signups, active-users, churn, trial-conversion, inactive-alerts, feature-adoption
|   |   |   +-- audit.ts          # 3 endpoints: audit-log, impersonation-log, tenant activity
|   |   |   +-- impersonation.ts  # 5 endpoints: start, request, end, cancel, active — ghost + visible impersonation
|   |   |   +-- search.ts         # 1 endpoint: global cross-tenant search
|   |   |   +-- system.ts         # 3 endpoints: health, webhooks, crons
|   |   |   +-- admins.ts         # GET /admin/admins (super admin user management)
|   |   |   +-- dashboard.ts      # GET /admin/dashboard/stats
|   |   +-- webhooks/
|   |       ~ .gitkeep            # Planned: Lemon Squeezy subscription events
|   |
|   +-- plugins/
|   |   ~ .gitkeep                # Planned: custom Fastify plugins
|   +-- services/                 # Business logic — route handlers stay thin
|   |   +-- availability.service.ts   # THE availability resolver: windows (weekly + overrides),
|   |   |                             # slot generation, occupancy across bookings+jobs+events,
|   |   |                             # checkSlotBookable(). Used by portal, calendar and reschedule
|   |   +-- bookings.service.ts       # Booking status transition table (single + bulk share it)
|   |   +-- invoices/
|   |   |   +-- status.service.ts     # THE invoice state machine: transition table, deriveStatus()
|   |   |   |                         # (status follows the payment rows), splitPayment() -> credit
|   |   |   |                         # instead of clamping, overdueCondition() shared by list/stats/
|   |   |   |                         # cron, dueDateFromTerms() so "Net 30" finally sets a due date
|   |   |   +-- invoices.service.ts   # recalculateInvoice() (totals AND status), recordPayment()/
|   |   |   |                         # deletePayment() in one transaction with the row locked,
|   |   |   |                         # copyJobLineItems(), findActiveInvoiceForJob()
|   |   |   +-- pdf.service.ts        # loadPdfBundle/renderInvoicePdf/storeInvoicePdf +
|   |   |                             # contentDisposition() (header injection, security-rules §6)
|   |   +-- job-stages.service.ts     # THE stage resolver: resolveStage/matchStage by id-or-name,
|   |   |                             # canTransition() keyed on stage.lifecycle (not on status),
|   |   |                             # stageUpdate() -> {stageId,status,completedAt}. One place a
|   |   |                             # job changes column; makes custom stages reachable
|   |   +-- conversations.service.ts
|   |   +-- notifications.service.ts
|   |   +-- analytics/
|   |       +-- types.ts          # DateRangeParams, tz helpers, bucketCount, compare-window maths
|   |       +-- helpers.ts        # pInt/pFloat + label maps
|   |       +-- schemas.ts        # Zod schemas for every raw-SQL row shape
|   |       +-- cache.ts          # TTL cache: SWR, in-flight dedup, 500-entry bound
|   |       +-- dashboard.service.ts   # /dashboard/stats aggregator (21 queries)
|   |       +-- reports.service.ts     # /reports/stats — one section per call, exhaustive union
|   |       +-- queries/
|   |           +-- buckets.ts         # Shared generate_series bucketing (day/week/month)
|   |           +-- revenue.ts         # Payment-sourced; deliberately NO archived filter
|   |           +-- jobs.ts
|   |           +-- customers.ts
|   |           +-- quotes-invoices.ts
|   |           +-- bookings.ts
|   |           +-- dashboard-only.ts
|   +-- jobs/
|   |   ~ .gitkeep                # Planned: background cron runners
|   +-- scripts/
|       +-- seed-admin.ts         # Seed super admin from env vars (idempotent)
|       +-- seed-demo-data.ts     # Seed one tenant with a working dataset (pnpm seed:demo [-- --reset])
|       +-- seed-demo-dataset.ts  # The demo content itself — pure data, no DB access
|
+-- tests/
    +-- integration/
    |   ~ .gitkeep
    +-- unit/
        ~ .gitkeep
```

**API Route Summary:**

| Route Group | Auth | Endpoints | Status |
|---|---|---|---|
| `/api/auth/*` | None -> Session | Better Auth (signup, signin, signout, session, org) | + |
| `/tenants` | requireAuth | GET/PATCH current, POST initialize | + |
| `/customers` | requireTenant | CRUD + notes, activities, tags | + |
| `/catalog` | requireTenant | CRUD + categories | + |
| `/checklists` | requireTenant | Templates + items CRUD | + |
| `/jobs` | requireTenant | CRUD + line items, checklist, photos, activities | + |
| `/pipelines` | requireTenant | CRUD (list, create, update, delete) | + |
| `/pipeline-stages` | requireTenant | CRUD + reorder | + |
| `/invoices` | requireTenant | CRUD + line items, payments, pay-in-full, PDF, send, remind, void, status, bulk, from-job | + |
| `/quotes` | requireTenant | CRUD + line items, PDF, send, accept, convert-to-job | + |
| `/tags` | requireTenant | CRUD (tenant-level) | + |
| `/dashboard/stats` | requireTenant | GET stats (21 parallel queries) | + |
| `/dashboard/pipeline` | requireTenant | GET stage distribution for one pipeline | + |
| `/availability` | requireTenant | GET/PUT weekly schedule + slotCapacity, POST/DELETE overrides | + |
| `/bookings` | requireTenant | CRUD, /stats, /:id/activities, convert-to-job, 4 bulk ops | + |
| `/calendar-events` | requireTenant | CRUD for standalone calendar entries (occupy portal slots) | + |
| `/public/booking/:slug` | None | Branding, availability, slots, submit, status. Rate-limited 60/5/10 per min | + |
| `/equipment` | requireTenant | CRUD + refrigerant logs sub-resource + history | + |
| `/maintenance-contracts` | requireTenant | CRUD + expiring contracts | + |
| `/calendar-events` | requireTenant | CRUD | + |
| `/conversations` | requireTenant | Messaging: list, detail, send, mark-read | + |
| `/reports/stats` | requireTenant | GET one section (revenue/jobs/customers/quotes-invoices/bookings), 10min cache | + |
| `/admin/*` | requireAdmin | Tenant mgmt, analytics, audit, impersonation | + |
| `/webhooks/lemon-squeezy` | Signature | Subscription lifecycle | ~ |

---

### `apps/web/` — Next.js 14 Frontend (Port 3000)

Unified app: landing page + auth + tenant dashboard + super admin panel + public booking portal.

```
apps/web/
+-- package.json              # deps: next, better-auth, @tabler/icons-react, recharts, etc.
+-- tsconfig.json
+-- .env.local                # FRONTEND ONLY — Next.js reads .env* from this folder, never the root .env (not committed)
+-- .env.example              # Template for the frontend env
+-- next.config.mjs           # staleTimes + instrumentationHook: true (required on Next 14 for instrumentation.ts)
+-- tailwind.config.ts
+-- public/
|   +-- assets/
|       +-- icon.png
|       +-- logo.png
+-- src/
    +-- middleware.ts          # Route protection: public paths passthrough, else check session cookie
    |
    +-- actions/              # Server Actions — ONLY gateway for API calls
    |   +-- admin.ts             # Super admin actions
    |   +-- bookings.ts          # 13 actions: tenant CRUD + availability + public portal
    |   +-- calendar-events.ts   # Calendar event CRUD
    |   +-- catalog.ts
    |   +-- checklists.ts
    |   +-- conversations.ts     # Messaging actions: list, detail, send, mark-read
    |   +-- customers.ts
    |   +-- dashboard.ts
    |   +-- equipment.ts         # Equipment/asset CRUD + refrigerant logs
    |   +-- invoices.ts
    |   +-- jobs.ts
    |   +-- maintenance-contracts.ts  # Service agreement CRUD + expiring
    |   +-- notifications.ts      # 6 actions: list, unread-count, mark-read, mark-all-read, get/update preferences
    |   +-- pipeline-stages.ts
    |   +-- pipelines.ts          # Pipeline CRUD (4 actions)
    |   +-- quotes.ts
    |   +-- reports.ts            # getReportStats -> ReportSectionResponse (union discriminated on `section`)
    |   +-- tags.ts
    |   +-- tenants.ts
    |
    +-- hooks/
    |   +-- use-view-preference.ts   # Persist Kanban/Table view toggle
    |   +-- use-row-selection.ts     # Multi-row selection state for bulk actions
    |   +-- use-notifications.ts     # Real-time notification hook (SSE + server actions)
    |   +-- use-event-stream.ts      # Subscribe to one SSE channel/event; replaces .channel().on("broadcast")
    |   +-- use-debounced-value.ts   # Generic debounce hook (value + delay → debounced value)
    |   +-- use-dashboard-widget-prefs.ts # Which dashboard widgets are visible (localStorage)
    |   +-- use-dashboard-date-range.ts   # Remembers the dashboard range; presets stored as presets
    |   +-- use-fill-viewport-height.ts   # Measured height so a panel runs to the fold (Kanban board)
    |   +-- queries/                 # TanStack Query hooks (one file per domain)
    |       +-- index.ts                       # Barrel export for all query hooks
    |       +-- use-customers.ts               # Customer queries & mutations
    |       +-- use-jobs.ts                    # Job queries & mutations
    |       +-- use-invoices.ts                # Invoice queries & mutations
    |       +-- use-quotes.ts                  # Quote queries & mutations
    |       +-- use-bookings.ts                # Booking queries & mutations
    |       +-- use-dashboard.ts               # Dashboard stats query
    |       +-- use-reports.ts                 # Reports query
    |       +-- use-pipelines.ts               # Pipeline queries & mutations
    |       +-- use-equipment.ts               # Equipment queries & mutations
    |       +-- use-catalog.ts                 # Catalog queries & mutations
    |       +-- use-checklists.ts              # Checklist queries & mutations
    |       +-- use-calendar.ts                # Calendar event queries & mutations
    |       +-- use-service-agreements.ts      # Service agreement queries & mutations
    |       +-- use-notifications.ts           # Notification queries & mutations
    |       +-- use-tenant.ts                  # Tenant settings query & mutation
    |       +-- use-tags.ts                    # Tag queries & mutations
    |       +-- use-conversations.ts           # Conversation queries & mutations
    |       +-- use-admin.ts                   # Admin panel queries & mutations
    |
    +-- lib/
    |   +-- env.ts                   # Zod-validated web env (getClientEnv/getServerEnv/validateEnv), run at boot
    |   +-- storage-url.ts           # Build public R2 URLs for job attachments
    |   +-- auth-client.ts           # Better Auth React client (signIn, signUp, signOut, useSession)
    |   +-- auth-server.ts           # Server-side session helper (forwards cookies for SSR)
    |   +-- event-stream.ts          # Shared SSE connection to /events (replaced Supabase Realtime); openTenantStream() for admins
    |   +-- format.ts                # formatCurrency(), formatMoney() (thousands separators — the
    |   |                            # invoice table and PDF each printed `$1234.50`), formatDateOnly()
    |   |                            # (a `date` column read a day early west of UTC), formatRelativeTime()
    |   +-- open-pdf.ts              # openPdfPayload() — the PDF used to be window.open()'d straight at
    |   |                            # the API origin, the one request relying on a cross-origin cookie
    |   +-- utils.ts                 # cn() helper (clsx + tailwind-merge)
    |   +-- query-keys.ts            # Centralized TanStack Query key factory for 18 domains
    |   +-- url-filters.ts           # Allow-listed ?status= reader for list-page deep links
    |   +-- entity-links.ts          # jobLink()/bookingLink()/invoiceLink()/quoteLink() — the ONE
    |   |                            # place a detail deep-link param name is spelled. Emitting
    |   |                            # ?job= at a page reading ?jobId= has now been a bug 3 times
    |   +-- tenant-time.ts           # tenantNow()/tenantToday()/isTenantToday() — the calendar renders
    |   |                            # in tenant wall-clock, so "today" must be resolved there too
    |   +-- phone.ts                 # normalizePhone()/formatPhoneDisplay()/formatPhoneInput() — the ONE
    |   |                            # phone module. Format for display, NEVER for storage: the four
    |   |                            # old copies truncated at 10 digits and killed every non-NANP number
    |   +-- bulk-toast.ts            # bulkToast() — renders {succeeded,failed,errors} honestly. No bulk
    |   |                            # endpoint returns `message`, so every hook's `res.message ?? "…"`
    |   |                            # silently reported success for records the server refused
    |   +-- constants/
    |       +-- booking-options.ts   # Booking status labels/colors, service type labels, day names
    |       +-- catalog-options.ts   # Catalog item types, units
    |       +-- job-options.ts       # Service types, priorities
    |       +-- stage-color-presets.ts  # 8 color presets for pipeline stages
    |
    +-- components/
    |   +-- auth-shell.tsx           # Split-panel auth wrapper (brand panel + form panel)
    |   +-- logo.tsx                 # Logo component
    |   +-- refresh-on-nav.tsx       # Fixes Next.js 14 back/forward stale cache
    |   +-- theme-provider.tsx       # next-themes wrapper
    |   +-- theme-toggle.tsx         # Light/dark toggle button
    |   +-- under-development.tsx    # Placeholder for unbuilt pages
    |   +-- query-provider.tsx       # QueryClientProvider wrapper with global TanStack Query defaults
    |   |
    |   +-- ui/                      # shadcn/ui primitives (28 components)
    |   |   +-- accordion.tsx
    |   |   +-- avatar.tsx
    |   |   +-- badge.tsx
    |   |   +-- button.tsx
    |   |   +-- calendar.tsx
    |   |   +-- card.tsx
    |   |   +-- chart.tsx
    |   |   +-- command.tsx
    |   |   +-- date-range-picker.tsx
    |   |   +-- dialog.tsx
    |   |   +-- dropdown-menu.tsx
    |   |   +-- input.tsx
    |   |   +-- label.tsx
    |   |   +-- popover.tsx
    |   |   +-- progress.tsx
    |   |   +-- scroll-area.tsx
    |   |   +-- select.tsx
    |   |   +-- separator.tsx
    |   |   +-- sheet.tsx
    |   |   +-- skeleton.tsx
    |   |   +-- switch.tsx
    |   |   +-- table.tsx
    |   |   +-- tabs.tsx
    |   |   +-- textarea.tsx
    |   |   +-- time-picker.tsx
    |   |   +-- date-picker.tsx
    |   |   +-- tooltip.tsx
    |   |
    |   +-- landing/                 # Landing page section components
    |   |   +-- navbar.tsx           # Full-width bar; mobile menu is a shadcn Sheet
    |   |   +-- section.tsx          # <Section> surface band + <SectionHeading> ruled header
    |   |   +-- reveal.tsx           # IntersectionObserver scroll reveal (CSS classes, html.js guarded)
    |   |   +-- hero-section.tsx
    |   |   +-- day-sheet.tsx        # Signature: live time-ruled day schedule in the hero
    |   |   +-- trust-bar.tsx        # Compact "Built for <trade>" strip
    |   |   +-- features-section.tsx
    |   |   +-- industry-showcase.tsx # shadcn Tabs, one panel per trade
    |   |   +-- how-it-works-section.tsx
    |   |   +-- pricing-section.tsx  # Sticky price rail + included list + replacement ledger
    |   |   +-- testimonials-section.tsx
    |   |   +-- faq-section.tsx
    |   |   +-- blog-preview-section.tsx
    |   |   +-- final-cta-section.tsx
    |   |   +-- footer.tsx
    |   |   +-- json-ld.tsx          # SoftwareApplication + FAQPage structured data
    |   |
    |   +-- booking-portal/          # Public booking portal components
    |   |   +-- booking-progress-indicator.tsx  # Step dots (5 steps)
    |   |   +-- booking-service-card.tsx        # Selectable service type card
    |   |   +-- booking-step-service.tsx        # Step 1: service type grid
    |   |   +-- booking-step-date.tsx           # Step 2: calendar date picker
    |   |   +-- booking-step-time.tsx           # Step 3: time slot grid
    |   |   +-- booking-step-info.tsx           # Step 4: customer info form
    |   |   +-- booking-step-confirmation.tsx   # Step 5: success screen
    |   |
    |   +-- dashboard/               # Dashboard-specific components (by entity)
    |   |   +-- page-actions.tsx    # Portal: pages render action buttons into the navbar
    |   |   +-- dashboard-shell.tsx  # Shell layout (sidebar + navbar + content)
    |   |   +-- global-fetch-indicator.tsx  # Background refetch progress bar (TanStack Query isFetching)
    |   |   +-- navbar.tsx           # Top navigation bar
    |   |   +-- impersonation-bar.tsx # Admin-only floating bar during impersonation (exit button + timer)
    |   |   +-- impersonation-request-listener.tsx # Tenant-side: realtime listener + permission dialog for visible impersonation
    |   |   +-- impersonation-active-indicator.tsx # Tenant-side: "admin is viewing" bar during visible impersonation
    |   |   +-- notifications/       # Notification bell dropdown components
    |   |   |   +-- notification-bell.tsx    # Popover dropdown with real-time updates
    |   |   |   +-- notification-item.tsx    # Single notification row with icon, title, time, unread dot
    |   |   |   +-- notification-header.tsx  # Header with "Mark all as read" button
    |   |   |   +-- notification-empty.tsx   # Empty state (IconBellOff)
    |   |   +-- sidebar.tsx          # Side navigation (incl. Bookings link)
    |   |   +-- sidebar-provider.tsx # Sidebar state context
    |   |   +-- sidebar-nav-item.tsx # Nav item component
    |   |   |
    |   |   +-- home/               # KPI Dashboard components
    |   |   |   +-- agenda-timeline.tsx          # Grouped 7-day agenda (events + jobs + bookings)
    |   |   |   +-- customize-widgets-popover.tsx # Show/hide widget toggles
    |   |   |   +-- dashboard-skeleton.tsx       # Single skeleton; also used by loading.tsx
    |   |   |   +-- dashboard-toolbar.tsx        # Ask AI + Customize + Last updated
    |   |   |   +-- invoice-aging.tsx            # 5 AR buckets, each links to filtered invoices
    |   |   |   +-- jobs-management-panel.tsx    # Status/Priority/Service tabs, own pipeline query
    |   |   |   +-- kpi-pill.tsx                 # KPI pill: value, label, trend chip, window badge
    |   |   |   +-- overdue-alert-banner.tsx
    |   |   |   +-- quote-conversion.tsx
    |   |   |   +-- recent-activity-feed.tsx
    |   |   |   +-- retention-chart.tsx          # Monthly repeat-customer rate bars
    |   |   |   +-- revenue-by-service-chart.tsx # Horizontal bars, top 6 services + "Other"
    |   |   |   +-- revenue-range-chart.tsx      # 1D/1W/1M/6M/1Y/ALL — collected area + billed line
    |   |   |   +-- week-ahead.tsx               # Per-day stacked load strip (jobs/bookings/events)
    |   |   |   +-- top-customers-card.tsx       # Ranked list of top 5 customers by revenue
    |   |   |   +-- widget-window-badge.tsx      # Marks widgets that ignore the date picker
    |   |   |   # chart-data-table / widget-error-boundary / dashboard-load-error moved
    |   |   |   # to components/reusable/ on 2026-07-27 — /reports uses them too
    |   |   |
    |   |   +-- customers/          # Customer components
    |   |   |   +-- customer-activity-tab.tsx      # Paginated; 9 activity types incl. archive/tag
    |   |   |   +-- customer-detail-header.tsx     # Inline edit (validated), tags, summary strip
    |   |   |   +-- customer-dialog.tsx            # Create/edit + notes field + duplicate-email warning
    |   |   |   +-- customer-equipment-tab.tsx
    |   |   |   +-- customer-invoices-tab.tsx
    |   |   |   +-- customer-jobs-tab.tsx
    |   |   |   +-- customer-notes-tab.tsx         # customer_notes rows (NOT the customers.notes column)
    |   |   |   +-- customer-picker.tsx
    |   |   |   +-- customer-quotes-tab.tsx
    |   |   |   +-- customer-table.tsx             # Sortable, keyboard-reachable, tag chips, restore
    |   |   |   +-- customer-tabs-panel.tsx        # Tab selection lives in ?tab= so it survives reload
    |   |   |   +-- customer-tags-input.tsx
    |   |   |   +-- customer-agreements-tab.tsx
    |   |   |   # customer-info-panel.tsx and customer-sidebar-panel.tsx deleted 2026-07-27 —
    |   |   |   # exported, imported nowhere, and holding a second divergent edit implementation
    |   |   |
    |   |   +-- pipelines/           # Pipeline management components
    |   |   |   +-- pipeline-create-dialog.tsx  # Create pipeline dialog (name, stage options)
    |   |   |
    |   |   +-- jobs/               # Job management components
    |   |   |   +-- pipeline-tabs.tsx         # Pipeline tab switcher (animated Highlight tabs, always visible)
    |   |   |   +-- assignee-picker.tsx        # Popover-based team member assignee picker (AssigneePicker)
    |   |   |   +-- job-create-dialog.tsx
    |   |   |   +-- job-detail-activities.tsx
    |   |   |   +-- job-detail-checklist.tsx
    |   |   |   +-- job-detail-info.tsx
    |   |   |   +-- job-detail-line-items.tsx
    |   |   |   +-- job-detail-page-header.tsx
    |   |   |   +-- job-detail-photos.tsx
    |   |   |   +-- job-detail-sheet.tsx
    |   |   |   +-- job-filters.tsx
    |   |   |   +-- job-info-panel.tsx
    |   |   |   +-- job-sidebar-panel.tsx
    |   |   |   +-- job-table.tsx
    |   |   |   +-- job-tabs-panel.tsx
    |   |   |   +-- kanban-board.tsx
    |   |   |   +-- kanban-card-compact.tsx
    |   |   |   +-- kanban-card.tsx
    |   |   |   +-- kanban-column.tsx
    |   |   |   +-- kanban-skeleton.tsx
    |   |   |   +-- pipeline-stages-dialog.tsx
    |   |   |
    |   |   +-- invoices/           # Invoice components
    |   |   |   +-- invoice-create-dialog.tsx
    |   |   |   +-- invoice-detail-header.tsx
    |   |   |   +-- invoice-detail-sheet.tsx
    |   |   |   +-- invoice-detail-tab.tsx
    |   |   |   +-- invoice-info-panel.tsx
    |   |   |   +-- invoice-line-items-tab.tsx
    |   |   |   +-- invoice-payments-tab.tsx
    |   |   |   +-- invoice-sidebar-panel.tsx
    |   |   |   +-- invoice-status-badge.tsx
    |   |   |   +-- invoice-table.tsx    # Sortable (7 keys the API always accepted), keyboard-reachable
    |   |   |   |                         # rows, partial-payment progress bar
    |   |   |   +-- invoice-tabs-panel.tsx
    |   |   |
    |   |   +-- quotes/             # Quote components
    |   |   |   +-- quote-activity-tab.tsx
    |   |   |   +-- quote-create-dialog.tsx
    |   |   |   +-- quote-detail-header.tsx
    |   |   |   +-- quote-detail-sheet.tsx
    |   |   |   +-- quote-detail-tab.tsx
    |   |   |   +-- quote-info-panel.tsx
    |   |   |   +-- quote-line-items-tab.tsx
    |   |   |   +-- quote-sidebar-panel.tsx
    |   |   |   +-- quote-status-badge.tsx
    |   |   |   +-- quote-table.tsx
    |   |   |   +-- quote-tabs-panel.tsx
    |   |   |
    |   |   +-- bookings/           # Booking management components
    |   |   |   +-- booking-table.tsx
    |   |   |   +-- booking-filters.tsx
    |   |   |   +-- booking-status-badge.tsx
    |   |   |   +-- booking-detail-sheet.tsx        # TanStack Query; links to the converted job
    |   |   |   +-- booking-activity-timeline.tsx   # Reads booking_activities (written since April,
    |   |   |   |                                   # unread until 2026-07-27)
    |   |   |   +-- booking-convert-dialog.tsx
    |   |   |
    |   |   +-- catalog/            # Service catalog components
    |   |   |   +-- catalog-filters.tsx
    |   |   |   +-- catalog-item-dialog.tsx
    |   |   |   +-- catalog-item-picker.tsx
    |   |   |   +-- catalog-table.tsx
    |   |   |
    |   |   +-- checklists/         # Checklist template components
    |   |   |   +-- checklist-template-dialog.tsx
    |   |   |   +-- checklist-template-list.tsx
    |   |   |
    |   |   +-- equipment/           # Asset management components
    |   |   |   +-- asset-dialog.tsx
    |   |   |   +-- asset-picker.tsx
    |   |   |   +-- asset-service-history-tab.tsx
    |   |   |   +-- asset-table.tsx
    |   |   |   +-- refrigerant-log-dialog.tsx
    |   |   |   +-- refrigerant-logs-panel.tsx
    |   |   |
    |   |   +-- service-agreements/  # Service agreement components
    |   |   |   +-- service-agreement-dialog.tsx
    |   |   |   +-- service-agreement-table.tsx
    |   |   |
    |   |   +-- conversations/       # Messaging/conversations components
    |   |   |   +-- conversation-list.tsx        # Two-panel layout (thread list + message view)
    |   |   |   +-- conversation-thread.tsx      # Chat message display
    |   |   |   +-- conversation-input.tsx       # Message input with send button
    |   |   |   +-- conversation-channel-tab.tsx # Email/SMS/voice tabs
    |   |   |
    |   |   +-- reports/             # /reports components (corrected 2026-07-27)
    |   |   |   +-- revenue-tab.tsx              # Trend w/ comparison, service/method splits, top customers
    |   |   |   +-- jobs-tab.tsx                 # Volume, status/priority/service, pipeline distribution
    |   |   |   +-- customers-tab.tsx            # New-customer trend, active/inactive, repeat/one-time
    |   |   |   +-- quotes-invoices-tab.tsx      # Quote funnel, invoice status, aging, overdue trend
    |   |   |   +-- bookings-tab.tsx             # Volume, service type, day of week, conversion
    |   |   |   +-- report-chart-card.tsx        # Card + error boundary + optional sr-only data table
    |   |   |   +-- report-data-table.tsx        # Generic table; rowKey + optional rowHref drill-through
    |   |   |   +-- report-kpi-row.tsx           # KPI cards; "New" badge for a zero baseline
    |   |   |   +-- reports-skeleton.tsx         # Page + tab skeletons
    |   |   |   +-- empty-chart.tsx              # Shared no-data placeholder (was 5 copies)
    |   |   |   +-- report-format.ts             # granularityLabel / bucketNoun helpers
    |   |   |   +-- export-csv-button.tsx        # Full-section CSV; BOM, range in filename, formula escaping
    |   |   |   # The date picker is shared: components/ui/date-range-picker.tsx
    |   |   |
    |   |   +-- reusable/            # Shared dashboard-level reusable components
    |   |   |   +-- stats-cards.tsx  # Stats cards grid (clickable filter + filterValue support)
    |   |   |   +-- entity-detail-shell/  # Reusable shell for entity detail views (sidebar/dialog/page)
    |   |   |       +-- types.ts                          # Shared TypeScript interfaces
    |   |   |       +-- use-detail-shell.ts               # Hook: mode/resize/toggle logic
    |   |   |       +-- entity-detail-shell.tsx           # Main shell (Sheet/Dialog wrapper + tabs)
    |   |   |       +-- entity-detail-shell-header.tsx    # Redesigned header sub-component
    |   |   |       +-- entity-detail-shell-skeleton.tsx  # Loading skeleton
    |   |   |       +-- detail-row.tsx                    # Reusable icon+label+value row
    |   |   |       +-- index.ts                          # Barrel export
    |   |   |
    |   |   +-- settings/           # Settings page components
    |   |       +-- availability-weekly-editor.tsx    # Weekly schedule editor (7 day rows)
    |   |       +-- availability-override-list.tsx    # Schedule overrides table
    |   |       +-- availability-override-dialog.tsx  # Add override form dialog
    |   |       +-- booking-capacity-card.tsx         # Concurrent appointments per slot (was hardcoded 1)
    |   |       +-- business-form.tsx
    |   |       +-- business-sidebar.tsx
    |   |       +-- change-password-form.tsx
    |   |       +-- invoice-form.tsx
    |   |       +-- invoice-preview.tsx
    |   |       +-- profile-form.tsx
    |   |       +-- profile-sidebar.tsx
    |   |       +-- settings-content.tsx
    |   |       +-- settings-form-message.tsx
    |   |       +-- settings-nav.tsx
    |   |       +-- settings-page-header.tsx
    |   |       +-- settings-section.tsx
    |   |
    |   +-- reusable/               # Shared dashboard components
    |   |   +-- confirm-action-dialog.tsx
    |   |   +-- convert-to-job-dialog.tsx  # Convert booking to job dialog
    |   |   +-- delete-confirm-dialog.tsx
    |   |   +-- editable-field.tsx         # Inline editable text field
    |   |   +-- empty-state.tsx
    |   |   +-- pagination.tsx
    |   |   +-- scroll-fade-area.tsx
    |   |   +-- search-input.tsx           # Search input with icon (no built-in debounce)
    |   |   +-- status-filter-tabs.tsx     # Animated sliding pill filter tabs
    |   |   +-- table-skeleton.tsx
    |   |   +-- view-mode-toggle.tsx
    |   |   +-- bulk-action-bar.tsx        # Floating bar for bulk operations (archive, delete, status)
    |   |   +-- bulk-confirm-dialog.tsx    # Confirmation dialog for bulk operations
    |   |   +-- chart-data-table.tsx       # sr-only table paired with a chart (a11y) — dashboard + reports
    |   |   +-- widget-error-boundary.tsx  # Per-card boundary; one crash can't blank the page
    |   |   +-- load-error-state.tsx       # Whole-page failure state with retry (NOT the empty state)
    |   |
    |   +-- superadmin/             # Super admin components (red-themed admin panel)
    |       +-- superadmin-sidebar.tsx          # Red-accented collapsible sidebar (6 nav items)
    |       +-- superadmin-sidebar-provider.tsx # Sidebar state context (localStorage)
    |       +-- superadmin-shell.tsx            # Content wrapper with sidebar padding
    |       +-- superadmin-navbar.tsx           # Navbar with ADMIN badge, Cmd+K search, user dropdown
    |       +-- global-search.tsx               # Cmd+K command palette (Dialog + Command)
    |       +-- reauth-dialog.tsx               # Password re-entry for destructive actions
    |       +-- tenants/
    |       |   +-- tenant-status-badge.tsx     # Status badge (active/trialing/cancelled/deactivated)
    |       |   +-- extend-trial-dialog.tsx     # Extend trial dialog (preset + custom days)
    |       |   +-- override-subscription-dialog.tsx  # Override status + plan
    |       |   +-- edit-tenant-dialog.tsx      # Edit tenant fields form
    |       |   +-- delete-tenant-dialog.tsx    # 2-step delete with name confirmation
    |       |   +-- impersonate-dialog.tsx      # Impersonation reason dialog
    |
    +-- app/
        +-- layout.tsx              # Root layout — fonts, ThemeProvider, RefreshOnNav, Toaster
        +-- globals.css             # CSS variables, Tailwind layers, color system, dark mode
        +-- icon.png                # Favicon
        |
        +-- (landing)/                               # -- Landing Page (Public) --
        |   +-- page.tsx                             # Hero, features, pricing, FAQ, testimonials
        |
        +-- (auth)/                                  # -- Auth Pages (Public, NO layout.tsx) --
        |   +-- login/page.tsx                       # Email/password sign-in (AuthShell)
        |   +-- signup/page.tsx                      # Registration + org creation (AuthShell)
        |   +-- forgot-password/page.tsx             # Password reset request (AuthShell)
        |
        +-- (dashboard)/                             # -- Tenant Dashboard (Better Auth session) --
        |   +-- layout.tsx                           # DashboardShell + OrgResolver
        |   +-- org-resolver.tsx                     # Ensures active org + tenant exist
        |   |
        |   +-- dashboard/
        |   |   +-- page.tsx                         # KPI Dashboard
        |   |   +-- dashboard-page-client.tsx        # Client component
        |   |
        |   +-- customers/
        |   |   +-- page.tsx                         # Customer list
        |   |   +-- customers-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Customer detail (3-panel)
        |   |       +-- customer-detail-client.tsx
        |   |
        |   +-- jobs/
        |   |   +-- page.tsx                         # Jobs Kanban + Table dual view
        |   |   +-- jobs-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Job detail page (3-panel). Fetches stages for
        |   |       |                                # THIS job's pipeline; notFound() only on a real 404
        |   |       +-- job-detail-client.tsx        # Reads via useJob() (TanStack), not local useState
        |   |       +-- job-load-error.tsx           # Client shim so the server component can render
        |   |                                        # LoadErrorState with a retry — a 500 is not a 404
        |   |
        |   +-- invoices/
        |   |   +-- page.tsx                         # Invoice list (seeds the query cache it fetches)
        |   |   +-- invoices-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Invoice detail (3-panel). 404 only on a real 404
        |   |       +-- invoice-detail-client.tsx    # Reads through useInvoice() so mutations invalidate
        |   |       +-- invoice-load-error.tsx       # Client shim so the server component can render
        |   |                                        # LoadErrorState with a retry — a 500 is not a 404
        |   |
        |   +-- quotes/
        |   |   +-- page.tsx                         # Quote list
        |   |   +-- quotes-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Quote detail (3-panel)
        |   |       +-- quote-detail-client.tsx
        |   |
        |   +-- bookings/
        |   |   +-- page.tsx                         # Bookings list page
        |   |   +-- bookings-page-client.tsx         # Client (table, filters, detail sheet)
        |   |
        |   +-- assets/
        |   |   +-- page.tsx                         # Asset list (all customers)
        |   |   +-- assets-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Asset detail (3-panel)
        |   |       +-- asset-detail-client.tsx
        |   |
        |   +-- service-agreements/
        |   |   +-- page.tsx                         # Service agreements list
        |   |   +-- service-agreements-page-client.tsx
        |   |
        |   +-- conversations/
        |   |   +-- page.tsx                         # Messaging/conversations page
        |   |   +-- conversations-page-client.tsx    # Two-panel thread + message view
        |   |
        |   +-- notifications/
        |   |   +-- page.tsx                         # Full notifications page (separate from bell)
        |   |   +-- notifications-page-client.tsx    # Notification list with detailed view
        |   |
        |   +-- reports/
        |   |   +-- page.tsx                         # SSR-prefetches the revenue section, seeds the client cache
        |   |   +-- reports-page-client.tsx          # 5-tab analytics; switches on the response's `section` discriminant
        |   |   +-- loading.tsx                      # ReportsSkeleton
        |   |
        |   +-- schedule/
        |   |   +-- page.tsx                         # Calendar/schedule view
        |   |   +-- schedule-page-client.tsx
        |   |
        |   +-- settings/
        |       +-- layout.tsx                       # Settings shell with tab navigation
        |       +-- page.tsx                         # Redirects to /settings/profile
        |       +-- profile/
        |       |   +-- page.tsx
        |       |   +-- profile-settings-page-client.tsx
        |       +-- business/
        |       |   +-- page.tsx
        |       |   +-- business-settings-client.tsx
        |       +-- catalog/
        |       |   +-- page.tsx
        |       |   +-- catalog-settings-page-client.tsx
        |       +-- checklists/
        |       |   +-- page.tsx
        |       |   +-- checklists-settings-client.tsx
        |       +-- invoices/
        |       |   +-- page.tsx
        |       |   +-- invoice-settings-client.tsx
        |       +-- quotes/
        |       |   +-- page.tsx
        |       |   +-- quote-settings-client.tsx
        |       +-- pipelines/
        |       |   +-- page.tsx                     # Server component — Pipelines settings page
        |       |   +-- pipelines-settings-client.tsx # Pipeline management (list, create, rename, delete, set default)
        |       +-- bookings/
        |       |   +-- page.tsx                     # Booking/availability settings
        |       |   +-- bookings-settings-client.tsx # Weekly schedule + overrides management
        |       +-- billing/
        |           ~ .gitkeep                       # Planned: subscription + affiliate widget
        |
        +-- (superadmin)/                            # -- Super Admin Panel (Admin role) --
        |   +-- layout.tsx                           # Server layout: auth gate (admin only), sidebar+navbar shell
        |   +-- superadmin/
        |       +-- dashboard/
        |       |   +-- page.tsx                     # SSR: fetches MRR, signups, active users, trial funnel
        |       |   +-- dashboard-page-client.tsx    # KPI grid, MRR breakdown, funnel bars, signup mini-chart
        |       +-- tenants/
        |       |   +-- page.tsx                     # SSR: fetches tenant list
        |       |   +-- tenants-page-client.tsx      # Search, table, pagination, status badges
        |       |   +-- [id]/
        |       |       +-- page.tsx                 # SSR: fetches tenant detail + stats
        |       |       +-- tenant-detail-client.tsx # 3-panel layout, all action dialogs wired
        |       +-- analytics/
        |       |   +-- page.tsx                     # SSR: fetches all analytics data
        |       |   +-- analytics-page-client.tsx    # Recharts (MRR bar, signup area), churn table, feature adoption, inactive alerts
        |       +-- support/
        |       |   +-- page.tsx                     # SSR: fetches audit + impersonation logs
        |       |   +-- support-page-client.tsx      # Tabbed: audit log table + impersonation log table
        |       +-- system/
        |       |   +-- page.tsx                     # SSR: fetches system health (DB, uptime, memory, node)
        |       +-- affiliates/
        |           +-- page.tsx                     # SSR: fetches affiliate tenants
        |           +-- affiliates-page-client.tsx   # KPI cards + referred tenants table
        |
        +-- book/[slug]/                             # -- Public Booking Portal --
        |   +-- page.tsx                             # Server component (fetches tenant by slug)
        |   +-- booking-form-client.tsx              # Multi-step form (5 steps)
        +-- ref/[code]/                              # -- Affiliate Redirect (Planned) --
        +-- api/
            +-- auth/                                # Next.js API routes for auth callbacks
            +-- webhooks/                            # Webhook handlers
```

---

