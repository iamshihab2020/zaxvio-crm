# REPO_MAP.md — HVAC SaaS Platform (Zaxvio CRM)

> **Product**: HVAC Field Service Management SaaS for solo contractors (1–3 person teams)
> **Stack**: Next.js 14 + Fastify + Supabase + Drizzle ORM + Mapbox + Resend + Lemon Squeezy
> **Monorepo**: Turborepo + pnpm workspaces
> **Subscription**: $49/month per tenant

> **Legend**: `✅` = exists and implemented | `📁` = folder exists but empty/placeholder | `🔲` = planned, not yet created

---

## Root Configuration

```
zaxvio-crm/
├── ✅ package.json              # Root scripts: dev, build, lint, typecheck, test, db:*, seed:admin
├── ✅ pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
├── ✅ turbo.json                # Pipeline: build, lint, typecheck, test, dev
├── ✅ tsconfig.json             # Base TS config (ES2022, strict)
├── ✅ .prettierrc               # Semi, double quotes, trailing comma, width 100
├── ✅ .npmrc                    # auto-install-peers, no strict peer deps
├── ✅ .env                      # Supabase credentials + DATABASE_URL (not committed)
├── ✅ .env.example              # Template for all env vars
├── ✅ .gitignore
├── ✅ CLAUDE.md                 # AI assistant instructions + strict rules
├── ✅ README.md
├── ✅ pnpm-lock.yaml
│
├── docs/
│   ├── ✅ todo.md               # Task tracking (In Progress / Upcoming / Done)
│   ├── ✅ lessons.md            # Non-obvious insights and patterns
│   ├── materials/
│   │   └── ✅ frontend_materials.md
│   └── Project Doc/
│       ├── ✅ HVAC_SaaS_Phase1_PRD_v2.md                          # PRD (source of truth)
│       ├── ✅ HVAC_SaaS_System_Diagrams_and_Unified_Auth.md       # Architecture diagrams
│       ├── ✅ HVAC_Saas_Proposal.md                               # Business proposal
│       └── ✅ REPO_MAP.md                                         # ← This file
│
└── supabase/
    └── migrations/
        └── ✅ 20260314000001_rls_triggers.sql    # RLS policies + triggers (hand-written)
```

---

## Apps

### `apps/api/` — Fastify Backend (Port 4000)

REST API server. Multi-tenant middleware, admin routes, webhooks, cron jobs, PDF generation.

```
apps/api/
├── ✅ package.json              # name: "api", deps: fastify, @fastify/cors, @fastify/jwt, etc.
├── ✅ tsconfig.json
├── src/
│   ├── ✅ server.ts             # Entry point — Fastify with CORS, Swagger, health, graceful shutdown
│   ├── plugins/
│   │   └── ✅ admin-auth.ts     # @fastify/jwt namespaced plugin (4h TTL) + verifyAdmin decorator
│   ├── lib/
│   │   └── ✅ env.ts            # Zod-validated env loading (dotenv from monorepo root)
│   ├── 📁 services/             # Business logic layer
│   ├── routes/
│   │   ├── admin/
│   │   │   └── ✅ auth.ts       # POST /admin/auth/login (bcrypt + JWT)
│   │   ├── 🔲 jobs/             # /jobs — CRUD, status transitions, checklist completion
│   │   ├── 🔲 customers/        # /customers — CRUD, search, equipment linkage
│   │   ├── 🔲 invoices/         # /invoices — CRUD, PDF gen, send via Resend, payments
│   │   ├── 🔲 quotes/           # /quotes — CRUD, PDF, send, convert-to-job, expiry
│   │   ├── 🔲 bookings/         # /bookings — public submit, owner confirm → create job
│   │   └── 🔲 webhooks/         # /webhooks/lemon-squeezy — subscription events
│   ├── 📁 jobs/                 # Background cron runners
│   └── scripts/
│       └── ✅ seed-admin.ts     # Seed first super admin from env vars (idempotent)
├── 🔲 tests/
│   ├── 🔲 unit/
│   └── 🔲 integration/
```

