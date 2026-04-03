# Todo

Task tracking for in-progress and upcoming work.

## In Progress

### Sidebar Redesign (2026-03-31)
- Collapsible groups (Schedule, Manage, Finance, Setup)
- ScrollArea for overflow, narrowed from w-60 to w-56
- Setup group collapsed by default
- Group collapse state persisted to localStorage

- [ ] **Super Admin Panel** (#11, ZAX-34) — 26 features, 4 phases, ~60 new files
  - **Phase 0 — Foundation**
    - [x] 0A: Schema + auth infrastructure (admin_tier enum, webhook/cron tables, requireAdminTier middleware)
    - [x] 0B: Superadmin layout shell (sidebar, navbar, shell — red accent theme + globals.css + tailwind)
    - [x] 0C: API route registration + server actions base (23+ endpoints, 18 server actions)
  - **Phase 1 — Tenant Management**
    - [x] 1A: Tenant list + detail pages (SA-05, SA-06)
    - [x] 1B: Tenant action dialogs (extend trial, override subscription, edit, delete) + wired to detail page
    - [x] 1B: Impersonation dialog (UI + reason field)
    - [x] 1C: Ghost Impersonation — API + full flow (start/end/active endpoints, cookie-based context injection, ImpersonationBar, 2h auto-expiry)
    - [x] 1D: Visible Impersonation — consent-based flow with Supabase Realtime (request/respond/cancel, tenant permission dialog, active viewer indicator, exit notification)
  - **Phase 2 — Analytics & Dashboard**
    - [x] 2A: Admin dashboard + MRR + signups (SA-13, SA-14) — KPI cards, funnel, signup chart
    - [x] 2B: Full analytics page with Recharts — MRR bar chart, signup area chart, active users (DAT/WAT/MAT), trial funnel, churn table
    - [x] 2C: Platform event emission — emitPlatformEvent() in customers, jobs, bookings
    - [x] 2D: Inactive alerts (14d no activity) + feature adoption (% tenants using each feature) — on analytics page
  - **Phase 3 — Support, Search & Audit**
    - [x] 3A: Global search (Cmd+K command palette) — wired into navbar
    - [x] 3B: Audit log + impersonation log tables — support page with tabs
    - [x] 3C: ReauthDialog component for destructive actions (password re-entry)
  - **Phase 4 — System Health & P1**
    - [x] 4A: System health page — live DB/uptime/memory/node stats
    - [x] 4C: Affiliates page — KPI cards (referred tenants, affiliate MRR, rate) + table
  - **Tenant Deep Analysis**
    - [x] API: `GET /admin/tenants/:id/analytics` — 15 parallel queries, single auth check
    - [x] Frontend: Analytics tab on tenant detail — lazy loaded, skeleton, 5 sections (usage KPIs, financial charts, status breakdowns, operational rates, activity feed)
  - **Plan**: `docs/superadmin/SUPERADMIN_IMPLEMENTATION_PLAN.md`
  - **Report**: `docs/superadmin/SUPERADMIN_ANALYSIS_REPORT.md`

## Recently Completed (Latest)

- [x] **Multi-Pipeline Feature** (2026-04-02) — Multiple pipelines per tenant with independent stages
  - [x] Database: `pipelines` table, `pipeline_id` FK on stages + jobs, idempotent migration with data backfill
  - [x] API: Pipeline CRUD routes (`/pipelines`), updated stage/job/dashboard/booking/quote routes
  - [x] Frontend: Pipeline selector on Jobs page, pipeline-scoped Kanban/table views
  - [x] Settings: Pipelines management page (create, rename, delete, set default, edit stages)

- [x] **Calendar/Schedule View (#9, ZAX-46)** — Calendar page with Month/Week/Day views
  - [x] Dependency: react-big-calendar + @types/react-big-calendar
  - [x] Page shell: `page.tsx` (server), `schedule-page-client.tsx` (client orchestrator)
  - [x] Core calendar: `schedule-calendar.tsx` — react-big-calendar as layout engine, all visuals overridden
  - [x] Custom toolbar (100% shadcn): Button, Popover, Calendar date picker, view switcher (M/W/D)
  - [x] Custom event rendering: priority color-coded cards (blue/amber/red), booking distinction (teal/dashed)
  - [x] Filters (shadcn): Popover priority/service type filters, Switch+Label bookings toggle, Badge active indicators
  - [x] Click-to-open: reuses existing JobDetailSheet via URL param `?jobId=xxx`
  - [x] Drag-to-reschedule: withDragAndDrop HOC, optimistic updates, PATCH /jobs/:id
  - [x] Availability overlay: slotPropGetter greys out unavailable time slots
  - [x] View persistence: localStorage `schedule-calendar-view` key (default: week)
  - [x] Skeleton loader: shadcn Skeleton mimicking calendar grid
  - [x] Dark mode: full CSS variable overrides, all event colors have dark: variants
  - [x] Light mode: visible grid lines using `hsl(var(--border))`, half-hour lines softer
  - [x] Cell hover effects: timeslot-group hover highlight (pointer-events passthrough on events-container)
  - [x] Popup overlay: "+N more" styled with shadcn popover tokens
  - [x] Date navigation animation: fade-in + slide-up on date/view change (reflow-based)
  - [x] Full-height layout: fills viewport minus navbar, ScrollArea for week/day, native height for month
  - **Files created**: 8 new files in `components/dashboard/schedule/` + 2 route files
  - **No backend changes** — all APIs already existed

## Previously Completed

- [x] **Booking Portal (#8, ZAX-45)** — Public booking portal + dashboard bookings management

- [x] **KPI Dashboard (#7)** — Dashboard home with metrics, charts, and activity feed (ZAX-44)
  - API route: GET `/dashboard/stats` — single endpoint with 10 parallel SQL queries
  - KPI cards: Jobs Today (with emergency badge), Open Invoices, Outstanding Balance, This Month Revenue, Active Customers, Upcoming Bookings
  - Overdue invoices alert banner (conditional, amber styling)
  - Quick action buttons: New Job, New Customer, View Invoices, View Schedule
  - Revenue area chart (shadcn Charts + Recharts) — last 6 months with gradient fill + tooltips
  - Job pipeline horizontal bar chart — dynamic colors from tenant's custom pipeline stages
  - Recent activity feed — last 10 activities from jobs + quotes with relative timestamps
  - Server action: `getDashboardStats()` in `actions/dashboard.ts`
  - Types: `DashboardStats` + related interfaces in `packages/types/src/dashboard.ts`
  - Shared helpers: `formatCurrency()`, `formatRelativeTime()` in `lib/format.ts`
  - Full skeleton loader matching page layout
  - Responsive: 2-col (mobile) → 3-col (tablet) → 6-col (desktop) KPI grid
  - Dark mode: all chart colors auto-switch via CSS variables
  - No DB migration needed — all data from existing tables with existing indexes
  - New dependencies: recharts, shadcn chart component
  - CSS variables: `--chart-1` through `--chart-5` in globals.css

## Recently Completed

- [x] **Full UI/UX Redesign — All Dashboard Pages** (6 commits, 88 files, ~9700 lines added)
  - **Customers page redesign** (`7a54bd5`): Rewrote `customer-table.tsx` (rounded card wrapper, avatars, tooltips, responsive), `customer-dialog.tsx` (new layout), `customer-detail-header.tsx`, `customer-info-panel.tsx`, `customer-sidebar-panel.tsx`, `customer-tabs-panel.tsx`, `customer-notes-tab.tsx`, `customer-jobs-tab.tsx` (now shows real jobs), `customer-invoices-tab.tsx` (now shows real invoices), `customers-page-client.tsx` (card wrapper with search header inside)
  - **Invoice system** (`291a282`, `19445d4`): Full invoice management — 15 API endpoints, 14 server actions, invoice list page with table/filters/search/pagination, create dialog with customer picker, detail page with 3-panel layout (info panel, tabs, sidebar), line items tab with catalog picker, payments tab, generate from job, PDF generation with `@react-pdf/renderer`, migration for 5 invoice settings columns
  - **Invoice + Job detail pages** (`5b3bdfc`): Dedicated `/invoices/[id]` and `/jobs/[id]` detail pages with 3-panel layouts (header, info panel, tabs panel, sidebar panel), new components: `invoice-detail-header.tsx`, `invoice-info-panel.tsx`, `invoice-tabs-panel.tsx`, `invoice-sidebar-panel.tsx`, `job-detail-page-header.tsx`, `job-info-panel.tsx`, `job-tabs-panel.tsx`, `job-sidebar-panel.tsx`
  - **Job page redesign** (`66c3fba`): Dual-view (Kanban + Table), `job-table.tsx` (new table view), `jobs-stats-bar.tsx` (KPI bar), `kanban-card-compact.tsx` (compact card variant), rewrote `kanban-board.tsx`, `kanban-card.tsx`, `kanban-column.tsx`, `job-filters.tsx`, `kanban-skeleton.tsx`
  - **Settings page redesign** (`69be4cc`): 3 new shared components (`SettingsSection`, `SettingsFormMessage`, `SettingsPageHeader`), all 5 tabs polished — Profile (SettingsSection, 2-col grid, larger avatar, password strength indicator), Business (split into 2 sections), Invoices (SettingsSection + live preview dark mode), Catalog (customer table card pattern — filters+table in single card), Checklists (same card pattern, shadcn Table components)
  - **Global CSS updates** (`globals.css`): New color tokens, stage color presets, refined dark mode
  - **New reusable patterns**: Customer table card wrapper (`rounded-lg border border-border bg-card overflow-hidden` with search/filters as `border-b` header), 3-panel detail page layout (header + info + tabs + sidebar)

## Build Order (Phase 1)

Priority order based on PRD feature dependencies:

| # | Feature | Scope | Depends On |
|---|---------|-------|------------|
| 1 | **Organization/Tenant creation flow** | Signup → create tenant row + link to Better Auth org, onboarding | Auth (done) |
| 2 | **Customer CRUD** | API routes + dashboard page (list, create, edit, delete) | #1 |
| 3 | **Service Catalog** | API routes + settings page (manage parts/labor/flat-rate items) | #1 |
| 4 | **Job Management (Kanban)** | API routes + Kanban board, job detail page, line items, status workflow | #2, #3 |
| 5 | **Invoicing** | API routes + invoice page, generate from jobs, PDF (pdfkit), email, payment tracking | #4 |
| 6 | **Quote Builder** | API routes + quote page, PDF, email, customer acceptance, convert quote → job | #2, #3 |
| 7 | **KPI Dashboard** | Dashboard home with metrics (revenue, jobs, outstanding invoices, etc.) | #4, #5 |
| 8 | **Booking Portal** | Public `/book/[slug]` page, creates jobs from customer bookings | #2, #4 |
| 9 | **Calendar/Schedule View** | Calendar page, availability schedules, schedule overrides | #4, #8 |
| 10 | **Checklists** | Templates, attach to jobs, auto-add line items from checked catalog items | #3, #4 |
| 11 | **Super Admin Panel** | Tenant management, platform analytics, audit log, impersonation | #1 |
| 12 | **Email Templates** | React Email templates (invoice, quote, booking confirm, review request) | #5, #6, #8 |
| 13 | **Affiliate Program** | Lemon Squeezy integration, referral tracking, affiliate dashboard | #11 |
| 14 | **Settings Page** | Profile, org management, team members, billing | #1 |

## In Progress

- [x] **Email Templates** (#12, ZAX-50) — 14 React Email templates (E-01 through E-13 + team invitation)
  - [x] Phase 1: Package setup + 5 shared brand components (email-layout, brand-button, data-table, info-row, heading)
  - [x] Phase 2: 14 template implementations (3 batches by route readiness)
  - [x] Phase 3: API send functions (rewrite email.ts with 14 typed senders)
  - [x] Phase 4: Route integration (invoice, quote, booking, job, auth)
    - [x] E-06: Invoice send → `POST /invoices/:id/send`
    - [x] E-08 + E-12: Payment receipt + review request → `POST /invoices/:id/payments`
    - [x] E-13: Quote send → `POST /quotes/:id/send`
    - [x] E-02 + E-03: Booking confirmation → `POST /public/booking/:slug/submit`
    - [x] E-04: Booking confirmed → `POST /bookings/:id/convert-to-job`
    - [x] E-05: Job completion → `PATCH /jobs/:id/status`
    - [ ] E-01: Welcome (auth hook — deferred, needs org creation refactor)
    - [ ] E-11: Welcome paid (deferred — requires LemonSqueezy webhook)
  - [x] Phase 5: DB migration (3 idempotency timestamp columns)
  - [x] Phase 6: Cron jobs (E-07 overdue, E-09 contract renewal, E-10 trial expiry) — 6h interval + startup run
  - **Team invitation migrated** from inline HTML to React Email template

## Upcoming

Items not yet started (next up):

- [x] **Multi-Channel Notifications** — Real-time in-app (Supabase Realtime) + email channel now, SMS/Voice stubs for later
  - [x] DB: 4 tables (notifications, notification_reads, notification_channel_config, notification_deliveries) + 3 enums
  - [x] Migration: `20260401000001_add_notifications.sql` (fully idempotent)
  - [x] Backend: `dispatchNotification()` fire-and-forget service with channel adapters (in-app + email now, SMS/Voice stubs)
  - [x] API: 6 endpoints (GET list, GET unread-count, PATCH read, PATCH read-all, GET/PATCH preferences)
  - [x] Integration: Wired into 5 routes (customers, jobs, invoices, quotes, public booking)
  - [x] Frontend: `useNotifications()` hook with Supabase Realtime subscription
  - [x] UI: NotificationBell dropdown (Popover + ScrollArea + Skeleton), replaces placeholder in navbar
  - [x] Settings: Notification preferences page with Table×Switch grid, SMS/Voice disabled with "Coming soon" tooltips
  - **Files**: 13 new, ~12 modified
- [x] **Help Chatbot** — Floating chat widget on all dashboard pages
  - [x] NLP engine: `compromise` library for natural language parsing (free, client-side)
  - [x] Intent detection: greeting, help, action (create entities), unknown
  - [x] Knowledge base: ~30 FAQ entries across 9 categories (industry-agnostic)
  - [x] 8 entity actions: create customer, event, job, invoice, quote, catalog item, equipment, booking
  - [x] Two input modes: natural language + key:value format
  - [x] Customer lookup flow: search -> select -> confirm for entities needing customerId
  - [x] Multi-step conversation: missing fields -> follow-up -> confirmation -> execution
  - [x] UI: floating button (z-40, bottom-right), chat panel (380x520, mobile full-screen)
  - [x] Components: 5 UI files (chatbot-panel, chatbot-message, chatbot-welcome, typing-indicator, help-chatbot)
  - [x] Engine: 8 lib files (types, entity-definitions, normalizer, intent-detector, knowledge-base, action-parser, action-executor, engine)
  - [x] Hook: `useChatbot` with localStorage persistence (50 msg cap, 24h TTL)
  - [x] Integration: Added to dashboard layout
  - **Files**: 14 new (8 lib + 5 components + 1 hook), 1 modified (layout.tsx)
- [x] **Reports/Analytics** — Tenant-level reporting (revenue, job completion rates)
  - [x] Types: `packages/types/src/reports.ts` — 5 section interfaces (Revenue, Jobs, Customers, Quotes/Invoices, Bookings)
  - [x] API: `apps/api/src/routes/reports/index.ts` — single `GET /reports/stats?section=` endpoint with 5 section handlers, 34 parallel SQL queries total
  - [x] Server action: `apps/web/src/actions/reports.ts` — `getReportStats()` with cookie forwarding
  - [x] Page: `apps/web/src/app/(dashboard)/reports/` — server page + client orchestrator with tab-based lazy loading
  - [x] 5 tab components: revenue-tab, jobs-tab, customers-tab, quotes-invoices-tab, bookings-tab
  - [x] Shared components: report-kpi-row, report-chart-card, report-data-table, export-csv-button, motion-fade, reports-skeleton
  - [x] Charts: Recharts (AreaChart, BarChart, PieChart, LineChart) with ChartTooltip on every chart
  - [x] Animations: motion.div Fade/SlideUp with staggered delays
  - [x] Date range: any custom range + "Last 12 months" / "All time" presets via enhanced DateRangePicker
  - [x] CSV export: client-side per-tab export
  - [x] Sidebar: Reports added as top-level nav item with IconChartBar
  - **Files**: 17 new, 4 modified
- [ ] **Asset picker integration into Job create/edit dialog** — frontend wiring for equipmentId selection
- [ ] **Equipment reference on Quote create** — optional equipmentId FK on quotes
- _(More features TBD — will be added here as planned)_

## Last (Do These After All Other Features)

> **Billing & Affiliate depend on Lemon Squeezy and will be the very last items built in Phase 1.** Many features will be added before these.

- [ ] **Billing/Subscription** — Lemon Squeezy subscription management in settings
- [ ] **Affiliate Program** (#13) — Lemon Squeezy integration, referral tracking, affiliate dashboard
- [ ] **Deferred Emails** — E-01 Welcome (needs org creation refactor), E-11 Welcome Paid (needs LemonSqueezy webhook)

## Recently Completed (Latest)

- [x] **Team Management** (ZAX-34 session) — Multi-user org support with roles
  - Better Auth org plugin configured: `creatorRole: "owner"`, `sendInvitationEmail` hook, 7-day expiry
  - Resend email utility (`apps/api/src/lib/email.ts`) for invitation emails
  - `requireOrgRole()` middleware factory for role-based API access control
  - Role guard on `PATCH /tenants/current` (owner/admin only)
  - Migration: existing org creators set to "owner" role
  - Invitation acceptance page: `/invite/[id]` with accept/decline for logged-in, signup/login links for guests
  - Signup/login pages: handle `?invite=` param for invitation flow
  - Team settings page: `/settings/team` with member list, invite dialog, pending invitations
  - Reusable components: `TeamRoleBadge`, `TeamMemberList`, `TeamInviteDialog`, `TeamPendingInvitations`
  - `useOrgRole` hook: returns `{ role, isOwner, isAdmin, isMember, isLoading }`
  - Settings nav role-aware filtering (Business: owner/admin, Billing: owner only)

- [x] **Enterprise UI/UX Overhaul** (ZAX-34 session) — Dashboard-wide redesign
  - Removed duplicate page headers (navbar title is single source)
  - Stats cards as page headers (invoices, quotes, bookings, customers)
  - Reusable `StatsCards` component (`components/dashboard/reusable/stats-cards.tsx`)
  - Action buttons moved into search/filter toolbars
  - Promoted Catalog & Checklists from Settings to top-level sidebar items
  - Settings redesigned: horizontal tabs → grouped sidebar (Account, Organization, Documents, Scheduling)
  - Mobile settings: shadcn Select dropdown
  - Sidebar redesigned: flat list → grouped sections (Planning, Work, Revenue, Configuration)
  - Sidebar order: Dashboard → Schedule → Bookings → Customers → Jobs → Quotes → Invoices → Catalog → Checklists
  - Badge system: all status badges now use shadcn `<Badge>` with subtle-fill pattern (no borders)
  - Icons updated for visual distinction (Quotes: IconFileDescription, Invoices: IconReceipt, etc.)

## Done

- [x] **Equipment/Assets CRUD (ZAX-52)** — Full CRUD for equipment/assets with customer tab integration, refrigerant logs sub-resource, standalone /assets page, asset detail page with service history
- [x] **Service Agreements (ZAX-53)** — Maintenance contracts renamed to "Service Agreements" for general service industry. Full CRUD, customer tab, standalone /service-agreements page, expiring contracts endpoint. Added serviceFrequencyEnum (weekly to annual)
- [x] **Asset Integration (ZAX-59)** — equipmentId added to jobs table, asset picker component, jobs API returns equipment info, equipment history endpoint

- [x] **Checklists (#10)** — Full checklist template management + job integration (already implemented)
  - DB: 3 tables (checklistTemplates, checklistItems, jobChecklistCompletions)
  - API: 8 endpoints — template CRUD, item CRUD, toggle completion
  - Job integration: auto-attach on create, toggle with auto-add line items from catalog, completion gate
  - Settings UI: template management page with create/edit/delete, service type filter
  - Job detail: checklist tab with progress bar, required indicators, optimistic updates
  - Server actions: full coverage for templates, items, and job checklist operations

- [x] **Quote Builder (#6)** — Full quote management feature (ZAX-43)
  - API routes: 13 endpoints (CRUD, line items, PDF gen/download, send, accept, decline, convert-to-job)
  - PDF generation: `@react-pdf/renderer` with "ESTIMATE" header, "Valid Until" instead of "Due Date", no payment rows
  - Server actions: 13 actions covering all API endpoints
  - Frontend: Quote list page with table, status filters (draft/sent/accepted/declined/expired), search, pagination
  - Quote create dialog with customer picker, tax rate, expiry date (+30 days default), discount
  - Quote detail sheet with 2 tabs: Details, Line Items (no Payments tab)
  - Line items tab: add/edit/delete with catalog picker (draft only)
  - Full detail page: 3-panel layout (info panel, tabs, sidebar) at `/quotes/[id]`
  - Convert to Job: creates job from accepted/sent quote, copies line items, auto-attaches checklist
  - Customer quotes tab: shows customer's quotes in customer detail page
  - Business rules: draft-only editing/deletion, auto-number (QT-YYYY-XXXX), generated line item totals
  - Mirrors invoice system 1:1 with quote-specific adaptations
  - **Bug fixes & features (16 issues resolved):**
    - Bug 1: Fixed discount lost in quote-to-job conversion (subtotal + tax - discount)
    - Bug 2+5: Convert-to-Job confirmation dialog with amber warning for "sent" quotes (auto-accept notice)
    - Bug 4: Added tenant filter to customer fetch in send/PDF endpoints (security fix)
    - Bug 6: Fixed pagination edge case when deleting last item on a page
    - Issues 7-10: Backend validation for discount amount (≥0), tax rate (0-1), zero line items on send, customer ID change
    - Feature 11: Auto-expire sent quotes past expiry date (checked on list/detail fetch)
    - Feature 12: Activity timeline with `quote_activities` table, 10 activity types, timeline UI in Activity tab
    - Feature 14: Catalog picker in line item edit mode (not just add)
    - Feature 15: Sort options on quote list page (6 sort columns with direction toggle)
    - Feature 16: Quote-specific PDF footer settings (terms & conditions, footer message) with Settings > Quotes page
    - New reusable: `ConfirmActionDialog` in `components/dashboard/reusable/`
    - Migrations: `0007_add_quote_settings.sql`, `0008_add_quote_activities.sql`
    - Deferred: Email sending (#3) and email preview (#13) — no email infra yet

- [x] **Enhanced Invoice PDF** (ZAX-42) — User-controlled invoice details
  - 5 new tenant columns: licenseNumber, invoicePaymentTerms, invoicePaymentInstructions, invoiceTermsConditions, invoiceFooterMessage
  - Migration: `0006_add_invoice_settings.sql` — idempotent `ADD COLUMN IF NOT EXISTS`
  - PDF template: conditional logo, owner name, license #, payment terms, payment instructions, terms & conditions, custom footer
  - Business Settings form: new "Invoice Details" card with all 5 fields + helper text
  - "Fill it in → it shows up. Leave empty → hidden." — no toggles needed

- [x] **Invoicing (#5)** — Full invoice management feature (ZAX-42)
  - API routes: 15 endpoints (CRUD, line items, payments, PDF gen/download, send, void, status, from-job)
  - PDF generation: `@react-pdf/renderer` with professional invoice template, Supabase Storage upload
  - Server actions: 14 actions covering all API endpoints
  - Frontend: Invoice list page with table, status filters, search, pagination
  - Invoice create dialog with customer picker, tax rate, due date, discount
  - Invoice detail sheet with 3 tabs: Details, Line Items, Payments
  - Line items tab: add/edit/delete with catalog picker (draft only)
  - Payments tab: record/delete payments with auto-status (paid/partially_paid)
  - Generate Invoice from Job: button in job detail info, copies line items + tax rate
  - Customer invoices tab: shows customer's invoices in customer detail page
  - Business rules: draft-only editing/deletion, void restrictions, auto-number (INV-YYYY-XXXX), generated line item totals

- [x] **Custom Pipeline Stages (ZAX-41)** — User-controlled Kanban columns
  - New DB table: `job_pipeline_stages` (per-tenant, name/label/color/sortOrder/isDefault)
  - Migration: `0005_add_pipeline_stages.sql` — creates table, converts `jobs.status` from enum to text, seeds 4 defaults for all existing tenants
  - Schema: `packages/database/src/schema/pipeline-stages.ts`, updated `jobs.ts` (status now text)
  - Types: `PipelineStage`, `PipelineStageInsert` in `packages/types/src/pipeline-stage.ts`
  - API routes: GET/POST/PATCH/DELETE `/pipeline-stages`, PATCH `/pipeline-stages/reorder` with lazy-init default seeding
  - Server actions: `getPipelineStages`, `createPipelineStage`, `updatePipelineStage`, `deletePipelineStage`, `reorderPipelineStages`
  - Tenant creation seeding: default 4 stages seeded in `auth.ts` afterCreate + `POST /tenants/initialize`
  - Color presets: 8 colors (blue, brand, green, red, purple, amber, gray, teal) in `stage-color-presets.ts`
  - Kanban board: dynamic columns from pipeline stages (flex + horizontal scroll), removed hardcoded `KANBAN_COLUMNS`/`VALID_STATUS_TRANSITIONS`
  - Manage Pipeline dialog: draggable reorder (@dnd-kit/sortable), inline label editing, color picker, delete with job count guard
  - Job detail sheet: dynamic stage-based status badge, "Move to [next stage]" + dropdown for other stages
  - Filters bar: added "Manage Pipeline" button
  - Skeleton: accepts `columnCount` prop
- [x] **Default Tax Rate in Settings** — Set once in Settings → Business, auto-fills on new jobs
  - Migration: `0004_add_default_tax_rate.sql` adds `default_tax_rate` column to tenants
  - Schema: `defaultTaxRate` field in `packages/database/src/schema/tenants.ts`
  - API: GET/PATCH `/tenants/current` endpoints for reading/updating tenant data
  - Server actions: `getTenant()`, `updateTenant()` in `actions/tenants.ts`
  - Business Settings page: form with business info fields + default tax rate
  - Job creation auto-fills tax rate from tenant default (user can still override per-job)
- [x] **Job Management (Kanban)** (#4) — Full implementation
  - Backend: 15 API endpoints (jobs CRUD, line items, checklist, photos, activities)
  - Server actions: getJobs, getJob, createJob, updateJob, updateJobStatus, deleteJob, line items CRUD, checklist toggle, photos CRUD, activities
  - Frontend Kanban board with 4 columns (Scheduled, In Progress, Completed, Cancelled)
  - Drag-and-drop via @dnd-kit/core with state machine validation and optimistic updates
  - Job detail Sheet (slide-over) with 5 tabs: Details, Line Items, Checklist, Photos, Activity
  - Create/Edit dialog with customer search picker (Popover+Command), auto-fill address
  - Filters: search (debounced), priority, service type with Popover-based selectors
  - Toast notifications via sonner (added Toaster to root layout)
  - New UI components: Sheet (shadcn), Progress (shadcn)
  - Skeleton loaders for board and detail panel
  - Empty states for board, each tab, and no-results
  - Delete confirmation via reusable DeleteConfirmDialog
  - Activity timeline with icon mapping per activity type
  - Checklist tab with progress bar, required item indicators, auto-refresh on toggle
  - Line items tab with inline add/edit forms, subtotal calculation
- [x] **Service Catalog + Settings Pages** (#3) — Full implementation
  - API routes: CRUD for catalog items (GET list/single, POST, PATCH, DELETE), GET /categories for distinct categories
  - Server actions: getCatalogItems, getCatalogCategories, getCatalogItem, createCatalogItem, updateCatalogItem, deleteCatalogItem
  - Settings layout with tabbed navigation (Profile, Service Catalog, Checklists, Business, Billing)
  - `/settings` redirects to `/settings/profile`
  - Catalog page: table with type badges, search, item type filter, category filter, archived toggle, pagination
  - Catalog CRUD: create/edit dialog with Popover selectors, category autocomplete (datalist), archive/restore, hard delete
  - User Profile page: name/email editing via Better Auth, email verification badge, change password form with show/hide toggles
  - Reuses existing components: TableSkeleton, EmptyState, Pagination, DeleteConfirmDialog
  - New components: settings-nav, catalog-table, catalog-item-dialog, catalog-filters, profile-form, change-password-form
- [x] **Customer Detail Page** — 3-panel layout (info panel, tabbed content, sidebar)
  - Inline-editable fields in left panel (click-to-edit contact + address info)
  - Customer Tags system: tenant-level reusable tags, many-to-many with customers, create/assign/remove via popover
  - Customer Notes system: full CRUD (add, edit, delete), timestamped with author tracking
  - Customer Activity Log: automated timeline (customer.created, customer.updated, note.created)
  - Tabs: Activity, Notes, Jobs (empty), Invoices (empty), Equipment (empty)
  - Right sidebar: Appointments + Equipment placeholders
  - Breadcrumb navigation back to customer list
  - Customer name in list table is now a clickable link to detail page
  - Removed notes field from customer dialog (notes now in dedicated Notes tab)
  - New DB tables: customer_notes, customer_activities, tags, customer_tags
  - New API routes: /tags CRUD, /customers/:id/notes, /customers/:id/activities, /customers/:id/tags
  - New UI components: Tabs (shadcn), Popover (shadcn)
- [x] **Customer CRUD** (#2) — API routes (GET/POST/PATCH/DELETE /customers), server actions, dashboard page with table, search, pagination, create/edit dialog, delete confirm
  - Fixed Drizzle dual-instance bug: `tenant-scope.ts` now imports `eq` from `@hvac-saas/database`
  - Reorganized components: reusable in `components/dashboard/reusable/`, customer-specific in `components/dashboard/customers/`
- [x] **Organization/Tenant creation flow** (#1) — auto-creates tenant + subscription on org creation
  - Better Auth `organizationCreation.afterCreate` hook in auth.ts
  - Enhanced `requireTenant` middleware resolves tenantId from DB
  - Idempotent `POST /tenants/initialize` endpoint for existing orgs
  - Dashboard layout guard (redirects unauthenticated users)
  - Re-exported drizzle-orm operators from `@hvac-saas/database` to fix duplicate instance issue
  - **Fix:** Added try-catch + transaction to `afterCreate` hook (was failing silently)
  - **Fix:** OrgResolver now calls `initializeTenant()` as fallback after setting active org
  - **Fix:** Added `.notNull()` constraint to `tenants.organizationId` (migration: `0001_fearless_risque.sql`)
  - **Fix (ZAX-32):** Signup now calls `setActive()` + `initializeTenant()` before redirect — ensures tenant row exists
  - **Fix (ZAX-32):** Login calls `initializeTenant()` after `setActive()` — auto-heals existing users with missing tenant rows
  - **Fix (ZAX-32):** afterCreate hook uses `onConflictDoNothing()` + `org.id` fallback slug — prevents slug collision crashes
  - **Fix (ZAX-32):** OrgResolver shows real error messages + retry button instead of generic "Something went wrong"
- [x] **Better Auth migration** — replaced Supabase Auth + bcrypt/JWT with Better Auth (unified auth system)
  - Better Auth server config with drizzle adapter, organization + admin plugins
  - Auth schema: 7 tables (user, session, account, verification, organization, member, invitation)
  - Fastify integration using auth.handler() with reconstructed Request (not toNodeHandler)
  - Auth middleware: requireAuth, requireAdmin, requireTenant preHandlers
  - Seed admin script using Better Auth signUpEmail + direct DB role update
  - Removed old admin-auth plugin, admin auth routes, @fastify/jwt, bcryptjs
  - Dropped RLS policies, switched to application-level tenant isolation via tenantFilter()
  - Added organizationId FK on tenants table linking to Better Auth organizations
- [x] **Next.js 14 + Tailwind + shadcn/ui frontend** — full foundation
  - Root layout, globals.css, Tailwind v3 + shadcn CSS variables
  - shadcn components: Button, Input, Label, Card, Separator, Accordion, Badge
  - Auth pages: login, signup, forgot-password (all functional, using AuthShell wrapper)
  - Better Auth React client (useSession, signIn, signUp, signOut)
  - Server-side auth helper (auth-server.ts)
  - Route protection middleware (session cookie check)
  - Placeholder dashboard + superadmin pages
- [x] **Landing page** — hero, features, how-it-works, pricing, testimonials, FAQ, CTA, footer
  - Components in `src/components/landing/` (navbar, hero-section, features-section, etc.)
  - SectionReveal for IntersectionObserver scroll animations
  - Theme toggle (light/dark via next-themes)
- [x] **Back/forward navigation fix** — Next.js 14 Router Cache stale popstate
  - `staleTimes: { dynamic: 0, static: 0 }` in next.config.mjs (forward nav fix)
  - `RefreshOnNav` component with popstate listener + router.refresh() (back/forward fix)
  - Removed competing `(auth)/layout.tsx` — auth pages use `AuthShell` component directly
  - Clean route groups: `(landing)/`, `(auth)/`, `(dashboard)/`, `(superadmin)/` — no layout conflicts
- [x] Fastify server entry point with CORS, Swagger, health check, graceful shutdown
- [x] Environment validation with Zod (apps/api/src/lib/env.ts)
- [x] Database foundation: Drizzle ORM schema, types package, database client
- [x] Install core dependencies (drizzle-orm, postgres, better-auth, next, tailwindcss, shadcn/ui)
- [x] Connect Supabase: pushed schema (31 tables including auth tables)
- [x] Set up .env with Supabase credentials + Better Auth secret
- [x] Set up root package.json with all convenience scripts (db:*, dev:*, test:*, seed:admin)
