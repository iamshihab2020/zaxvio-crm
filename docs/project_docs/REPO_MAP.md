# REPO_MAP.md — HVAC SaaS Platform (Zaxvio CRM)

> **Product**: HVAC Field Service Management SaaS for solo contractors (1-3 person teams)
> **Stack**: Next.js 14 + Fastify + Supabase + Drizzle ORM + Better Auth + Lemon Squeezy
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
+-- .env                      # Supabase + DATABASE_URL + Better Auth (not committed)
+-- .env.example              # Template for all env vars
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
|   |   +-- auth-middleware.ts     # requireAuth, requireAdmin, requireTenant preHandlers
|   |   +-- env.ts                 # Zod-validated env loading (dotenv from monorepo root)
|   |   +-- db/
|   |   |   +-- tenant-scope.ts    # tenantFilter() helper for app-level tenant isolation
|   |   +-- pdf/
|   |       +-- generate-invoice-pdf.ts  # Invoice PDF generation entry point
|   |       +-- generate-quote-pdf.ts    # Quote PDF generation entry point
|   |       +-- invoice-pdf.tsx          # Invoice PDF React template (@react-pdf/renderer)
|   |       +-- quote-pdf.tsx            # Quote PDF React template (@react-pdf/renderer)
|   |
|   +-- routes/
|   |   +-- catalog/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /catalog (+ /categories)
|   |   +-- checklists/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /checklists (templates + items)
|   |   +-- customers/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /customers (+ notes, activities, tags)
|   |   +-- dashboard/
|   |   |   +-- index.ts          # GET /dashboard/stats (10 parallel SQL queries)
|   |   +-- invoices/
|   |   |   +-- index.ts          # 15 endpoints: CRUD, line items, payments, PDF, send, void
|   |   +-- jobs/
|   |   |   +-- index.ts          # 15 endpoints: CRUD, line items, checklist, photos, activities
|   |   +-- pipeline-stages/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /pipeline-stages + /reorder
|   |   +-- quotes/
|   |   |   +-- index.ts          # 13 endpoints: CRUD, line items, PDF, send, accept, convert-to-job
|   |   +-- tags/
|   |   |   +-- index.ts          # GET/POST/PATCH/DELETE /tags (tenant-level reusable tags)
|   |   +-- tenants/
|   |   |   +-- index.ts          # GET/PATCH /tenants/current, POST /tenants/initialize
|   |   +-- admin/
|   |   |   ~ .gitkeep            # Planned: tenant mgmt, analytics, audit log, impersonation
|   |   +-- bookings/
|   |   |   ~ .gitkeep            # Planned: public submit, owner confirm -> create job
|   |   +-- webhooks/
|   |       ~ .gitkeep            # Planned: Lemon Squeezy subscription events
|   |
|   +-- plugins/
|   |   ~ .gitkeep                # Planned: custom Fastify plugins
|   +-- services/
|   |   ~ .gitkeep                # Planned: business logic services
|   +-- jobs/
|   |   ~ .gitkeep                # Planned: background cron runners
|   +-- scripts/
|       +-- seed-admin.ts         # Seed super admin from env vars (idempotent)
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
| `/pipeline-stages` | requireTenant | CRUD + reorder | + |
| `/invoices` | requireTenant | CRUD + line items, payments, PDF, send, void | + |
| `/quotes` | requireTenant | CRUD + line items, PDF, send, accept, convert-to-job | + |
| `/tags` | requireTenant | CRUD (tenant-level) | + |
| `/dashboard/stats` | requireTenant | GET stats (10 parallel queries) | + |
| `/admin/*` | requireAdmin | Tenant mgmt, analytics, audit, impersonation | ~ |
| `/bookings` | requireTenant | Booking management | ~ |
| `/public/booking` | None | Public booking portal | - |
| `/webhooks/lemon-squeezy` | Signature | Subscription lifecycle | ~ |

---

### `apps/web/` — Next.js 14 Frontend (Port 3000)

Unified app: landing page + auth + tenant dashboard + super admin panel + public booking portal.

