# REPO_MAP.md — HVAC SaaS Platform (Zaxvio CRM)

> **Product**: HVAC Field Service Management SaaS for solo contractors (1–3 person teams)
> **Stack**: Next.js 14 + Fastify + Supabase + Mapbox + Resend + Lemon Squeezy
> **Monorepo**: Turborepo + pnpm workspaces
> **Subscription**: $49/month per tenant

---

## Root Configuration

```
zaxvio-crm/
├── package.json              # Root scripts: dev, build, lint, typecheck, test
├── pnpm-workspace.yaml       # Workspaces: apps/*, packages/*
├── turbo.json                # Pipeline: build, lint, typecheck, test, dev
├── tsconfig.json             # Base TS config (ES2022, strict)
├── .prettierrc               # Semi, double quotes, trailing comma, width 100
├── .npmrc                    # auto-install-peers, no strict peer deps
├── .env.example              # All env vars (Supabase, Fastify, Mapbox, Resend, LS)
├── .gitignore
├── CLAUDE.md                 # AI assistant instructions
└── REPO_MAP.md               # ← This file
```

---

## Apps

### `apps/api/` — Fastify Backend (Port 4000)

REST API server. Multi-tenant middleware, admin routes, webhooks, cron jobs, PDF generation.

```
apps/api/
├── package.json              # name: "api", deps: @hvac-saas/database, @hvac-saas/types
├── tsconfig.json
├── src/
│   ├── server.ts             # Entry point — Fastify + plugins (CORS, JWT, rate limit, Swagger)
│   ├── plugins/              # Fastify plugins (auth, tenant context, etc.)
│   ├── lib/                  # Shared utilities (auth helpers, Supabase client, PDF gen)
│   ├── services/             # Business logic layer
│   ├── routes/
│   │   ├── jobs/             # /jobs — CRUD, status transitions, checklist completion
│   │   ├── customers/        # /customers — CRUD, search, equipment linkage
│   │   ├── invoices/         # /invoices — CRUD, PDF gen, send via Resend, payments
│   │   ├── quotes/           # /quotes — CRUD, PDF, send, convert-to-job, expiry
│   │   ├── bookings/         # /bookings — public submit, owner confirm → create job
│   │   ├── admin/            # /admin/* — super admin routes (tenant mgmt, analytics, impersonation)
│   │   └── webhooks/         # /webhooks/lemon-squeezy — subscription events, affiliate capture
│   ├── jobs/                 # Background cron runners
│   │   │                     #   - Invoice reminders (daily 9am)
│   │   │                     #   - Quote expiry (daily midnight)
│   │   │                     #   - Review request emails (every 2h)
│   │   │                     #   - Platform events aggregation
│   └── scripts/
│       └── seed-admin.ts     # Seed first super admin from env vars
├── tests/
│   ├── unit/
│   └── integration/
```

**Key API Route Groups:**

| Route Group | Auth | Description |
|---|---|---|
| `/jobs` | Supabase JWT | Job CRUD, status flow, checklist completions |
| `/customers` | Supabase JWT | Customer CRUD, search |
| `/invoices` | Supabase JWT | Invoice CRUD, PDF, email, payments |
| `/quotes` | Supabase JWT | Quote CRUD, PDF, send, convert to job |
| `/bookings` | Supabase JWT | Booking management |
| `/catalog` | Supabase JWT | Service catalog / price book CRUD |
| `/checklists` | Supabase JWT | Checklist templates + completions |
| `/equipment` | Supabase JWT | Equipment CRUD |
| `/refrigerant-logs` | Supabase JWT | EPA refrigerant tracking |
| `/availability` | Supabase JWT | Schedule + overrides |
| `/settings` | Supabase JWT | Tenant profile, billing |
| `/public/booking` | None | Public booking portal availability + submit |
| `/admin/auth` | None → Admin JWT | Admin login (bcrypt + JWT) |
| `/admin/tenants` | Admin JWT | Tenant list, detail, impersonate, activate/deactivate |
| `/admin/analytics` | Admin JWT | MRR, signups, churn, active users, feature adoption |
| `/admin/search` | Admin JWT | Global cross-tenant search |
| `/admin/audit-log` | Admin JWT | All admin actions |
| `/admin/system` | Admin JWT | Webhook log, cron history |
| `/admin/affiliates` | Admin JWT | Affiliate attribution data |
| `/webhooks/lemon-squeezy` | Signature | Subscription lifecycle + affiliate capture |