**Key API Route Groups:**

| Route Group | Auth | Description | Status |
|---|---|---|---|
| `/admin/auth` | None → Admin JWT | Admin login (bcrypt + JWT) | ✅ |
| `/admin/tenants` | Admin JWT | Tenant list, detail, impersonate | 🔲 |
| `/admin/analytics` | Admin JWT | MRR, signups, churn, active users | 🔲 |
| `/admin/search` | Admin JWT | Global cross-tenant search | 🔲 |
| `/admin/audit-log` | Admin JWT | All admin actions | 🔲 |
| `/admin/system` | Admin JWT | Webhook log, cron history | 🔲 |
| `/admin/affiliates` | Admin JWT | Affiliate attribution data | 🔲 |
| `/jobs` | Supabase JWT | Job CRUD, status flow, checklist completions | 🔲 |
| `/customers` | Supabase JWT | Customer CRUD, search | 🔲 |
| `/invoices` | Supabase JWT | Invoice CRUD, PDF, email, payments | 🔲 |
| `/quotes` | Supabase JWT | Quote CRUD, PDF, send, convert to job | 🔲 |
| `/bookings` | Supabase JWT | Booking management | 🔲 |
| `/catalog` | Supabase JWT | Service catalog / price book CRUD | 🔲 |
| `/checklists` | Supabase JWT | Checklist templates + completions | 🔲 |
| `/equipment` | Supabase JWT | Equipment CRUD | 🔲 |
| `/refrigerant-logs` | Supabase JWT | EPA refrigerant tracking | 🔲 |
| `/availability` | Supabase JWT | Schedule + overrides | 🔲 |
| `/settings` | Supabase JWT | Tenant profile, billing | 🔲 |
| `/public/booking` | None | Public booking portal | 🔲 |
| `/webhooks/lemon-squeezy` | Signature | Subscription lifecycle | 🔲 |

---

### `apps/web/` — Next.js 14 Frontend (Port 3000)

Unified app: landing page + auth + tenant dashboard + super admin panel + public booking portal.