```
apps/web/
+-- package.json              # deps: next, better-auth, @tabler/icons-react, recharts, etc.
+-- tsconfig.json
+-- next.config.mjs           # staleTimes: { dynamic: 0, static: 0 } (Router Cache fix)
+-- tailwind.config.ts
+-- public/
|   +-- assets/
|       +-- icon.png
|       +-- logo.png
+-- src/
    +-- middleware.ts          # Route protection: public paths passthrough, else check session cookie
    |
    +-- actions/              # Server Actions — ONLY gateway for API calls
    |   +-- catalog.ts
    |   +-- checklists.ts
    |   +-- customers.ts
    |   +-- dashboard.ts
    |   +-- invoices.ts
    |   +-- jobs.ts
    |   +-- pipeline-stages.ts
    |   +-- quotes.ts
    |   +-- tags.ts
    |   +-- tenants.ts
    |
    +-- hooks/
    |   +-- use-view-preference.ts   # Persist Kanban/Table view toggle
    |
    +-- lib/
    |   +-- auth-client.ts           # Better Auth React client (signIn, signUp, signOut, useSession)
    |   +-- auth-server.ts           # Server-side session helper (forwards cookies for SSR)
    |   +-- format.ts                # formatCurrency(), formatRelativeTime() helpers
    |   +-- utils.ts                 # cn() helper (clsx + tailwind-merge)
    |   +-- constants/
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
    |   |
    |   +-- ui/                      # shadcn/ui primitives (23 components)
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
    |   |   +-- separator.tsx
    |   |   +-- sheet.tsx
    |   |   +-- skeleton.tsx
    |   |   +-- table.tsx
    |   |   +-- tabs.tsx
    |   |   +-- textarea.tsx
    |   |   +-- tooltip.tsx
    |   |
    |   +-- landing/                 # Landing page section components
    |   |   +-- navbar.tsx
    |   |   +-- hero-section.tsx
    |   |   +-- features-section.tsx
    |   |   +-- how-it-works-section.tsx
    |   |   +-- pricing-section.tsx
    |   |   +-- testimonials-section.tsx
    |   |   +-- faq-section.tsx
    |   |   +-- final-cta-section.tsx
    |   |   +-- footer.tsx
    |   |   +-- section-reveal.tsx   # IntersectionObserver scroll reveal
    |   |
    |   +-- dashboard/               # Dashboard-specific components (by entity)
    |   |   +-- dashboard-shell.tsx  # Shell layout (sidebar + navbar + content)
    |   |   +-- navbar.tsx           # Top navigation bar
    |   |   +-- sidebar.tsx          # Side navigation
    |   |   +-- sidebar-provider.tsx # Sidebar state context
    |   |   +-- sidebar-nav-item.tsx # Nav item component
    |   |   |
    |   |   +-- home/               # KPI Dashboard components
    |   |   |   +-- dashboard-skeleton.tsx
    |   |   |   +-- invoice-aging.tsx
    |   |   |   +-- job-pipeline-chart.tsx
    |   |   |   +-- kpi-card.tsx
    |   |   |   +-- kpi-grid.tsx
    |   |   |   +-- overdue-alert-banner.tsx
    |   |   |   +-- quick-actions.tsx
    |   |   |   +-- quote-conversion.tsx
    |   |   |   +-- recent-activity-feed.tsx
    |   |   |   +-- revenue-chart.tsx
    |   |   |   +-- today-schedule.tsx
    |   |   |
    |   |   +-- customers/          # Customer components
    |   |   |   +-- customer-activity-tab.tsx
    |   |   |   +-- customer-detail-header.tsx
    |   |   |   +-- customer-dialog.tsx
    |   |   |   +-- customer-equipment-tab.tsx
    |   |   |   +-- customer-info-panel.tsx
    |   |   |   +-- customer-invoices-tab.tsx
    |   |   |   +-- customer-jobs-tab.tsx
    |   |   |   +-- customer-notes-tab.tsx
    |   |   |   +-- customer-picker.tsx
    |   |   |   +-- customer-quotes-tab.tsx
    |   |   |   +-- customer-sidebar-panel.tsx
    |   |   |   +-- customer-table.tsx
    |   |   |   +-- customer-tabs-panel.tsx
    |   |   |   +-- customer-tags-input.tsx
    |   |   |
    |   |   +-- jobs/               # Job management components
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
    |   |   |   +-- jobs-stats-bar.tsx
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
    |   |   |   +-- invoice-table.tsx
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
    |   |   +-- settings/           # Settings page components
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
    |   |   +-- delete-confirm-dialog.tsx
    |   |   +-- empty-state.tsx
    |   |   +-- pagination.tsx
    |   |   +-- scroll-fade-area.tsx
    |   |   +-- table-skeleton.tsx
    |   |   +-- view-mode-toggle.tsx
    |   |
    |   +-- superadmin/             # Super admin components
    |       ~ (placeholder)
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
        |   |       +-- page.tsx                     # Job detail page (3-panel)
        |   |       +-- job-detail-client.tsx
        |   |
        |   +-- invoices/
        |   |   +-- page.tsx                         # Invoice list
        |   |   +-- invoices-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Invoice detail (3-panel)
        |   |       +-- invoice-detail-client.tsx
        |   |
        |   +-- quotes/
        |   |   +-- page.tsx                         # Quote list
        |   |   +-- quotes-page-client.tsx
        |   |   +-- [id]/
        |   |       +-- page.tsx                     # Quote detail (3-panel)
        |   |       +-- quote-detail-client.tsx
        |   |
        |   +-- bookings/
        |   |   ~ (placeholder)                      # Planned: booking queue
        |   |
        |   +-- schedule/
        |   |   ~ (placeholder)                      # Planned: calendar view
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
        |       +-- billing/
        |           ~ .gitkeep                       # Planned: subscription + affiliate widget
        |
        +-- (superadmin)/                            # -- Super Admin Panel (Admin role) --
        |   +-- superadmin/dashboard/page.tsx         # Placeholder admin dashboard
        |   ~ affiliates/                             # Planned
        |   ~ analytics/active-users/                 # Planned
        |   ~ dashboard/                              # Planned
        |   ~ support/                                # Planned
        |   ~ system/                                 # Planned
        |   ~ tenants/[id]/                           # Planned
        |
        +-- book/[slug]/                             # -- Public Booking Portal (Planned) --
        +-- ref/[code]/                              # -- Affiliate Redirect (Planned) --
        +-- api/
            +-- auth/                                # Next.js API routes for auth callbacks
            +-- webhooks/                            # Webhook handlers
```