---

### `apps/web/` — Next.js 14 Frontend (Port 3000)

Unified app: tenant dashboard + super admin panel + public booking portal.

```
apps/web/
├── package.json              # name: "web", deps: @hvac-saas/types, @hvac-saas/ui
├── tsconfig.json             # Next.js plugin, jsx: preserve
├── src/
│   ├── middleware.ts          # Route protection: /superadmin/* → admin_token, /dashboard/* → Supabase session
│   ├── actions/               # Server Actions — ONLY gateway for API calls from frontend
│   ├── components/            # Shared React components
│   ├── hooks/                 # Custom React hooks
│   ├── lib/                   # Client utilities (Supabase client, helpers)
│   ├── app/
│   │   ├── layout.tsx
│   │   │
│   │   ├── (auth)/                        # ── Auth Pages (Public) ──
│   │   │   ├── login/                     # Unified login (tenant + admin auto-detect)
│   │   │   ├── signup/                    # Tenant owner registration + onboarding
│   │   │   └── forgot-password/           # Password reset flow
│   │   │
│   │   ├── (dashboard)/                   # ── Tenant Dashboard (Supabase JWT) ──
│   │   │   ├── page.tsx                   # KPI Homepage: 6 cards (jobs today, revenue, open invoices, etc.)
│   │   │   ├── jobs/                      # Kanban board + job detail (realtime via Supabase)
│   │   │   ├── customers/                 # Customer list, detail, equipment, service history
│   │   │   ├── invoices/                  # Invoice list, create, PDF, send, payments
│   │   │   ├── quotes/                    # Quote list, create, PDF, send, convert-to-job
│   │   │   ├── bookings/                  # Booking queue, confirm → create job
│   │   │   ├── schedule/                  # Calendar view (react-big-calendar), drag reschedule
│   │   │   └── settings/
│   │   │       ├── business/              # Business profile, google_review_url, review toggle
│   │   │       ├── billing/               # Lemon Squeezy subscription, Refer & Earn widget
│   │   │       ├── catalog/               # Service catalog / price book CRUD, CSV import
│   │   │       └── checklists/            # Checklist template builder per service type
│   │   │
│   │   ├── (superadmin)/                  # ── Super Admin Panel (Admin JWT) ──
│   │   │   ├── layout.tsx                 # Red sidebar + "ADMIN" badge
│   │   │   ├── dashboard/                 # MRR card, signups chart, active users, churn summary
│   │   │   ├── tenants/                   # Tenant list, detail, impersonation, activate/deactivate
│   │   │   ├── analytics/                 # MRR, signups, trial conversion, churn, feature adoption
│   │   │   ├── support/                   # Global search, audit log, email delivery log
│   │   │   ├── affiliates/                # Affiliate attribution table, referred MRR
│   │   │   └── system/                    # Webhook log, cron history, health
│   │   │
│   │   ├── book/[slug]/                   # ── Public Booking Portal (No Auth) ──
│   │   │                                  # Customer-facing: service select → date → time → submit
│   │   │
│   │   ├── ref/[code]/                    # ── Affiliate Redirect (No Auth) ──
│   │   │                                  # Sets aff_code cookie (30-day), redirects to /
│   │   │
│   │   └── api/                           # Next.js API routes (thin proxy to Fastify)
│   │       └── auth/                      # /api/auth/login → tries admin first, falls back to Supabase
│   │
├── public/
```

---

## Packages