```
apps/web/
├── ✅ package.json              # name: "web", deps: @hvac-saas/types, @hvac-saas/ui, better-auth, next-themes
├── ✅ tsconfig.json
├── ✅ next.config.mjs           # staleTimes: { dynamic: 0, static: 0 } (Router Cache fix)
├── ✅ tailwind.config.ts
├── public/
│   └── assets/
│       ├── ✅ icon.png
│       └── ✅ logo.png
├── src/
│   ├── ✅ middleware.ts          # Route protection: public paths passthrough, else check Better Auth cookie
│   ├── 📁 actions/               # Server Actions — ONLY gateway for API calls
│   ├── 📁 hooks/                 # Custom React hooks
│   ├── lib/
│   │   ├── ✅ auth-client.ts     # Better Auth React client (signIn, signUp, signOut, useSession)
│   │   ├── ✅ auth-server.ts     # Server-side session helper (forwards cookies for SSR)
│   │   └── ✅ utils.ts           # cn() helper (clsx + tailwind-merge)
│   ├── components/
│   │   ├── ✅ auth-shell.tsx     # Split-panel auth wrapper (brand panel + form panel)
│   │   ├── ✅ logo.tsx           # Logo component
│   │   ├── ✅ refresh-on-nav.tsx # Fixes Next.js 14 back/forward stale cache (popstate → router.refresh)
│   │   ├── ✅ theme-provider.tsx # next-themes wrapper
│   │   ├── ✅ theme-toggle.tsx   # Light/dark toggle button
│   │   ├── 📁 dashboard/         # Dashboard-specific components
│   │   ├── 📁 superadmin/        # Super admin components
│   │   ├── landing/              # Landing page section components
│   │   │   ├── ✅ navbar.tsx
│   │   │   ├── ✅ hero-section.tsx
│   │   │   ├── ✅ features-section.tsx
│   │   │   ├── ✅ how-it-works-section.tsx
│   │   │   ├── ✅ pricing-section.tsx
│   │   │   ├── ✅ testimonials-section.tsx
│   │   │   ├── ✅ faq-section.tsx
│   │   │   ├── ✅ final-cta-section.tsx
│   │   │   ├── ✅ footer.tsx
│   │   │   └── ✅ section-reveal.tsx  # IntersectionObserver scroll reveal
│   │   └── ui/                    # shadcn/ui primitives
│   │       ├── ✅ accordion.tsx
│   │       ├── ✅ badge.tsx
│   │       ├── ✅ button.tsx
│   │       ├── ✅ card.tsx
│   │       ├── ✅ input.tsx
│   │       ├── ✅ label.tsx
│   │       └── ✅ separator.tsx
│   ├── app/
│   │   ├── ✅ layout.tsx          # Root layout — fonts, ThemeProvider, RefreshOnNav
│   │   ├── ✅ globals.css         # CSS variables, Tailwind layers, color system
│   │   ├── ✅ icon.png            # Favicon
│   │   │
│   │   ├── (landing)/                         # ── Landing Page (Public) ──
│   │   │   └── ✅ page.tsx                    # Hero, features, pricing, FAQ, testimonials
│   │   │
│   │   ├── (auth)/                            # ── Auth Pages (Public, NO layout.tsx) ──
│   │   │   ├── ✅ login/page.tsx              # Email/password sign-in (uses AuthShell)
│   │   │   ├── ✅ signup/page.tsx             # Registration + org creation (uses AuthShell)
│   │   │   └── ✅ forgot-password/page.tsx    # Password reset request (uses AuthShell)
│   │   │
│   │   ├── (dashboard)/                       # ── Tenant Dashboard (Better Auth session) ──
│   │   │   ├── ✅ dashboard/page.tsx          # KPI Homepage
│   │   │   ├── 📁 jobs/                       # Kanban board + job detail
│   │   │   ├── 📁 customers/                  # Customer list, detail
│   │   │   ├── 📁 invoices/                   # Invoice list, create, PDF
│   │   │   ├── 📁 quotes/                     # Quote list, create, PDF
│   │   │   ├── 📁 bookings/                   # Booking queue
│   │   │   ├── 📁 schedule/                   # Calendar view
│   │   │   └── settings/
│   │   │       ├── 📁 business/               # Business profile
│   │   │       ├── 📁 billing/                # Subscription
│   │   │       ├── 📁 catalog/                # Price book CRUD
│   │   │       └── 📁 checklists/             # Checklist templates
│   │   │
│   │   ├── (superadmin)/                      # ── Super Admin Panel (Admin role) ──
│   │   │   ├── ✅ superadmin/dashboard/page.tsx  # Admin dashboard
│   │   │   ├── 📁 dashboard/                  # MRR, signups, active users
│   │   │   ├── 📁 tenants/[id]/               # Tenant detail, impersonation
│   │   │   ├── 📁 analytics/active-users/     # Active users analytics
│   │   │   ├── 📁 support/                    # Global search, audit log
│   │   │   ├── 📁 affiliates/                 # Affiliate performance
│   │   │   └── 📁 system/                     # Webhook log, cron history
│   │   │
│   │   ├── 📁 book/[slug]/                    # ── Public Booking Portal ──
│   │   ├── 📁 ref/[code]/                     # ── Affiliate Redirect ──
│   │   └── api/
│   │       ├── 📁 auth/                       # /api/auth/* proxy
│   │       └── 📁 webhooks/                   # Webhook handlers
```

---

## Packages

### `packages/database/` — Drizzle ORM + Supabase Client ✅