---

## Packages

### `packages/database/` — Drizzle ORM + Supabase Client

```
packages/database/
+-- package.json              # @hvac-saas/database — drizzle-orm, postgres, @supabase/supabase-js
+-- tsconfig.json
+-- drizzle.config.ts         # Schema location, migration output, dotenv for DATABASE_URL
+-- src/
    +-- index.ts              # Barrel: getDb, closeDb, getSupabaseClient, getSupabaseAdmin, all schema
    +-- client.ts             # Drizzle client (lazy singleton via postgres driver)
    +-- supabase.ts           # Supabase client factories (tenant-scoped + admin)
    +-- schema/
        +-- index.ts              # Barrel re-export of all tables, enums, relations
        +-- enums.ts              # 12 pgEnum definitions
        +-- auth.ts               # Better Auth tables: user, session, account, verification, organization, member, invitation
        +-- tenants.ts            # tenants table (with organizationId FK)
        +-- users.ts              # users table (replaced by Better Auth user + member)
        +-- admin.ts              # adminAuditLog, adminImpersonationSessions, platformEvents
        +-- subscriptions.ts      # tenantSubscriptions (Lemon Squeezy fields)
        +-- customers.ts          # customers table
        +-- customer-notes.ts     # customerNotes table
        +-- customer-activities.ts # customerActivities table
        +-- catalog.ts            # catalogItems table
        +-- equipment.ts          # equipment, refrigerantLogs tables
        +-- maintenance.ts        # maintenanceContracts table
        +-- bookings.ts           # bookings table
        +-- jobs.ts               # jobs, jobLineItems, jobPhotos tables (status is text, not enum)
        +-- job-activities.ts     # jobActivities table
        +-- invoices.ts           # invoices, invoiceLineItems, invoicePayments tables
        +-- quotes.ts             # quotes, quoteLineItems tables
        +-- quote-activities.ts   # quoteActivities table
        +-- schedule.ts           # availabilitySchedules, scheduleOverrides tables
        +-- checklists.ts         # checklistTemplates, checklistItems, jobChecklistCompletions tables
        +-- pipeline-stages.ts    # jobPipelineStages table (per-tenant Kanban config)
        +-- tags.ts               # tags, customerTags tables
        +-- relations.ts          # All Drizzle relations() for query builder joins
```