### `packages/database/` — Supabase Client Wrapper

```
packages/database/
├── package.json              # name: @hvac-saas/database
├── tsconfig.json
└── src/                      # Supabase client init, typed helpers, RLS context
```

Exports: `getSupabaseClient()`, `getSupabaseAdmin()` (service role, bypasses RLS)

### `packages/types/` — Shared TypeScript Types

```
packages/types/
├── package.json              # name: @hvac-saas/types
├── tsconfig.json
└── src/                      # Shared interfaces: Tenant, Customer, Job, Invoice, Quote, etc.
```

### `packages/ui/` — Shared UI Component Library

```
packages/ui/
├── package.json              # name: @hvac-saas/ui
├── tsconfig.json             # jsx: react-jsx
└── src/
    └── components/           # Reusable React components (buttons, cards, forms, tables)
```

### `packages/email/` — React Email Templates

```
packages/email/
├── package.json              # name: @hvac-saas/email
├── tsconfig.json
└── src/
    ├── components/           # Shared email layout components
    └── templates/            # E-01 through E-13 email templates (Resend)
```

| Email ID | Trigger | Description |
|---|---|---|
| E-01 | Signup | Welcome email to new tenant owner |
| E-02 | Booking created | Confirmation to customer |
| E-03 | Booking created | Notification to owner |
| E-04 | Booking confirmed | Confirmation to customer |
| E-05 | Job completed | Notification to customer |
| E-06 | Invoice sent | Invoice email with PDF |
| E-07 | Invoice reminder | Overdue invoice reminder |
| E-08 | Invoice paid | Payment confirmation |
| E-09 | Maintenance due | Contract maintenance reminder |
| E-10 | Trial expiring | Trial expiration warning |
| E-11 | First paid sub | Welcome + affiliate referral link |
| E-12 | Invoice paid | Google review request (2h delay) |
| E-13 | Quote sent | Estimate email with PDF |

### `packages/config/` — Shared Configuration

```
packages/config/
├── package.json              # name: @hvac-saas/config
├── eslint.config.js          # Shared ESLint config
└── tsconfig.json             # Base TypeScript config
```

---

## Database — Supabase (PostgreSQL 15 + RLS)

All tables use `tenant_id` FK with Row Level Security. Admin tables have no RLS (service role only).

### Core Business Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `tenants` | Business accounts | business_name, slug, owner_email, is_active, trial_ends_at, google_review_url, review_request_enabled, referred_by_affiliate_id, referral_source |
| `tenant_subscriptions` | Billing state | lemon_squeezy_subscription_id, status, plan_name, affiliate_commission_rate |
| `users` | Tenant team members | tenant_id, email, full_name, role, last_login_at |
| `customers` | Tenant's customers | first_name, last_name, email, phone, address, lat/lng |
| `jobs` | Service jobs | customer_id, job_number, status, service_type, priority, scheduled_date, scheduled_start, total_amount |
| `job_line_items` | Job charges | job_id, catalog_item_id, item_type, description, qty, unit_price, total, sort_order |
| `job_photos` | Job site photos | job_id, storage_path, caption |
| `invoices` | Billing documents | customer_id, job_id, invoice_number, status, subtotal, tax, total, balance_due, pdf_storage_path, review_requested_at |
| `invoice_line_items` | Invoice charges | invoice_id, item_type, description, qty, unit_price, total |
| `invoice_payments` | Payment records | invoice_id, amount, payment_method, payment_date |
| `quotes` | Estimates | customer_id, quote_number (QT-YYYY-XXXX), status (draft→sent→accepted→declined→expired), expiry_date, total, converted_to_job_id |
| `quote_line_items` | Quote charges | quote_id, catalog_item_id, item_type, description, qty, unit_price, total, sort_order |
| `bookings` | Online bookings | customer_id, status, booking_date, booking_time, service_type, notes |
| `catalog_items` | Price book | name, item_type (labor/part/material/service_call/other), unit_price, unit, category, is_active |
| `equipment` | Customer equipment | customer_id, equipment_type, brand, model, serial_number, install_date |
| `refrigerant_logs` | EPA tracking | equipment_id, job_id, refrigerant_type, amount_lbs, action_type |
| `maintenance_contracts` | Service contracts | customer_id, status, start_date, end_date, frequency, price |
| `availability_schedules` | Weekly availability | day_of_week, start_time, end_time, is_active |
| `schedule_overrides` | Day-off / special hours | override_date, is_available, start_time, end_time, reason |

