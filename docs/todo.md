# Todo

Task tracking for in-progress and upcoming work.

## In Progress

(none)

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

- [ ] **Service Catalog** (#3) — API routes + settings page

## Done

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