```
packages/database/
├── ✅ package.json              # name: @hvac-saas/database, deps: drizzle-orm, postgres, @supabase/supabase-js
├── ✅ tsconfig.json
├── ✅ drizzle.config.ts         # Schema location, migration output, dotenv for DATABASE_URL
└── src/
    ├── ✅ index.ts              # Barrel: getDb, closeDb, getSupabaseClient, getSupabaseAdmin, all schema
    ├── ✅ client.ts             # Drizzle client (lazy singleton via postgres driver)
    ├── ✅ supabase.ts           # Supabase client factories (tenant-scoped + admin)
    └── schema/
        ├── ✅ index.ts          # Barrel re-export of all tables, enums, relations
        ├── ✅ enums.ts          # 13 pgEnum definitions
        ├── ✅ tenants.ts        # tenants table
        ├── ✅ admin.ts          # adminUsers, adminAuditLog, adminImpersonationSessions, platformEvents
        ├── ✅ users.ts          # users table
        ├── ✅ subscriptions.ts  # tenantSubscriptions table
        ├── ✅ customers.ts      # customers table
        ├── ✅ catalog.ts        # catalogItems table
        ├── ✅ equipment.ts      # equipment, refrigerantLogs tables
        ├── ✅ maintenance.ts    # maintenanceContracts table
        ├── ✅ bookings.ts       # bookings table
        ├── ✅ jobs.ts           # jobs, jobLineItems, jobPhotos tables
        ├── ✅ invoices.ts       # invoices, invoiceLineItems, invoicePayments tables
        ├── ✅ quotes.ts         # quotes, quoteLineItems tables
        ├── ✅ schedule.ts       # availabilitySchedules, scheduleOverrides tables
        ├── ✅ checklists.ts     # checklistTemplates, checklistItems, jobChecklistCompletions tables
        └── ✅ relations.ts      # All Drizzle relations() for query builder joins
```

### `packages/types/` — Shared TypeScript Types ✅

```
packages/types/
├── ✅ package.json              # name: @hvac-saas/types, deps: @hvac-saas/database
├── ✅ tsconfig.json
└── src/
    ├── ✅ index.ts              # Barrel re-export
    ├── ✅ enums.ts              # Const arrays + union types for all 13 enums
    ├── ✅ tenant.ts             # Tenant, TenantInsert, TenantUpdate
    ├── ✅ user.ts               # User, UserInsert
    ├── ✅ customer.ts           # Customer, CustomerInsert, CustomerUpdate
    ├── ✅ job.ts                # Job, JobInsert, JobUpdate, JobLineItem, JobPhoto
    ├── ✅ invoice.ts            # Invoice, InvoiceInsert, InvoiceUpdate, InvoiceLineItem, InvoicePayment
    ├── ✅ quote.ts              # Quote, QuoteInsert, QuoteUpdate, QuoteLineItem
    ├── ✅ booking.ts            # Booking, BookingInsert, BookingUpdate
    ├── ✅ catalog.ts            # CatalogItem, CatalogItemInsert, CatalogItemUpdate
    ├── ✅ equipment.ts          # Equipment, EquipmentInsert, RefrigerantLog
    ├── ✅ checklist.ts          # ChecklistTemplate, ChecklistItem, JobChecklistCompletion
    ├── ✅ schedule.ts           # AvailabilitySchedule, ScheduleOverride
    ├── ✅ admin.ts              # AdminUser, AdminAuditLog, AdminImpersonationSession, PlatformEvent
    └── ✅ subscription.ts       # TenantSubscription, TenantSubscriptionInsert
```

### `packages/ui/` — Shared UI Component Library 📁

```
packages/ui/
├── ✅ package.json              # name: @hvac-saas/ui
├── ✅ tsconfig.json
└── src/
    └── 📁 index.ts              # Placeholder (export {})
```

### `packages/email/` — React Email Templates 📁