### `packages/types/` — Shared TypeScript Types

Types inferred from Drizzle schema (`$inferSelect` / `$inferInsert`).

```
packages/types/
+-- package.json              # @hvac-saas/types — depends on @hvac-saas/database
+-- tsconfig.json
+-- src/
    +-- index.ts              # Barrel re-export
    +-- enums.ts              # Const arrays + union types for all enums
    +-- tenant.ts             # Tenant, TenantInsert, TenantUpdate
    +-- user.ts               # User, UserInsert
    +-- customer.ts           # Customer, CustomerInsert, CustomerUpdate
    +-- customer-note.ts      # CustomerNote types
    +-- customer-activity.ts  # CustomerActivity types
    +-- job.ts                # Job, JobInsert, JobUpdate, JobLineItem, JobPhoto
    +-- job-activity.ts       # JobActivity types
    +-- invoice.ts            # Invoice, InvoiceInsert, InvoiceUpdate, InvoiceLineItem, InvoicePayment
    +-- quote.ts              # Quote, QuoteInsert, QuoteUpdate, QuoteLineItem
    +-- booking.ts            # Booking, BookingInsert, BookingUpdate
    +-- catalog.ts            # CatalogItem, CatalogItemInsert, CatalogItemUpdate
    +-- checklist.ts          # ChecklistTemplate, ChecklistItem, JobChecklistCompletion
    +-- equipment.ts          # Equipment, EquipmentInsert, RefrigerantLog
    +-- schedule.ts           # AvailabilitySchedule, ScheduleOverride
    +-- pipeline-stage.ts     # PipelineStage, PipelineStageInsert
    +-- tag.ts                # Tag, CustomerTag types
    +-- dashboard.ts          # DashboardStats + related metric interfaces
    +-- subscription.ts       # TenantSubscription, TenantSubscriptionInsert
    +-- admin.ts              # AdminAuditLog, AdminImpersonationSession, PlatformEvent
```

### `packages/ui/` — Shared UI Component Library

```
packages/ui/
+-- package.json              # @hvac-saas/ui
+-- tsconfig.json
+-- src/
    ~ index.ts                # Placeholder (export {})
```

### `packages/email/` — React Email Templates

```
packages/email/
+-- package.json              # @hvac-saas/email
+-- tsconfig.json
+-- src/
    ~ index.ts                # Placeholder (export {})
```

**Planned templates (E-01 through E-13):** See PRD for full list. Not yet implemented.

### `packages/config/` — Shared Configuration

```
packages/config/
+-- package.json              # @hvac-saas/config
```

---

## Database Tables (33 total)

### Better Auth Tables (7)

| Table | Purpose |
|---|---|
| `user` | User accounts (text IDs, not UUID) |
| `session` | Active sessions |
| `account` | Auth providers |
| `verification` | Email verification tokens |
| `organization` | Better Auth organizations (map to tenants) |
| `member` | Organization membership |
| `invitation` | Org invitations |

### Business Tables (26)