### Checklist Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `checklist_templates` | Per-service-type templates | service_type, name, is_active |
| `checklist_items` | Template items | template_id, label, is_required, catalog_item_id (auto line item), sort_order |
| `job_checklist_completions` | Per-job tracking | job_id, checklist_item_id, is_completed, completed_by, completed_at |

### Super Admin Tables (No RLS — service role only)

| Table | Purpose | Key Fields |
|---|---|---|
| `admin_users` | Admin accounts | email, password_hash (bcrypt), role (super_admin/support/billing_admin), is_active |
| `admin_audit_log` | Append-only action log | admin_user_id, action, target_tenant_id, metadata, ip_address |
| `admin_impersonation_sessions` | Impersonation tracking | admin_user_id, tenant_id, reason, started_at, ended_at, actions_taken |
| `platform_events` | Activity tracking (DAT/WAT/MAT) | tenant_id, event_type, user_id, metadata |

### Migrations

```
supabase/
└── migrations/               # Supabase SQL migrations (idempotent)
```

---

## Authentication Architecture

### Dual Auth System

```
/login (single page)
    │
    ├─ Try Fastify POST /admin/auth/login (bcrypt check admin_users)
    │   ├─ Match → Admin JWT in httpOnly "admin_token" cookie → /superadmin/dashboard
    │   └─ 401 → Fall through ↓
    │
    └─ Try Supabase signInWithPassword()
        ├─ Match → Supabase session cookies → /dashboard
        └─ Fail → "Invalid credentials" error
```

### Route Protection (middleware.ts)

| Path | Required Auth | Cookie |
|---|---|---|
| `/superadmin/*` | Admin JWT | `admin_token` (httpOnly, 4h TTL) |
| `/dashboard/*` | Supabase session | `sb-access-token` |
| `/book/*` | None | — |
| `/ref/*` | None | Sets `aff_code` (30-day) |

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

| Service | Purpose | Integration Point |
|---|---|---|
| **Supabase** | Database, Auth, Storage, Realtime | `packages/database/`, JWT auth, file uploads, Kanban live updates |
| **Mapbox GL JS** | Address autocomplete, GPS maps | Booking portal geocoding, customer address lookup |
| **Resend** | Transactional email | 13 email templates (E-01 → E-13) via `packages/email/` |
| **Lemon Squeezy** | Subscription billing + affiliates | Webhook handler, checkout redirect, affiliate tracking |
| **react-big-calendar** | Calendar view | `/dashboard/schedule` — drag-to-reschedule jobs |
| **pdfkit** | PDF generation | Invoice PDFs, Quote/Estimate PDFs |

---

## Deployment

| Component | Host | Tier |
|---|---|---|
| `apps/web` (Next.js) | Vercel | Hobby (free) |
| `apps/api` (Fastify) | Render | Free tier |
| Database | Supabase | Free tier |
| Email | Resend | Free (3K/mo) |
| Maps | Mapbox | Free (50K loads/mo) |
| Billing | Lemon Squeezy | Per-transaction (5% + $0.50) |

---

## Package Dependency Graph

```
apps/web ──→ @hvac-saas/types
         ──→ @hvac-saas/ui
         ──→ @hvac-saas/config

apps/api ──→ @hvac-saas/database
         ──→ @hvac-saas/types
         ──→ @hvac-saas/email
         ──→ @hvac-saas/config
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
pnpm --filter api seed:admin  # Seed first super admin
```