```
packages/email/
├── ✅ package.json              # name: @hvac-saas/email
├── ✅ tsconfig.json
└── src/
    └── 📁 index.ts              # Placeholder (export {})
```

**Planned email templates (E-01 through E-13):**

| Email ID | Trigger | Description | Status |
|---|---|---|---|
| E-01 | Signup | Welcome email to new tenant owner | 🔲 |
| E-02 | Booking created | Confirmation to customer | 🔲 |
| E-03 | Booking created | Notification to owner | 🔲 |
| E-04 | Booking confirmed | Confirmation to customer | 🔲 |
| E-05 | Job completed | Notification to customer | 🔲 |
| E-06 | Invoice sent | Invoice email with PDF | 🔲 |
| E-07 | Invoice reminder | Overdue invoice reminder | 🔲 |
| E-08 | Invoice paid | Payment confirmation | 🔲 |
| E-09 | Maintenance due | Contract maintenance reminder | 🔲 |
| E-10 | Trial expiring | Trial expiration warning | 🔲 |
| E-11 | First paid sub | Welcome + affiliate referral link | 🔲 |
| E-12 | Invoice paid | Google review request (2h delay) | 🔲 |
| E-13 | Quote sent | Estimate email with PDF | 🔲 |

### `packages/config/` — Shared Configuration 📁

```
packages/config/
├── ✅ package.json              # name: @hvac-saas/config
└── 🔲 eslint.config.js          # Shared ESLint config
```

---

## Database — Supabase (PostgreSQL 15 + RLS) ✅

All 26 tables pushed to Supabase. 23 tables have RLS enabled. 13 custom enums. 13 triggers (updated_at + auto-numbering).

### Core Business Tables (26 total)

| Table | Purpose | Key Fields | Status |
|---|---|---|---|
| `tenants` | Business accounts | business_name, slug, owner_email, is_active, trial_ends_at | ✅ |
| `tenant_subscriptions` | Billing state | lemon_squeezy_subscription_id, status, plan_name | ✅ |
| `users` | Tenant team members | tenant_id, email, full_name, role | ✅ |
| `customers` | Tenant's customers | first_name, last_name, email, phone, address, lat/lng | ✅ |
| `catalog_items` | Price book | name, item_type, unit_price, unit, category | ✅ |
| `equipment` | Customer equipment | customer_id, equipment_type, brand, model, serial_number | ✅ |
| `refrigerant_logs` | EPA tracking | equipment_id, job_id, refrigerant_type, amount_lbs | ✅ |
| `maintenance_contracts` | Service contracts | customer_id, status, start_date, frequency, price | ✅ |
| `jobs` | Service jobs | customer_id, job_number (JOB-YYYY-XXXX), status, service_type | ✅ |
| `job_line_items` | Job charges | job_id, catalog_item_id, qty, unit_price, total (generated) | ✅ |
| `job_photos` | Job site photos | job_id, storage_path, caption | ✅ |
| `invoices` | Billing documents | customer_id, invoice_number (INV-YYYY-XXXX), status, total | ✅ |
| `invoice_line_items` | Invoice charges | invoice_id, qty, unit_price, total (generated) | ✅ |
| `invoice_payments` | Payment records | invoice_id, amount, payment_method | ✅ |
| `quotes` | Estimates | customer_id, quote_number (QT-YYYY-XXXX), status, total | ✅ |
| `quote_line_items` | Quote charges | quote_id, qty, unit_price, total (generated) | ✅ |
| `bookings` | Online bookings | customer_id, status, booking_date, service_type | ✅ |
| `availability_schedules` | Weekly availability | day_of_week, start_time, end_time | ✅ |
| `schedule_overrides` | Day-off / special hours | override_date, is_available, reason | ✅ |
| `checklist_templates` | Per-service-type templates | service_type, name, is_active | ✅ |
| `checklist_items` | Template items | template_id, label, is_required, catalog_item_id | ✅ |
| `job_checklist_completions` | Per-job tracking | job_id, checklist_item_id, is_completed | ✅ |
| `admin_users` | Admin accounts (no RLS) | email, password_hash (bcrypt), role, is_active | ✅ |
| `admin_audit_log` | Action log (no RLS) | admin_user_id, action, target_tenant_id, metadata | ✅ |
| `admin_impersonation_sessions` | Impersonation (no RLS) | admin_user_id, tenant_id, reason | ✅ |
| `platform_events` | Activity tracking (INSERT-only RLS) | tenant_id, event_type, user_id | ✅ |