| Table | Purpose | Key Fields |
|---|---|---|
| `tenants` | Business accounts | business_name, slug, organizationId FK, defaultTaxRate, invoice/quote settings |
| `tenant_subscriptions` | Billing state | lemonSqueezySubscriptionId, status, planName |
| `customers` | Tenant's customers | first_name, last_name, email, phone, address, lat/lng |
| `customer_notes` | Per-customer notes | customer_id, content, author tracking |
| `customer_activities` | Activity timeline | customer_id, activity_type, metadata |
| `tags` | Tenant-level tags | tenant_id, name, color |
| `customer_tags` | Many-to-many junction | customer_id, tag_id |
| `catalog_items` | Price book | name, item_type, unit_price, unit, category |
| `equipment` | Customer equipment | customer_id, equipment_type, brand, model, serial |
| `refrigerant_logs` | EPA tracking | equipment_id, job_id, refrigerant_type, amount_lbs |
| `maintenance_contracts` | Service contracts | customer_id, status, frequency, price |
| `jobs` | Service jobs | customer_id, job_number (JOB-YYYY-XXXX), status (text) |
| `job_line_items` | Job charges | job_id, catalog_item_id, qty, unit_price, total (generated) |
| `job_photos` | Job site photos | job_id, storage_path, caption |
| `job_activities` | Job activity log | job_id, activity_type, metadata |
| `job_pipeline_stages` | Per-tenant Kanban config | tenant_id, name, label, color, sortOrder, isDefault |
| `invoices` | Billing documents | invoice_number (INV-YYYY-XXXX), status, total |
| `invoice_line_items` | Invoice charges | invoice_id, qty, unit_price, total (generated) |
| `invoice_payments` | Payment records | invoice_id, amount, payment_method |
| `quotes` | Estimates | quote_number (QT-YYYY-XXXX), status, expiresAt |
| `quote_line_items` | Quote charges | quote_id, qty, unit_price, total (generated) |
| `quote_activities` | Quote activity log | quote_id, activity_type, metadata |
| `bookings` | Online bookings | customer_id, status, booking_date, service_type |
| `availability_schedules` | Weekly availability | day_of_week, start_time, end_time |
| `schedule_overrides` | Day-off / special hours | override_date, is_available, reason |
| `checklist_templates` | Per-service-type templates | service_type, name, is_active |
| `checklist_items` | Template items | template_id, label, is_required, catalog_item_id |
| `job_checklist_completions` | Per-job tracking | job_id, checklist_item_id, is_completed |
| `admin_audit_log` | Admin action log | action, target_tenant_id, metadata |
| `admin_impersonation_sessions` | Impersonation tracking | admin_user_id, tenant_id, reason |
| `platform_events` | Activity tracking | tenant_id, event_type, user_id |

---

## Authentication Architecture

### Better Auth (Unified)

```
/login (single page)
    |
    +-- signIn.email({ email, password }) via Better Auth React client
        +-- Match -> Better Auth session cookie
        |   +-- role === "admin" -> /superadmin/dashboard
        |   +-- Otherwise -> /dashboard (OrgResolver ensures tenant)
        +-- Fail -> "Invalid credentials" error
```

### Route Protection

| Path | Required Auth | Method |
|---|---|---|
| `/`, `/login`, `/signup`, `/forgot-password` | None (public) | middleware.ts |
| `/book/*`, `/ref/*` | None | middleware.ts |
| `/dashboard/*` | Better Auth session | middleware.ts + requireTenant |
| `/superadmin/*` | Better Auth session (admin role) | middleware.ts + requireAdmin |

---

## Package Dependency Graph

```
apps/api  --> @hvac-saas/database +
          --> @hvac-saas/types +

apps/web  --> @hvac-saas/types +
          --> @hvac-saas/ui ~

packages/types --> @hvac-saas/database +
```

---

## Build Order Progress (Phase 1)

| # | Feature | Status |
|---|---------|--------|
| 1 | Organization/Tenant creation flow | + Done |
| 2 | Customer CRUD | + Done |
| 3 | Service Catalog | + Done |
| 4 | Job Management (Kanban) | + Done |
| 5 | Invoicing | + Done |
| 6 | Quote Builder | + Done |
| 7 | KPI Dashboard | + Done |
| 8 | Booking Portal | - Not started |
| 9 | Calendar/Schedule View | - Not started (blocked by #8) |
| 10 | Checklists | + Done |
| 11 | Super Admin Panel | ~ Placeholder only |
| 12 | Email Templates | - Not started (blocked by #8) |
| 13 | Affiliate Program | - Not started (blocked by #11) |
| 14 | Settings | + Done (except Billing tab) |
