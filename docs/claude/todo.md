# Todo

> Related: [[workflow]] | [[planner]] | [[lessons]] | [[deferred-fixes/README|Deferred Fixes]]

Task tracking for the Zaxvio CRM project.

---

## In Progress

### Dashboard Redesign (2026-04-17)
- [x] Backend: `getRevenueTrend` with `day|week|month` granularity
- [x] Backend: `getRepeatCustomerRateByMonth` for retention trend
- [x] Backend: `/dashboard/stats` accepts `granularity` + `pipelineId` query params, returns `retentionTrend`, `revenueGranularity`, `priorityBreakdown`, `serviceBreakdown`, `serviceRevenue`, `topCustomers`, `selectedPipelineId`
- [x] Frontend: new widgets — `KpiPill`, `DashboardToolbar`, `RevenueRangeChart`, `JobsManagementPanel`, `RetentionChart`, `AgendaTimeline`, `InvoiceAging` (restyled), `QuoteConversion`/Quote Funnel (restyled), `RevenueByServiceChart`, `TopCustomersCard`
- [x] Frontend: `CustomizeWidgetsPopover` + `useDashboardWidgetPrefs` (localStorage-backed show/hide for all 11 widget keys)
- [x] Frontend: `AgendaHoverCard` shared between dashboard agenda and schedule calendar
- [x] Frontend: Ask AI button wires to existing chatbot via `lib/chatbot/bus.ts`
- [x] Frontend: Last-updated indicator using TanStack `dataUpdatedAt`
- [x] Agenda now fetches events + jobs + bookings for next 7 days with kind badges
- [x] Jobs Management uses DB stage colors via `STAGE_COLOR_PRESETS.hex` + pipeline selector + Zod enum on backend
- [x] Fix: `usePipelines()` queryFn unwraps server-action envelope (prevents cache-shape collision with `/jobs` page)
- [x] Update chatbot knowledge base + REPO_MAP_1 + API_DOCUMENTATION_1 + lessons

### Public Quote Acceptance Portal — Remaining
- [ ] Create `quotes` Supabase Storage bucket (manual step in Supabase dashboard, if not exists)

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
- [x] Created `docs/design.md` — extracted frontend patterns from CLAUDE.md
- [ ] Update `docs/project_docs/REPO_MAP.md` with new files

### Job Photo & File Attachment System — Remaining
- [ ] Create `job-attachments` Supabase Storage bucket (manual step in Supabase dashboard)

---

## Backlog

### Deferred / Blocked

- [ ] **E-01 Welcome Email** — needs org creation refactor
- [ ] **E-11 Welcome Paid Email** — needs Lemon Squeezy webhook
- [ ] **Billing/Subscription** — Lemon Squeezy subscription management in settings
- [ ] **Affiliate Program** (#13) — Lemon Squeezy integration, referral tracking, affiliate dashboard

### Future Ideas

_(Add items here as they come up)_

---

## Completed

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