---

## Authentication Architecture

### Unified Auth (Better Auth)

```
/login (single page)
    │
    └─ signIn.email({ email, password }) via Better Auth React client
        ├─ Match → Better Auth session cookie
        │   ├─ role === "admin" → /superadmin/dashboard
        │   └─ Otherwise → /dashboard
        └─ Fail → "Invalid credentials" error
```

### Route Protection (middleware.ts)

| Path | Required Auth | Cookie |
|---|---|---|
| `/`, `/login`, `/signup`, `/forgot-password` | None (public) | — |
| `/book/*` | None | — |
| `/ref/*` | None | Sets `aff_code` (30-day) |
| `/dashboard/*` | Better Auth session | `better-auth.session_token` |
| `/superadmin/*` | Better Auth session (admin role) | `better-auth.session_token` |

---

## Key Data Flows

### Job Lifecycle

```
Booking/Direct → Job (scheduled) → Checklist auto-attach → Tech completes items
→ Auto line items from catalog → Complete job → Generate invoice → Send email
→ Customer pays → Mark paid → Auto review request email (2h delay)
```

### Quote-to-Job

```
Create quote → Add catalog line items → Generate PDF → Email to customer
→ Customer accepts → "Create Job" → Job with same line items → Normal job flow
```

### Affiliate Flow

```
/ref/[code] → Set aff_code cookie → Signup → Lemon Squeezy checkout
→ LS detects affiliate → subscription_created webhook → Save affiliate_id to tenant
→ LS handles commission payouts
```

---

## External Integrations

| Service | Purpose | Integration Point | Status |
|---|---|---|---|
| **Supabase** | Database, Auth, Storage, Realtime | `packages/database/` | ✅ DB connected |
| **Drizzle ORM** | Schema-as-code, type-safe queries | `packages/database/src/schema/` | ✅ Schema pushed |
| **Mapbox GL JS** | Address autocomplete, GPS maps | Booking portal, customer address | 🔲 |
| **Resend** | Transactional email | `packages/email/` templates | 🔲 |
| **Lemon Squeezy** | Subscription billing + affiliates | Webhook handler, checkout | 🔲 |
| **react-big-calendar** | Calendar view | `/dashboard/schedule` | 🔲 |
| **pdfkit** | PDF generation | Invoice + Quote PDFs | 🔲 |

---

## Package Dependency Graph

```
apps/api  ──→ @hvac-saas/database ✅
          ──→ @hvac-saas/types ✅
          ──→ @hvac-saas/email 📁
          ──→ @hvac-saas/config 📁

apps/web  ──→ @hvac-saas/types ✅
          ──→ @hvac-saas/ui 📁
          ──→ @hvac-saas/config 📁

packages/types ──→ @hvac-saas/database ✅
```

---

## Dev Commands

```bash
pnpm dev                      # Start all (API + web)
pnpm dev:api                  # Fastify on :4000
pnpm dev:web                  # Next.js on :3000
pnpm build                    # Build all
pnpm lint                     # Lint all
pnpm typecheck                # TypeCheck all
pnpm test                     # Run all tests
pnpm db:generate              # Generate migrations from Drizzle schema
pnpm db:push                  # Push schema to DB (dev only)
pnpm db:studio                # Open Drizzle Studio
pnpm db:migrate               # Run pending migrations
pnpm seed:admin               # Seed first super admin
```
