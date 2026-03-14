# HVAC Field Service Management SaaS Platform
## Phase 1 — Product Requirements Document

| Field | Details |
|---|---|
| Document Type | Phase 1 Product Requirements Document (PRD) |
| Version | 3.0 |
| Date | March 2026 |
| Monorepo | Turborepo (pnpm workspaces) |
| Apps | `apps/web` (Next.js 14) · `apps/api` (Fastify) |
| Tech Stack | Next.js 14 · Fastify · Supabase · Mapbox · Resend · Lemon Squeezy |
| Target Market | Solo HVAC contractors — Texas & Florida (1–3 person teams) |
| Subscription | $49 / month per tenant (via Lemon Squeezy) |
| Build Timeline | 4 weeks to beta-ready MVP |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Design & ERD](#3-database-design--erd)
4. [User Flows](#4-user-flows)
5. [Feature Specifications](#5-feature-specifications)
6. [API Specification](#6-api-specification-fastify)
7. [Email Specifications](#7-email-specifications)
8. [Frontend Pages & Routes](#8-frontend-pages--routes)
9. [Shared Packages](#9-shared-packages-specification)
10. [Environment Variables](#10-environment-variables)
11. [Build Timeline](#11-phase-1-build-timeline-4-weeks)
12. [Deployment Configuration](#12-deployment-configuration)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Out of Scope](#14-phase-1---out-of-scope)
15. [Acceptance Criteria](#15-phase-1-acceptance-criteria)
16. [Getting Started](#16-getting-started---developer-setup)

---

## 1. Executive Summary

This PRD defines all requirements, architecture decisions, database schemas, user flows, and feature specifications needed to build and ship Phase 1 of an HVAC Field Service Management SaaS platform. The platform targets solo and micro-team HVAC contractors (1–3 people) in Texas and Florida who currently manage bookings by personal phone, invoicing by hand, and customer records in notebooks or memory.

**Phase 1 delivers six validated modules:**

- **Customer Self-Scheduling Portal** — replace personal-phone booking
- **Job Management Dashboard (Kanban)** — full job visibility across the day
- **Invoicing & Payment Tracking** — replace handwritten invoices, save 15–30 min/job
- **Customer Database & Equipment Records** — central service history
- **KPI Dashboard Homepage** — single-glance business health: jobs today, revenue, open invoices, bookings
- **Service Catalog & Price Book** — reusable items with prices for instant line item autocomplete
- **Customer Review Request** — auto post-job email requesting Google Review after payment
- **Job Checklists & Service Templates** — per-service-type checklists with auto line item generation
- **Quick Estimate & Quote Builder** — professional PDF quotes that convert to jobs in one click
- **Calendar View** — date-based job schedule with drag-to-reschedule alongside Kanban
- **Super Admin Dashboard** — tenant management, impersonation, platform analytics, support tools
- **Affiliate Program (end of Phase 1)** — referral tracking via Lemon Squeezy Affiliates, shareable links, commission tracking

> **PHASE 1 GOAL:** Ship a working, multi-tenant MVP in 4 weeks that a real HVAC owner can use to replace their phone + paper workflow. Success metric: 3–5 beta customers actively using the platform by end of Month 2.

---

## 2. System Architecture

### 2.1 Turborepo Monorepo Structure

```
hvac-saas/                          # Turborepo root
├── apps/
│   ├── web/                        # Next.js 14 (App Router) — ALL UI (tenant + superadmin)
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, signup, forgot-password (unified login)
│   │   │   ├── (dashboard)/        # Owner dashboard (RLS-protected)
│   │   │   │   ├── jobs/
│   │   │   │   ├── customers/
│   │   │   │   ├── invoices/
│   │   │   │   ├── bookings/
│   │   │   │   ├── quotes/
│   │   │   │   ├── schedule/
│   │   │   │   └── settings/
│   │   │   ├── (superadmin)/       # Super Admin pages (admin JWT required)
│   │   │   │   ├── layout.tsx      # Admin layout: red sidebar + "ADMIN" badge
│   │   │   │   ├── dashboard/      # MRR, signups, active users overview
│   │   │   │   ├── tenants/        # Tenant list, detail, impersonation
│   │   │   │   ├── analytics/      # MRR, signups, churn, active users
│   │   │   │   ├── support/        # Global search, audit log, email log
│   │   │   │   ├── affiliates/     # Affiliate performance overview
│   │   │   │   └── system/         # Webhook log, cron history, health
│   │   │   ├── book/[slug]/        # Public booking portal (no auth)
│   │   │   ├── ref/[code]/         # Affiliate redirect
│   │   │   └── api/                # Next.js API routes (thin — proxy to Fastify)
│   │   ├── components/
│   │   ├── middleware.ts           # Route protection (tenant vs admin)
│   │   └── package.json
│   └── api/                        # Fastify server
│       ├── src/
│       │   ├── plugins/
│       │   ├── routes/
│       │   │   ├── jobs/
│       │   │   ├── invoices/
│       │   │   ├── bookings/
│       │   │   ├── customers/
│       │   │   ├── quotes/
│       │   │   ├── admin/          # Super admin API routes
│       │   │   └── webhooks/
│       │   ├── jobs/               # Background cron runners
│       │   └── server.ts
│       └── package.json
├── packages/
│   ├── database/
│   ├── types/
│   ├── ui/
│   ├── email/
│   └── config/
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Application Layer Overview

| Layer | Technology | Responsibility | Hosting |
|---|---|---|---|
| Frontend (Unified) | Next.js 14 (App Router) | Dashboard UI, booking portal, invoice view, auth pages, realtime Kanban, **Super Admin panel** (`/superadmin/*`) | Vercel Hobby (free) |
| Backend API | Fastify (Node.js) | Multi-tenant middleware, admin routes, webhooks, background cron jobs, PDF generation | Render free tier |
| Database | Supabase (PostgreSQL 15) | All data, Row Level Security, realtime pub/sub | Supabase free tier |
| Auth (Tenant) | Supabase Auth | Owner signup/login, JWT, magic link | Supabase (bundled) |
| Auth (Admin) | Fastify admin_users + bcrypt | Super admin login via same `/login` page; separate JWT; role-based access | Fastify (bundled) |
| File Storage | Supabase Storage | Job photos, invoice PDFs, tenant logos | Supabase (bundled) |
| Email | Resend + React Email | All transactional emails | Resend free (3K/mo) |
| Maps | Mapbox GL JS | GPS map, address autocomplete | Mapbox free (50K loads/mo) |
| Billing | Lemon Squeezy | Subscription billing + Affiliate program (built-in) | Per-transaction: 5% + $0.50 |
| Realtime | Supabase Realtime | Live Kanban board updates | Supabase (bundled) |

### 2.3 Multi-Tenancy Model

Shared-database, shared-schema multi-tenancy. Tenant isolation enforced via Supabase Row Level Security on every table. Super admin uses a **service role key** (bypasses RLS) with its own `admin_users` table — completely separate from tenant auth.

### 2.4 Unified Login Architecture

Super admin is deployed in the **same Next.js app** — no separate `apps/admin`. Superadmin pages live under the `(superadmin)` route group at `/superadmin/*`.

**Unified login flow** — the single `/login` page handles both tenant and admin users:

1. User enters email + password on `/login`
2. Client calls Next.js API route → which first tries `POST /admin/auth/login` on Fastify
3. If admin credentials match → Fastify returns admin JWT → stored in `admin_token` httpOnly cookie → redirect to `/superadmin/dashboard`
4. If not an admin (401) → fall through to Supabase `signInWithPassword()` for normal tenant login → redirect to `/dashboard`
5. If both fail → show "Invalid credentials" error

**Route protection** is enforced in `middleware.ts`:
- `/superadmin/*` → requires valid `admin_token` cookie (admin JWT)
- `/dashboard/*` → requires valid Supabase session cookie
- Both tokens use different cookie names and different JWT secrets

---

## 3. Database Design & ERD

### 3.1 Core Tables (existing — unchanged)

All existing tables from v1.0 remain: `tenants`, `tenant_subscriptions`, `users`, `customers`, `equipment`, `maintenance_contracts`, `jobs`, `job_line_items`, `job_photos`, `refrigerant_logs`, `invoices`, `invoice_line_items`, `invoice_payments`, `bookings`, `availability_schedules`, `schedule_overrides`.

### 3.2 New Tables — Super Admin

#### `admin_users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK, default gen_random_uuid() | |
| email | text | NOT NULL UNIQUE | Admin login email |
| password_hash | text | NOT NULL | bcrypt hash |
| role | text | NOT NULL | `super_admin \| support \| billing_admin` |
| full_name | text | NOT NULL | Display name |
| is_active | boolean | default true | Account enabled |
| last_login_at | timestamptz | | Last successful login |
| created_at | timestamptz | default now() | |

#### `admin_audit_log`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| admin_user_id | uuid | FK → admin_users(id) NOT NULL | Who performed the action |
| action | text | NOT NULL | `impersonate_start \| impersonate_end \| tenant_deactivate \| tenant_activate \| trial_extend \| subscription_override \| tenant_delete \| feature_flag_change` |
| target_tenant_id | uuid | FK → tenants(id) nullable | Affected tenant |
| target_user_id | uuid | nullable | Affected user if applicable |
| metadata | jsonb | | Additional context (reason, old value, new value) |
| ip_address | text | | Admin's IP address |
| created_at | timestamptz | default now() | Immutable timestamp |

> **RULE:** `admin_audit_log` is append-only. No UPDATE or DELETE policies. Every super admin action writes here first.

#### `admin_impersonation_sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| admin_user_id | uuid | FK → admin_users(id) | Admin performing impersonation |
| tenant_id | uuid | FK → tenants(id) | Tenant being accessed |
| tenant_user_id | uuid | FK → users(id) | Specific user being impersonated |
| reason | text | NOT NULL | Required reason for impersonation |
| started_at | timestamptz | default now() | Session start |
| ended_at | timestamptz | nullable | Session end (null = active) |
| actions_taken | jsonb | default [] | Array of actions performed during session |

#### `platform_events` (activity tracking)

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) | |
| event_type | text | NOT NULL | `login \| job_created \| invoice_sent \| booking_received \| customer_created` |
| user_id | uuid | nullable | Which user triggered it |
| metadata | jsonb | | Event-specific data |
| created_at | timestamptz | default now() | |

> Used to power active user tracking (DAT/WAT/MAT), last-active timestamps, and feature adoption metrics. Inserted by Fastify on key actions. Indexed on `(tenant_id, event_type, created_at)`.

### 3.3 New Columns — Affiliate Tracking

```sql
-- Add to tenants table (migration at end of Week 4)
ALTER TABLE tenants ADD COLUMN referred_by_affiliate_id text;   -- LS affiliate ID from webhook
ALTER TABLE tenants ADD COLUMN referral_source text default 'organic';
-- referral_source values: 'affiliate' | 'organic' | 'direct' | 'referral'

-- Add to tenant_subscriptions table
ALTER TABLE tenant_subscriptions ADD COLUMN affiliate_commission_rate numeric(5,4);
-- Stores commission % at time of signup for historical accuracy
```

### 3.4 Row Level Security — Admin Routes

```sql
-- admin_users: no RLS — accessed only via service role key (Fastify admin routes)
-- admin_audit_log: append-only via service role; no tenant can read this table
-- platform_events: tenant can INSERT own events; cannot read other tenants' events
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_insert_own_events" ON platform_events
  FOR INSERT WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
-- SELECT on platform_events is admin-only (service role)
```

---

## 4. User Flows

### 4.1 – 4.6 (unchanged from v1.0)

All existing flows remain: Owner Onboarding, Customer Booking, Job Lifecycle, Invoice Management, Customer & Equipment Management, Schedule Management.

### 4.7 Super Admin Impersonation Flow

1. Admin logs into `/login` — same login page, admin credentials detected automatically
2. Admin navigates to `/superadmin/tenants` → searches for tenant
3. Admin opens tenant detail → clicks **"Impersonate"**
4. Modal requires: mandatory **Reason** field (e.g. "Customer support ticket #123")
5. On confirm: Fastify generates a short-lived impersonation JWT (15 min TTL) scoped to that tenant
6. Admin browser opens tenant dashboard (`/dashboard`) with a **red banner**: "⚠️ You are viewing as [Business Name] — [Admin Name]"
7. All actions taken during session are logged to `admin_impersonation_sessions.actions_taken`
8. Admin clicks **"Exit Impersonation"** in banner → returns to admin dashboard
9. Full session logged in `admin_audit_log` with start time, end time, reason, actions taken

### 4.8 Affiliate Signup Flow

1. Affiliate visits Lemon Squeezy affiliate portal (managed by LS — no custom build needed)
2. LS generates unique referral link: `yourapp.com/?aff=ABC123`
3. Visitor lands on `/ref/[code]` → cookie `aff_code=ABC123` set (30-day expiry) → redirect to `/`
4. Visitor signs up → goes through onboarding → hits Lemon Squeezy checkout
5. LS detects affiliate cookie → tracks conversion automatically
6. On `subscription_created` webhook: `affiliate_id` in payload → saved to `tenants.referred_by_affiliate_id`
7. LS handles commission payout to affiliate automatically
8. New subscriber receives welcome email (E-11) with their own referral link to share

---

## 5. Feature Specifications

### 5.1 – 5.7 (unchanged from v1.0)

All existing feature specs remain: Booking Portal, Job Management, Invoicing, Customer Database, Refrigerant Tracking, Maintenance Contracts, Tenant Settings.

### 5.8 KPI Dashboard Homepage

| ID | Feature | Specification | Priority |
|---|---|---|---|
| KPI-01 | Dashboard home page | `/dashboard` — landing page with 6 KPI cards. Replaces Kanban as default landing route. | P0 |
| KPI-02 | Jobs Today card | Count of `jobs` where `scheduled_date = today` per tenant. Emergency badge if any are `priority = emergency`. | P0 |
| KPI-03 | Open Invoices card | Count of invoices where `status NOT IN (paid, void)` | P0 |
| KPI-04 | Outstanding Balance card | `SUM(balance_due)` on all open invoices per tenant | P0 |
| KPI-05 | This Month Revenue card | `SUM(invoice_payments.amount)` where `payment_date` in current calendar month | P0 |
| KPI-06 | Active Customers card | Count of customers with at least one job in last 90 days | P0 |
| KPI-07 | Upcoming Bookings card | Count of `bookings` where `status = pending` — links to `/dashboard/bookings` | P0 |
| KPI-08 | Quick action buttons | Shortcut buttons: New Job, New Customer, View Invoices, View Bookings | P1 |

> **No new tables or API endpoints.** All data already exists. Pure frontend aggregate queries via Supabase client. Estimated: 4–6 hours.

---

### 5.9 Service Catalog & Price Book

| ID | Feature | Specification | Priority |
|---|---|---|---|
| CAT-01 | Catalog management page | `/settings/catalog` — list, create, edit, archive catalog items | P0 |
| CAT-02 | Catalog item fields | `name`, `item_type` (labor/part/material/service_call/other), `unit_price`, `unit`, `category`, `description`, `is_active` | P0 |
| CAT-03 | Line item autocomplete | On job/invoice line item add: typing triggers catalog search. Select item → auto-fills description, unit_price, item_type. | P0 |
| CAT-04 | Catalog item FK | `job_line_items.catalog_item_id` (nullable FK → `catalog_items.id`) — tracks which catalog item was used | P1 |
| CAT-05 | Bulk CSV import | Upload CSV with columns: name, item_type, unit_price, unit, category. Validates and inserts. | P1 |
| CAT-06 | Item categories | Filter autocomplete dropdown by category — shows relevant items faster | P1 |

**New DB table: `catalog_items`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | RLS key |
| name | text | NOT NULL | e.g. "AC Service Call" |
| item_type | text | NOT NULL | `labor \| part \| material \| service_call \| other` |
| unit_price | numeric(10,2) | NOT NULL | Default price |
| unit | text | default `each` | e.g. each, hour, lb, ft |
| category | text | | Grouping label |
| description | text | | Optional long description |
| is_active | boolean | default true | Soft delete |
| created_at | timestamptz | default now() | |

---

### 5.10 Customer Review Request

| ID | Feature | Specification | Priority |
|---|---|---|---|
| RR-01 | Auto trigger | Fastify hook on `invoice.status` → `paid`: if `review_requested_at IS NULL` and `google_review_url` is set, queue E-12 email with 2h delay | P0 |
| RR-02 | Google Review URL setting | New field `tenants.google_review_url` — editable in `/settings/business` | P0 |
| RR-03 | Review request email (E-12) | Resend email: friendly tone, owner name, "How was your service?" CTA button → google_review_url | P0 |
| RR-04 | Sent tracking | `invoices.review_requested_at` timestamptz — set when email queued. Prevents duplicate sends. | P0 |
| RR-05 | Feature toggle | `tenants.review_request_enabled` boolean — owner can disable in settings | P0 |
| RR-06 | Manual trigger | "Request Review" button on any paid invoice detail — sets `review_requested_at`, sends immediately | P1 |

**DB changes:**
```sql
ALTER TABLE tenants ADD COLUMN google_review_url text;
ALTER TABLE tenants ADD COLUMN review_request_enabled boolean default true;
ALTER TABLE invoices ADD COLUMN review_requested_at timestamptz;
```

---

### 5.11 Job Checklists & Service Templates

| ID | Feature | Specification | Priority |
|---|---|---|---|
| CL-01 | Checklist template builder | `/settings/checklists` — CRUD for templates. Each template: `service_type`, `name`, ordered list of items | P0 |
| CL-02 | Checklist item fields | `label`, `is_required` (boolean), `catalog_item_id` (nullable FK — links to price book item), `sort_order` | P0 |
| CL-03 | Auto-attach on job creation | On `POST /jobs`: if a template exists for the job's `service_type`, create `job_checklist_completions` rows (all unchecked) | P0 |
| CL-04 | Checklist UI on job detail | Collapsible checklist section. Tap/click to check. Required items show lock icon. Shows completion progress: "8/12 complete" | P0 |
| CL-05 | Complete Job gate | "Complete Job" button disabled until all `is_required = true` items are checked | P0 |
| CL-06 | Auto line item generation | On checklist item checked: if `catalog_item_id` is set, auto-add to `job_line_items` (if not already present) | P0 |
| CL-07 | Completion timestamp log | Each `job_checklist_completions` row stores `completed_by` (user_id) and `completed_at` | P0 |

**New DB tables:**

```sql
CREATE TABLE checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  service_type text NOT NULL,  -- matches jobs.service_type enum
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id uuid NOT NULL REFERENCES checklist_templates(id),
  label text NOT NULL,
  is_required boolean DEFAULT true,
  catalog_item_id uuid REFERENCES catalog_items(id),  -- optional auto line item
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE job_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_id uuid NOT NULL REFERENCES jobs(id),
  checklist_item_id uuid NOT NULL REFERENCES checklist_items(id),
  is_completed boolean DEFAULT false,
  completed_by uuid REFERENCES users(id),
  completed_at timestamptz,
  UNIQUE(job_id, checklist_item_id)
);
```

---

### 5.12 Quick Estimate & Quote Builder

| ID | Feature | Specification | Priority |
|---|---|---|---|
| QT-01 | Quote creation | `/quotes/new` — same line item editor as invoices. Assign to customer. Set expiry date (default: 30 days). | P0 |
| QT-02 | Quote number | Auto-assigned: `QT-YYYY-XXXX` (sequential per tenant, same trigger pattern as invoices) | P0 |
| QT-03 | Quote status flow | `draft → sent → accepted → declined → expired` | P0 |
| QT-04 | Quote PDF generation | pdfkit — same engine as invoices. "ESTIMATE" header. Expiry date. Tenant branding. | P0 |
| QT-05 | Email quote (E-13) | Resend with PDF attached. Subject: "Estimate #QT-XXXX from [Business Name]" | P0 |
| QT-06 | Convert to job | "Accept & Create Job" button on sent quote. Copies: customer_id, service_type, line_items. Creates job `status = scheduled`. Sets `quotes.converted_to_job_id`. | P0 |
| QT-07 | Quote list view | `/quotes` — table with status badges, totals, customer, expiry. Filter by status. | P0 |
| QT-08 | Expiry auto-decline | Fastify cron (daily): quotes where `expiry_date < today AND status = sent` → set `status = expired`. Owner notified. | P1 |
| QT-09 | Quote line items | Separate `quote_line_items` table. Same structure as `job_line_items`. Catalog autocomplete supported. | P0 |

**New DB tables:**

```sql
CREATE TABLE quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_number text NOT NULL,  -- QT-YYYY-XXXX
  status text NOT NULL DEFAULT 'draft',
  issued_date date NOT NULL DEFAULT CURRENT_DATE,
  expiry_date date,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,4) DEFAULT 0,
  tax_amount numeric(10,2) DEFAULT 0,
  discount_amount numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  notes text,
  pdf_storage_path text,
  converted_to_job_id uuid REFERENCES jobs(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE quote_line_items (
  -- Same structure as job_line_items but quote_id FK
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  quote_id uuid NOT NULL REFERENCES quotes(id),
  catalog_item_id uuid REFERENCES catalog_items(id),
  item_type text NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total numeric(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_quote_number ON quotes(tenant_id, quote_number);
```

**New API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/quotes` | List quotes. Query: `?status=&customer_id=` |
| POST | `/quotes` | Create quote |
| GET | `/quotes/:id` | Quote with line items |
| PATCH | `/quotes/:id` | Update quote |
| POST | `/quotes/:id/send` | Generate PDF + send via Resend |
| GET | `/quotes/:id/pdf` | Download PDF |
| POST | `/quotes/:id/convert` | Convert accepted quote to job |
| POST | `/quotes/:id/decline` | Mark as declined |

---

### 5.13 Calendar View

| ID | Feature | Specification | Priority |
|---|---|---|---|
| CAL-01 | Calendar page | `/dashboard/calendar` — toggleable from `/dashboard/jobs` via header switch | P0 |
| CAL-02 | Month / Week / Day views | react-big-calendar with view switcher. Default: Week view. | P0 |
| CAL-03 | Job events | Each scheduled job renders as event: customer name, time slot, service type. Colour by priority: emergency=red, urgent=orange, standard=blue. | P0 |
| CAL-04 | Click to open | Clicking an event opens the job detail side panel (same component as Kanban) | P0 |
| CAL-05 | Drag to reschedule | react-big-calendar drag-and-drop: updates `jobs.scheduled_date` + `jobs.scheduled_start` via `PATCH /jobs/:id`. Supabase Realtime broadcasts change to Kanban. | P0 |
| CAL-06 | View toggle persistence | User's preferred view (Kanban vs Calendar) stored in `localStorage`. Default: Kanban. | P0 |
| CAL-07 | Booking portal slots overlay | Show availability slots as background on calendar — helps owner see booking capacity | P1 |

> **No new DB tables.** Uses existing `jobs` data. Library: `react-big-calendar` (MIT license). Drag calls existing `PATCH /jobs/:id` endpoint. Realtime update propagates to Kanban automatically.

---

### 5.14 Super Admin Dashboard — Phase 1 Scope

**Phase 1 builds the support essentials. Analytics and system health build out in Phase 2.**

#### 5.14.1 Access & Authentication

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-01 | Unified admin routes | `/superadmin/*` — same Next.js app, same deployment, route-group isolation via middleware | P0 |
| SA-02 | Admin login (unified) | Same `/login` page; email + password; bcrypt; admin credentials auto-detected; no self-signup — seed first admin via migration | P0 |
| SA-03 | Role-based access | `super_admin`: full access. `support`: can impersonate, cannot delete/override billing. `billing_admin`: billing only, cannot impersonate | P0 |
| SA-04 | Session security | JWT with 4h expiry; re-auth required for destructive actions | P0 |

#### 5.14.2 Tenant Management

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-05 | Tenant list | Table: business name, owner email, plan, status, signup date, last active, MRR. Searchable, sortable, filterable by status | P0 |
| SA-06 | Tenant detail view | Full profile: business info, subscription status, usage stats (jobs/invoices/customers count), impersonation button | P0 |
| SA-07 | Impersonation | Generate short-lived JWT for tenant; requires reason field; red banner in tenant app; full audit log | P0 |
| SA-08 | Activate / Deactivate | Toggle `tenants.is_active`; deactivated tenants see subscription gate on next load | P0 |
| SA-09 | Extend trial | Bump `trial_ends_at` without Lemon Squeezy interaction; logged to audit | P0 |
| SA-10 | Subscription override | Manually set `tenant_subscriptions.status`; used for support edge cases | P0 |
| SA-11 | Edit tenant details | Fix business name, email, slug typos; all edits logged | P1 |
| SA-12 | Delete tenant | Hard delete with 2-step confirmation; cascades all data; logged; irreversible | P1 |

#### 5.14.3 Platform Analytics (Phase 1 — core metrics only)

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-13 | MRR dashboard | Current MRR, MRR 30d ago, MRR delta. Calculated from active `tenant_subscriptions` | P0 |
| SA-14 | Signup chart | New tenants per day/week/month. Bar chart (recharts). Last 90 days | P0 |
| SA-15 | Trial conversion | Trial starts vs trial-to-paid conversions. Funnel view | P0 |
| SA-16 | Churn list | Tenants who cancelled in last 30/60/90 days. Status, days active, MRR lost | P0 |
| SA-17 | Active tenant tracking | Daily/Weekly/Monthly active tenants based on `platform_events`. Last login per tenant | P0 |
| SA-18 | Inactive alert list | Tenants with no `platform_events` in last 14 days — churn risk | P1 |
| SA-19 | Feature adoption | % of tenants who have used: booking portal, invoice send, refrigerant log. Simple table | P1 |

#### 5.14.4 Support Tools

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-20 | Global search | Search by tenant name, email, job number, invoice number across all data (service role query) | P0 |
| SA-21 | Tenant activity log | All `platform_events` for a specific tenant — for debugging customer issues | P0 |
| SA-22 | Impersonation audit log | All past impersonation sessions: admin, tenant, reason, duration, actions | P0 |
| SA-23 | Email delivery log | Resend webhook events stored — delivered/bounced/failed per tenant | P1 |
| SA-24 | Manual email trigger | Resend any system email (booking confirmation, invoice reminder) to a specific address | P1 |

#### 5.14.5 System Health (Phase 1 — basic)

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-25 | Webhook log | Last 100 Lemon Squeezy webhooks: event type, status (processed/failed), timestamp | P0 |
| SA-26 | Cron job history | Last run time and result (records processed, errors) for each Fastify cron | P0 |

### 5.15 Affiliate Program — End of Phase 1

**Implementation approach: leverage Lemon Squeezy's built-in affiliate system. Zero custom payout infrastructure.**

| ID | Feature | Specification | Priority |
|---|---|---|---|
| AF-01 | LS affiliate program setup | Enable affiliate dashboard in Lemon Squeezy admin. Set commission to 25% recurring. No code required | P0 |
| AF-02 | Referral landing route | `/ref/[code]` Next.js page: sets `aff_code` cookie (30-day), redirects to `/`. 10 lines of code | P0 |
| AF-03 | Affiliate webhook capture | Extend `subscription_created` webhook handler: extract `affiliate_id` from LS payload, save to `tenants.referred_by_affiliate_id` | P0 |
| AF-04 | Refer & Earn widget | Card in `/settings/billing`: "Refer a contractor, earn 25% recurring". Shows affiliate link. Deep-links into LS affiliate portal for stats | P0 |
| AF-05 | Welcome email with referral link | E-11: sent on first paid subscription. Includes affiliate signup link. Converts happy customers into referrers | P0 |
| AF-06 | Admin affiliate overview | In super admin `/admin/affiliates`: table of referred tenants by affiliate_id, MRR attributed, conversion rate | P1 |

---

## 6. API Specification (Fastify)

### 6.1 – 6.6 (unchanged from v1.0)

All existing API endpoints remain for jobs, invoices, customers, bookings, and webhooks.

### 6.7 Admin API Routes

All admin routes require `Authorization: Bearer <admin_jwt>`. Admin JWT is issued by Fastify's own auth (not Supabase). Uses `supabaseAdmin` (service role) for all DB queries — bypasses RLS.

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| POST | `/admin/auth/login` | — | Admin login: email + password → admin JWT |
| GET | `/admin/tenants` | support+ | List tenants with filters + search |
| GET | `/admin/tenants/:id` | support+ | Tenant detail: profile, stats, subscription |
| PATCH | `/admin/tenants/:id` | super_admin | Edit tenant fields |
| POST | `/admin/tenants/:id/impersonate` | support+ | Generate impersonation JWT. Body: `{ reason }` |
| POST | `/admin/tenants/:id/deactivate` | super_admin | Set `is_active = false` |
| POST | `/admin/tenants/:id/activate` | super_admin | Set `is_active = true` |
| POST | `/admin/tenants/:id/extend-trial` | support+ | Bump `trial_ends_at`. Body: `{ days }` |
| POST | `/admin/tenants/:id/override-subscription` | billing_admin+ | Set subscription status manually |
| DELETE | `/admin/tenants/:id` | super_admin | Hard delete. Requires `{ confirm: "DELETE" }` in body |
| GET | `/admin/analytics/mrr` | billing_admin+ | MRR, delta, trend |
| GET | `/admin/analytics/signups` | support+ | Signups over time |
| GET | `/admin/analytics/active-users` | support+ | DAT/WAT/MAT counts |
| GET | `/admin/analytics/churn` | billing_admin+ | Churned tenants list |
| GET | `/admin/analytics/feature-adoption` | support+ | Feature usage rates |
| GET | `/admin/search` | support+ | Global search across all tables |
| GET | `/admin/audit-log` | super_admin | All admin actions log |
| GET | `/admin/system/webhooks` | super_admin | LS webhook history |
| GET | `/admin/system/crons` | super_admin | Cron run history |
| GET | `/admin/affiliates` | billing_admin+ | Affiliate attribution overview |

### 6.8 Lemon Squeezy Webhook — Updated Handler

```typescript
// Extended to capture affiliate_id on subscription_created
case 'subscription_created': {
  const affiliateId = payload.meta?.affiliate_id ?? null;
  const referralSource = affiliateId ? 'affiliate' : 'organic';
  
  await supabaseAdmin
    .from('tenants')
    .update({
      referred_by_affiliate_id: affiliateId,
      referral_source: referralSource
    })
    .eq('id', tenantId);

  await supabaseAdmin.from('tenant_subscriptions').upsert({
    tenant_id: tenantId,
    lemon_squeezy_subscription_id: payload.data.id,
    status: payload.data.attributes.status,
    // ... other fields
    affiliate_commission_rate: affiliateId ? 0.25 : null
  });
  break;
}
```

---

## 7. Email Specifications

All emails from v1.0 remain (E-01 through E-10). One new email added:

| ID | Trigger | Recipient | Subject | Key Content |
|---|---|---|---|---|
| E-11 | First paid subscription activated | Tenant owner | Welcome to [App Name] — Here's how to earn with us | Welcome message, quick-start checklist, affiliate referral link with commission details |

---

## 8. Frontend Pages & Routes

All routes from v1.0 remain. New routes added:

**Tenant App (`apps/web`):**

| Route | Page | Description | Auth |
|---|---|---|---|
| `/ref/[code]` | Affiliate Redirect | Sets `aff_code` cookie, redirects to `/` | Public |

**Super Admin Routes (same app — `apps/web`, `(superadmin)` route group):**

| Route | Page | Description | Auth |
|---|---|---|---|
| `/login` | Unified Login | Same login page — admin credentials auto-detected, redirects to `/superadmin/dashboard` | Public |
| `/superadmin` | Admin Dashboard | MRR card, signups chart, active users, churn summary | Admin JWT |
| `/superadmin/tenants` | Tenant List | Searchable table with filters | Admin JWT |
| `/superadmin/tenants/[id]` | Tenant Detail | Profile, stats, impersonation, actions | Admin JWT |
| `/superadmin/analytics` | Analytics | Full MRR, signups, churn, conversion charts | Admin JWT |
| `/superadmin/analytics/active-users` | Active Users | DAT/WAT/MAT, last active per tenant, inactive list | Admin JWT |
| `/superadmin/support` | Support Tools | Global search, audit log, email log | Admin JWT |
| `/superadmin/affiliates` | Affiliate Overview | Attribution table, top affiliates, referred MRR | Admin JWT |
| `/superadmin/system` | System Health | Webhook log, cron history | Admin JWT |

---

## 9–12 (unchanged from v1.0)

Shared Packages, Environment Variables, Deployment Configuration remain the same.

### Environment Variables — additions

```bash
# apps/api — new admin variables
ADMIN_JWT_SECRET=[separate secret from tenant JWT]
ADMIN_SEED_EMAIL=admin@yourapp.com
ADMIN_SEED_PASSWORD=[strong password — change after first login]
```

---

## 11. Phase 1 Build Timeline — Updated (4 Weeks)

| Week | Focus | Deliverables | Done When |
|---|---|---|---|
| **Week 1** | Infrastructure + Auth + DB + KPI Dashboard + Admin Scaffold | Turborepo setup, multi-tenant auth, customer CRUD, `catalog_items` table, KPI dashboard homepage (6 cards), admin app + login + tenant list | Owner sees KPI dashboard on login; admin can log in at `/admin` |
| **Week 2** | Booking Portal + Kanban + Calendar View + Impersonation | Public booking portal, availability calendar, Kanban board with realtime, Calendar View (react-big-calendar) with drag-to-reschedule, admin tenant detail + impersonation | Customer can book; owner toggles Kanban/Calendar; admin can impersonate |
| **Week 3** | Invoicing + Quote Builder + Service Catalog + Review Request + Admin Analytics | Invoice generation + PDF + Resend, Quote builder (QT-YYYY) with convert-to-job + E-13, Service Catalog with line item autocomplete, Review request E-12, MRR dashboard + active user tracking | Owner sends invoices and quotes; price book live; review auto-sent after payment |
| **Week 4** | Equipment + Refrigerant + Checklists + Contracts + Affiliate + Polish | Equipment records, refrigerant logs, job checklists (templates + completions + auto line items), maintenance contracts, Lemon Squeezy + affiliate capture, `/ref/[code]`, Refer & Earn widget, E-11, admin affiliate view | Full end-to-end flow; checklists auto-populate invoices; affiliate tracked; LS subscription gates access |

---

## 13. Non-Functional Requirements (additions)

| Category | Requirement | Target |
|---|---|---|
| Security | Admin routes isolated via middleware | Same deployment, `/superadmin/*` protected by admin JWT in `admin_token` cookie; separate JWT secret from tenant; middleware blocks all access without valid admin token |
| Security | Impersonation sessions | Max 60-minute TTL on impersonation JWT; auto-expire |
| Security | Admin audit log | Append-only; no delete policy even for super_admin role |
| Performance | Admin dashboard load | < 3s — admin analytics queries use aggregated views, not real-time scans |
| Compliance | GDPR delete | Hard delete via admin removes all tenant + customer PII within 30 days of request |

---

## 14. Phase 1 — Out of Scope (unchanged + additions)

Previously out-of-scope items remain. Additionally:
- Affiliate self-signup portal UI (handled by Lemon Squeezy)
- Commission payout management (handled by Lemon Squeezy)
- Advanced admin analytics: cohort analysis, LTV curves, revenue forecasting (Phase 2)
- Broadcast email to all tenants from admin (Phase 2)
- Feature flags per tenant (Phase 2)

---

## 15. Phase 1 Acceptance Criteria (additions)

All v1.0 acceptance criteria remain (AC-01 through AC-10). New criteria:

| # | Scenario | Steps | Pass Condition |
|---|---|---|---|
| AC-11 | Admin impersonation | Admin logs in via `/login` (auto-redirected to `/superadmin`), opens Tenant A, clicks Impersonate, enters reason | Admin session opens tenant dashboard with red banner; session logged in audit log with reason |
| AC-12 | Impersonation isolation | Admin impersonates Tenant A; queries jobs | Zero rows from Tenant B visible — RLS still enforced on impersonation JWT |
| AC-13 | Audit log immutability | Admin performs 3 actions; attempt DELETE on audit_log | DELETE rejected by RLS policy; all 3 entries intact |
| AC-14 | MRR accuracy | Create 5 active subscriptions at $49; open admin analytics | MRR shows $245; delta correct vs prior period |
| AC-15 | Active user tracking | Tenant logs in and creates a job; check admin analytics | Tenant appears in DAT; `platform_events` has login + job_created entries |
| AC-16 | Affiliate referral capture | Sign up via `/?aff=TEST123`; complete checkout | `tenants.referred_by_affiliate_id = 'TEST123'`; `referral_source = 'affiliate'` |
| AC-17 | Affiliate cookie persistence | Visit `/?aff=TEST123`; navigate to `/pricing`; sign up | `aff_code` cookie preserved through navigation; captured on checkout |
| AC-18 | KPI dashboard accuracy | Create 3 jobs for today, 2 open invoices with $500 balance; open dashboard | KPI cards show: Jobs Today=3, Open Invoices=2, Outstanding Balance=$500 |
| AC-19 | Service catalog autocomplete | Create catalog item "AC Service Call $95"; open new job, add line item, type "AC" | Autocomplete shows catalog item; selecting it fills description + price |
| AC-20 | Review request auto-send | Mark invoice as paid with `google_review_url` set; wait 2h (or trigger manually) | E-12 email delivered to customer; `invoices.review_requested_at` set; no duplicate sent on second trigger |
| AC-21 | Checklist auto-attach | Create checklist template for `maintenance` service type (3 items, 2 required); create a maintenance job | Job opens with 3 checklist items; "Complete Job" disabled until 2 required items checked |
| AC-22 | Checklist auto line item | Checklist item has `catalog_item_id` linked; tech checks the item | Corresponding line item auto-added to job; total updates correctly |
| AC-23 | Quote to job conversion | Create quote with 3 line items, send to customer, click "Accept & Create Job" | Job created with same 3 line items; `quotes.converted_to_job_id` set; quote status = accepted |
| AC-24 | Calendar drag reschedule | Open calendar view; drag a job from Monday to Wednesday | `jobs.scheduled_date` updated in DB; Kanban card reflects new date without page refresh |

---

## 16. Getting Started — Developer Setup (additions)

```bash
# Seed first super admin (run once after initial migration)
pnpm --filter api seed:admin
# Creates admin user from ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars

# Start the app (includes both tenant dashboard + superadmin)
pnpm --filter web dev  # Starts on :3000

# Access superadmin dashboard
# Go to http://localhost:3000/login and enter admin credentials
# You'll be auto-redirected to /superadmin/dashboard
```

---

*HVAC SaaS — Phase 1 PRD · Version 3.0 · March 2026*
