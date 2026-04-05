# Todo

Task tracking for the Zaxvio CRM project.

---

## In Progress

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

- [x] **EntityDetailShell Refactor** (2026-04-04) — Extracted reusable entity detail shell from 4 duplicated files (jobs, invoices, quotes, bookings). Removed ~1,350 lines of duplication. New components in `components/dashboard/reusable/entity-detail-shell/`. Redesigned header with toolbar pill, lazy tab rendering, dark/light mode safe.

---

### Job Photo & File Attachment System (2026-04-05)
- [x] DB migration — `photo_tag` enum, new columns on `job_photos`, new `job_documents` table
- [x] Drizzle schema updated — `jobPhotos` extended, `jobDocuments` added, relations updated
- [x] API — upload endpoint, photo tag filter/PATCH, document CRUD, customer photo timeline
- [x] Server actions — `uploadJobFile`, `updateJobPhotoTag`, document actions, `getCustomerPhotos`
- [x] Upload modal with photo/doc toggle, tag selector, mobile camera support
- [x] Photo tag pills (`PhotoTagPill` component)
- [x] Extended `JobDetailPhotos` — tags, lightbox trigger, upload button, compare button
- [x] Photo lightbox with keyboard navigation
- [x] Before/After comparison view
- [x] `JobDetailDocuments` — file list, download, delete
- [x] Job tabs panel — "Files" tab with photos + documents sections
- [x] Customer "Photos" tab — cross-job timeline grouped by job
- [x] Invoice "Photos" tab — job photo selector with checkboxes
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
