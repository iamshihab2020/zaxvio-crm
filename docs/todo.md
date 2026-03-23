# Todo

Task tracking for in-progress and upcoming work.

## In Progress

- [ ] **Invoicing (#5)** — Next up from Build Order

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

## Upcoming

Items not yet started (next up from Build Order above):

- [ ] **Invoicing** (#5) — API routes + invoice page, generate from jobs, PDF, email, payment tracking
- [ ] **Quote Builder** (#6) — API routes + quote page, PDF, email, customer acceptance, convert to job

## Done

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
