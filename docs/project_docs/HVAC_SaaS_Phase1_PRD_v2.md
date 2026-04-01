# Multi-Industry Service Management SaaS Platform
## Phase 1 — Product Requirements Document

| Field | Details |
|---|---|
| Document Type | Phase 1 Product Requirements Document (PRD) |
| Version | 4.0 |
| Date | April 2026 |
| Monorepo | Turborepo (pnpm workspaces) |
| Apps | `apps/web` (Next.js 14) · `apps/api` (Fastify) |
| Tech Stack | Next.js 14 · Fastify · Supabase · Drizzle ORM · Better Auth · Mapbox · Resend · Lemon Squeezy |
| Target Market | Solo service contractors — initial focus: HVAC in Texas & Florida (1–3 person teams) |
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

This PRD defines all requirements, architecture decisions, database schemas, user flows, and feature specifications needed to build and ship Phase 1 of a multi-industry service management SaaS platform. While the platform is designed to serve any field service industry, the initial target market is solo and micro-team HVAC contractors (1–3 people) in Texas and Florida who currently manage bookings by personal phone, invoicing by hand, and customer records in notebooks or memory.

**Phase 1 delivers the following modules:**

**Core Modules (Original):**
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
- **Affiliate Program** — referral tracking via Lemon Squeezy Affiliates, shareable links, commission tracking (deferred — depends on Lemon Squeezy)

**Extended Modules (Delivered):**
- **Custom Pipeline Stages** — per-tenant customizable Kanban columns with colors, drag reorder, 8 color presets
- **Team Management & Roles** — multi-user organizations with owner/admin/member roles, invitation flow, role-based access
- **Multi-Channel Notifications** — real-time in-app (Supabase Realtime) + email, notification preferences, bell UI
- **AI Help Chatbot** — Groq + Vercel AI SDK v6 with 10 AI tools (greet, answer_help, create 8 entity types), knowledge base, floating chat panel
- **Customer Tags & Activity System** — reusable tenant-level tags, many-to-many, customer notes CRUD, automated activity timeline (also on jobs and quotes)
- **Invoice & Quote PDF Customization** — 5 tenant settings (license number, payment terms, payment instructions, T&C, footer), quote-specific settings
- **Service Agreements** — flexible frequency options (weekly to annual), standalone page + customer tab
- **Asset Integration with Jobs** — equipmentId FK on jobs, asset picker in job creation, equipment history, standalone /assets page with detail page
- **Enterprise UI/UX Overhaul** — stats cards as page headers, grouped sidebar, settings redesign, 3-panel detail layout, badge system, dark mode
- **React Email Template System** — 14 branded templates (E-01 to E-13 + team invitation), 5 shared brand components, cron jobs for overdue/renewal/trial
- **Default Tax Rate Setting** — tenant-level default, auto-fills on new jobs/invoices/quotes

> **PHASE 1 GOAL:** Ship a working, multi-tenant MVP in 4 weeks that a real service contractor can use to replace their phone + paper workflow. Success metric: 3–5 beta customers actively using the platform by end of Month 2.

---

## 2. System Architecture

### 2.1 Turborepo Monorepo Structure

```
hvac-saas/                          # Turborepo root
├── apps/
│   ├── web/                        # Next.js 14 (App Router) — ALL UI (tenant + superadmin)
│   │   ├── app/
│   │   │   ├── (auth)/             # Login, signup, forgot-password (unified login)
│   │   │   ├── (dashboard)/        # Owner dashboard (tenant-scoped)
│   │   │   │   ├── jobs/
│   │   │   │   ├── customers/
│   │   │   │   ├── invoices/
│   │   │   │   ├── quotes/
│   │   │   │   ├── bookings/
│   │   │   │   ├── schedule/
│   │   │   │   ├── assets/
│   │   │   │   ├── service-agreements/
│   │   │   │   └── settings/
│   │   │   │       ├── team/
│   │   │   │       └── notifications/
│   │   │   ├── (superadmin)/       # Super Admin pages (admin role required)
│   │   │   │   ├── layout.tsx      # Admin layout: red sidebar + "ADMIN" badge
│   │   │   │   ├── dashboard/      # MRR, signups, active users overview
│   │   │   │   ├── tenants/        # Tenant list, detail, impersonation
│   │   │   │   ├── analytics/      # MRR, signups, churn, active users
│   │   │   │   ├── support/        # Global search, audit log, email log
│   │   │   │   ├── affiliates/     # Affiliate performance overview
│   │   │   │   └── system/         # Webhook log, cron history, health
│   │   │   ├── book/[slug]/        # Public booking portal (no auth)
│   │   │   ├── ref/[code]/         # Affiliate redirect
│   │   │   ├── invite/[id]/        # Team invitation acceptance
│   │   │   └── api/                # Next.js API routes (chat, auth callbacks)
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui primitives
│   │   │   └── dashboard/          # Dashboard components by entity
│   │   │       ├── reusable/       # Shared components (EmptyState, Pagination, etc.)
│   │   │       ├── customers/
│   │   │       ├── jobs/
│   │   │       ├── invoices/
│   │   │       ├── quotes/
│   │   │       ├── chatbot/
│   │   │       └── settings/
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
│       │   │   ├── notifications/
│       │   │   ├── tags/
│       │   │   ├── pipeline-stages/
│       │   │   ├── admin/          # Super admin API routes
│       │   │   └── webhooks/
│       │   ├── jobs/               # Background cron runners
│       │   └── server.ts
│       └── package.json
├── packages/
│   ├── database/                   # @hvac-saas/database — Drizzle schema, clients
│   ├── types/                      # @hvac-saas/types — TypeScript types from Drizzle
│   ├── ui/                         # @hvac-saas/ui — shared React components
│   ├── email/                      # @hvac-saas/email — React Email templates (E-01 to E-14)
│   └── config/                     # @hvac-saas/config — shared ESLint + TypeScript config
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Application Layer Overview

| Layer | Technology | Responsibility | Hosting |
|---|---|---|---|
| Frontend (Unified) | Next.js 14 (App Router) | Dashboard UI, booking portal, invoice view, auth pages, realtime Kanban, AI chatbot, **Super Admin panel** (`/superadmin/*`) | Vercel Hobby (free) |
| Backend API | Fastify (Node.js) | Multi-tenant middleware, admin routes, webhooks, background cron jobs, PDF generation, notifications | Render free tier |
| Database | Supabase (PostgreSQL 15) | All data, realtime pub/sub | Supabase free tier |
| ORM | Drizzle ORM | Type-safe queries, schema-as-code, auto-generated migrations | Bundled (zero runtime cost) |
| Auth | Better Auth | Unified auth — email/password, organization plugin (multi-tenancy), admin plugin (super admin). Single session system, role-based access | Bundled with Fastify |
| File Storage | Supabase Storage | Job photos, invoice PDFs, tenant logos | Supabase (bundled) |
| Email | Resend + React Email | 14 branded transactional email templates via `@hvac-saas/email` | Resend free (3K/mo) |
| Maps | Mapbox GL JS | GPS map, address autocomplete | Mapbox free (50K loads/mo) |
| Billing | Lemon Squeezy | Subscription billing + Affiliate program (built-in) | Per-transaction: 5% + $0.50 |
| Realtime | Supabase Realtime | Live Kanban board updates, in-app notifications | Supabase (bundled) |
| AI | Groq + Vercel AI SDK v6 | AI help chatbot with tool calling (10 tools) | Groq free tier |

### 2.3 Multi-Tenancy Model

Shared-database, shared-schema multi-tenancy. Every tenant table has a `tenant_id` column. Tenant isolation is enforced at the **application level** via the `tenantFilter()` helper in `apps/api/src/lib/db/tenant-scope.ts`. This approach replaced Row Level Security (RLS) for simplicity and debuggability. Super admin routes use `requireAdmin` middleware which checks `user.role === 'admin'` via Better Auth.

### 2.4 Unified Login Architecture

Super admin is deployed in the **same Next.js app** — no separate `apps/admin`. Superadmin pages live under the `(superadmin)` route group at `/superadmin/*`.

**Unified login flow** via Better Auth:

1. User enters email + password on `/login`
2. Better Auth `signIn.email()` authenticates and returns session + user with `role` field
3. If `role === 'admin'` → redirect to `/superadmin/dashboard`
4. Otherwise → redirect to `/dashboard` (tenant app)
5. If authentication fails → show "Invalid credentials" error

There is **no separate `admin_users` table** — super admins are regular users with `role = 'admin'` in the Better Auth `user` table. Admin seeding is done via `pnpm seed:admin` which creates a user with `role = 'admin'` from `ADMIN_SEED_EMAIL` + `ADMIN_SEED_PASSWORD` environment variables.

**Route protection** is enforced in `middleware.ts`:
- `/superadmin/*` → requires valid Better Auth session with `role = 'admin'`
- `/dashboard/*` → requires valid Better Auth session with active tenant/organization
- Both use the same session mechanism (Better Auth cookies)

---

## 3. Database Design & ERD

### 3.1 Core Tables

All core tables use Drizzle ORM schema-as-code (defined in `packages/database/src/schema/`). Core tables: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` (Better Auth), `tenants`, `tenant_subscriptions`, `customers`, `equipment`, `jobs`, `job_line_items`, `job_photos`, `refrigerant_logs`, `invoices`, `invoice_line_items`, `invoice_payments`, `bookings`, `availability_schedules`, `schedule_overrides`, `catalog_items`, `checklist_templates`, `checklist_items`, `job_checklist_completions`, `quotes`, `quote_line_items`, `maintenance_contracts`.

### 3.2 Admin & Platform Tables

#### `admin_audit_log`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| admin_user_id | uuid | FK → user(id) NOT NULL | Who performed the action |
| action | text | NOT NULL | `impersonate_start \| impersonate_end \| tenant_deactivate \| tenant_activate \| trial_extend \| subscription_override \| tenant_delete \| feature_flag_change` |
| target_tenant_id | uuid | FK → tenants(id) nullable | Affected tenant |
| target_user_id | uuid | nullable | Affected user if applicable |
| metadata | jsonb | | Additional context (reason, old value, new value) |
| ip_address | text | | Admin's IP address |
| created_at | timestamptz | default now() | Immutable timestamp |

> **RULE:** `admin_audit_log` is append-only. No UPDATE or DELETE operations. Every super admin action writes here first.

#### `admin_impersonation_sessions`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| admin_user_id | uuid | FK → user(id) | Admin performing impersonation |
| tenant_id | uuid | FK → tenants(id) | Tenant being accessed |
| tenant_user_id | uuid | FK → user(id) | Specific user being impersonated |
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

### 3.3 Affiliate Tracking Columns

```sql
-- On tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referred_by_affiliate_id text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS referral_source text default 'organic';
-- referral_source values: 'affiliate' | 'organic' | 'direct' | 'referral'

-- On tenant_subscriptions table
ALTER TABLE tenant_subscriptions ADD COLUMN IF NOT EXISTS affiliate_commission_rate numeric(5,4);
-- Stores commission % at time of signup for historical accuracy
```

### 3.4 New Tables — Custom Pipeline Stages

#### `job_pipeline_stages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| name | text | NOT NULL | Internal identifier (e.g. `scheduled`) |
| label | text | NOT NULL | Display label (e.g. `Scheduled`) |
| color | text | NOT NULL | Color preset key from 8 presets (blue, brand, green, red, purple, amber, gray, teal) |
| sort_order | int | NOT NULL | Column ordering for Kanban drag reorder |
| is_default | boolean | default false | Whether this stage is the initial status for new jobs |
| created_at | timestamptz | default now() | |

> `jobs.status` is a text column (not enum) that references `job_pipeline_stages.name`. Each tenant can customize their own pipeline columns.

### 3.5 New Tables — Customer Notes & Activity System

#### `customer_notes`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| customer_id | uuid | FK → customers(id) NOT NULL | Associated customer |
| content | text | NOT NULL | Note content |
| author_id | uuid | FK → user(id) NOT NULL | Who wrote the note |
| created_at | timestamptz | default now() | |
| updated_at | timestamptz | default now() | |

#### `customer_activities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| customer_id | uuid | FK → customers(id) NOT NULL | Associated customer |
| activity_type | text | NOT NULL | e.g. `customer_created`, `job_created`, `invoice_sent`, `note_added` |
| description | text | NOT NULL | Human-readable description |
| metadata | jsonb | | Additional context |
| user_id | uuid | FK → user(id) | Who triggered the activity |
| created_at | timestamptz | default now() | |

#### `job_activities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| job_id | uuid | FK → jobs(id) NOT NULL | Associated job |
| activity_type | text | NOT NULL | e.g. `status_changed`, `line_item_added`, `checklist_completed` |
| description | text | NOT NULL | Human-readable description |
| metadata | jsonb | | Additional context |
| user_id | uuid | FK → user(id) | Who triggered the activity |
| created_at | timestamptz | default now() | |

#### `quote_activities`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| quote_id | uuid | FK → quotes(id) NOT NULL | Associated quote |
| activity_type | text | NOT NULL | e.g. `quote_created`, `quote_sent`, `quote_accepted` |
| description | text | NOT NULL | Human-readable description |
| metadata | jsonb | | Additional context |
| user_id | uuid | FK → user(id) | Who triggered the activity |
| created_at | timestamptz | default now() | |

### 3.6 New Tables — Tags

#### `tags`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| name | text | NOT NULL | Tag display name |
| color | text | | Tag color (hex or preset) |
| created_at | timestamptz | default now() | |

#### `customer_tags` (junction table)

| Column | Type | Constraints | Description |
|---|---|---|---|
| customer_id | uuid | FK → customers(id) NOT NULL | |
| tag_id | uuid | FK → tags(id) NOT NULL | |
| | | PK (customer_id, tag_id) | Composite primary key |

### 3.7 New Tables — Notifications

#### `notifications`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| user_id | uuid | FK → user(id) NOT NULL | Target recipient |
| type | text | NOT NULL | Notification type (e.g. `job_assigned`, `invoice_paid`, `booking_received`) |
| title | text | NOT NULL | Notification title |
| body | text | | Notification body text |
| metadata | jsonb | | Additional data (entity IDs, links, etc.) |
| created_at | timestamptz | default now() | |

#### `notification_reads`

| Column | Type | Constraints | Description |
|---|---|---|---|
| notification_id | uuid | FK → notifications(id) NOT NULL | |
| user_id | uuid | FK → user(id) NOT NULL | |
| read_at | timestamptz | default now() | When the notification was read |
| | | PK (notification_id, user_id) | Composite primary key |

#### `notification_channel_config`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
| user_id | uuid | FK → user(id) NOT NULL | User preference |
| channel | text | NOT NULL | `in_app \| email` |
| enabled | boolean | default true | Whether channel is enabled |

#### `notification_deliveries`

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| notification_id | uuid | FK → notifications(id) NOT NULL | |
| channel | text | NOT NULL | `in_app \| email` |
| status | text | NOT NULL | `pending \| sent \| failed` |
| sent_at | timestamptz | | When delivery was attempted |

---

## 4. User Flows

### 4.1 – 4.6 (unchanged from v1.0)

All existing flows remain: Owner Onboarding, Customer Booking, Job Lifecycle, Invoice Management, Customer & Equipment Management, Schedule Management.

### 4.7 Super Admin Impersonation Flow

1. Admin logs into `/login` — same login page, Better Auth detects `role = 'admin'` and redirects to `/superadmin`
2. Admin navigates to `/superadmin/tenants` → searches for tenant
3. Admin opens tenant detail → clicks **"Impersonate"**
4. Modal requires: mandatory **Reason** field (e.g. "Customer support ticket #123")
5. On confirm: Fastify generates a short-lived impersonation JWT (15 min TTL) scoped to that tenant
6. Admin browser opens tenant dashboard (`/dashboard`) with a **red banner**: "You are viewing as [Business Name] — [Admin Name]"
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

### 4.9 Team Invitation Flow

1. Organization owner navigates to `/settings/team`
2. Clicks **"Invite Member"**, enters email and selects role (admin or member)
3. Better Auth creates invitation record; Fastify sends E-14 invitation email via Resend
4. Invited user clicks link in email → lands on `/invite/[id]`
5. If not signed up: creates account first, then accepts invitation
6. If already signed up: accepts invitation directly
7. User is added to the organization with the assigned role
8. Owner sees updated member list with new member's status

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
| KPI-08 | Quick action buttons | Shortcut buttons: New Job, New Customer, View Invoices, View Bookings | P0 |

> **No new tables or API endpoints.** All data already exists. Pure frontend aggregate queries via API. Stats cards are rendered as page headers following the enterprise UI pattern.

---

### 5.9 Service Catalog & Price Book

| ID | Feature | Specification | Priority |
|---|---|---|---|
| CAT-01 | Catalog management page | `/settings/catalog` — list, create, edit, archive catalog items | P0 |
| CAT-02 | Catalog item fields | `name`, `item_type` (labor/part/material/service_call/other), `unit_price`, `unit`, `category`, `description`, `is_active` | P0 |
| CAT-03 | Line item autocomplete | On job/invoice line item add: typing triggers catalog search. Select item → auto-fills description, unit_price, item_type. | P0 |
| CAT-04 | Catalog item FK | `job_line_items.catalog_item_id` (nullable FK → `catalog_items.id`) — tracks which catalog item was used | P0 |
| CAT-05 | Bulk CSV import | Upload CSV with columns: name, item_type, unit_price, unit, category. Validates and inserts. | P1 |
| CAT-06 | Item categories | Filter autocomplete dropdown by category — shows relevant items faster | P0 |

**DB table: `catalog_items`**

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | uuid | PK | |
| tenant_id | uuid | FK → tenants(id) NOT NULL | Tenant scope |
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
| RR-06 | Manual trigger | "Request Review" button on any paid invoice detail — sets `review_requested_at`, sends immediately | P0 |

**DB changes:**

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_review_url text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS review_request_enabled boolean default true;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS review_requested_at timestamptz;
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

**DB tables: `checklist_templates`, `checklist_items`, `job_checklist_completions`**

```sql
CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  service_type text NOT NULL,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  template_id uuid NOT NULL REFERENCES checklist_templates(id),
  label text NOT NULL,
  is_required boolean DEFAULT true,
  catalog_item_id uuid REFERENCES catalog_items(id),
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  job_id uuid NOT NULL REFERENCES jobs(id),
  checklist_item_id uuid NOT NULL REFERENCES checklist_items(id),
  is_completed boolean DEFAULT false,
  completed_by uuid REFERENCES "user"(id),
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
| QT-08 | Expiry auto-decline | Fastify cron (daily): quotes where `expiry_date < today AND status = sent` → set `status = expired`. Owner notified. | P0 |
| QT-09 | Quote line items | Separate `quote_line_items` table. Same structure as `job_line_items`. Catalog autocomplete supported. | P0 |

**DB tables: `quotes`, `quote_line_items`**

```sql
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  quote_number text NOT NULL,
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

CREATE TABLE IF NOT EXISTS quote_line_items (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_number ON quotes(tenant_id, quote_number);
```

**API endpoints:**

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
| CAL-01 | Calendar page | `/dashboard/schedule` — toggleable from `/dashboard/jobs` via header switch | P0 |
| CAL-02 | Month / Week / Day views | react-big-calendar with view switcher. Default: Week view. | P0 |
| CAL-03 | Job events | Each scheduled job renders as event: customer name, time slot, service type. Colour by priority: emergency=red, urgent=orange, standard=blue. | P0 |
| CAL-04 | Click to open | Clicking an event opens the job detail side panel (same component as Kanban) | P0 |
| CAL-05 | Drag to reschedule | react-big-calendar drag-and-drop: updates `jobs.scheduled_date` + `jobs.scheduled_start` via `PATCH /jobs/:id`. Supabase Realtime broadcasts change to Kanban. | P0 |
| CAL-06 | View toggle persistence | User's preferred view (Kanban vs Calendar) stored in `localStorage`. Default: Kanban. | P0 |
| CAL-07 | Three entity types | Calendar displays Jobs, Bookings, and Calendar Events as distinct event types with different visual treatment | P0 |

> **No new DB tables.** Uses existing `jobs` and `bookings` data. Library: `react-big-calendar` (MIT license). Drag calls existing `PATCH /jobs/:id` endpoint.

---

### 5.14 Super Admin Dashboard — Phase 1 Scope

**Phase 1 builds the support essentials. Analytics and system health build out in Phase 2.**

#### 5.14.1 Access & Authentication

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-01 | Unified admin routes | `/superadmin/*` — same Next.js app, same deployment, route-group isolation via middleware | P0 |
| SA-02 | Admin login (unified) | Same `/login` page; Better Auth email+password; `role = 'admin'` auto-detected; no self-signup — seed first admin via `pnpm seed:admin` | P0 |
| SA-03 | Role-based access | `admin`: full access via Better Auth role field. No separate admin roles in Phase 1 | P0 |
| SA-04 | Session security | Better Auth session with configurable expiry; re-auth required for destructive actions | P0 |

#### 5.14.2 Tenant Management

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-05 | Tenant list | Table: business name, owner email, plan, status, signup date, last active, MRR. Searchable, sortable, filterable by status | P0 |
| SA-06 | Tenant detail view | Full profile: business info, subscription status, usage stats (jobs/invoices/customers count), impersonation button | P0 |
| SA-07 | Impersonation | Generate short-lived JWT for tenant; requires reason field; red banner in tenant app; full audit log | P0 |
| SA-08 | Activate / Deactivate | Toggle `tenants.is_active`; deactivated tenants see subscription gate on next load | P0 |
| SA-09 | Extend trial | Bump `trial_ends_at` without Lemon Squeezy interaction; logged to audit | P0 |
| SA-10 | Subscription override | Manually set `tenant_subscriptions.status`; used for support edge cases | P0 |
| SA-11 | Edit tenant details | Fix business name, email, slug typos; all edits logged | P0 |
| SA-12 | Delete tenant | Hard delete with 2-step confirmation; cascades all data; logged; irreversible | P0 |

#### 5.14.3 Platform Analytics (Phase 1 — core metrics only)

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-13 | MRR dashboard | Current MRR, MRR 30d ago, MRR delta. Calculated from active `tenant_subscriptions` | P0 |
| SA-14 | Signup chart | New tenants per day/week/month. Bar chart (recharts). Last 90 days | P0 |
| SA-15 | Trial conversion | Trial starts vs trial-to-paid conversions. Funnel view | P0 |
| SA-16 | Churn list | Tenants who cancelled in last 30/60/90 days. Status, days active, MRR lost | P0 |
| SA-17 | Active tenant tracking | Daily/Weekly/Monthly active tenants based on `platform_events`. Last login per tenant | P0 |
| SA-18 | Inactive alert list | Tenants with no `platform_events` in last 14 days — churn risk | P0 |
| SA-19 | Feature adoption | % of tenants who have used: booking portal, invoice send, refrigerant log. Simple table | P0 |

#### 5.14.4 Support Tools

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-20 | Global search | Search by tenant name, email, job number, invoice number across all data (admin queries bypass tenant filter) | P0 |
| SA-21 | Tenant activity log | All `platform_events` for a specific tenant — for debugging customer issues | P0 |
| SA-22 | Impersonation audit log | All past impersonation sessions: admin, tenant, reason, duration, actions | P0 |
| SA-23 | Email delivery log | Resend webhook events stored — delivered/bounced/failed per tenant | P0 |
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
| AF-06 | Admin affiliate overview | In super admin `/superadmin/affiliates`: table of referred tenants by affiliate_id, MRR attributed, conversion rate | P0 |

---

### 5.16 Custom Pipeline Stages

| ID | Feature | Specification | Priority |
|---|---|---|---|
| PS-01 | Pipeline settings page | `/settings/pipeline` — CRUD for custom Kanban stages per tenant | P0 |
| PS-02 | Stage fields | `name` (internal key), `label` (display), `color` (from 8 presets), `sort_order`, `is_default` | P0 |
| PS-03 | Drag reorder | Drag-and-drop to reorder stages; sort_order updates automatically | P0 |
| PS-04 | 8 color presets | blue, brand, green, red, purple, amber, gray, teal — each with dot, bg, text, border, borderTop, ring classes + dark mode | P0 |
| PS-05 | Default stage | One stage marked `is_default = true` — new jobs start in this stage | P0 |
| PS-06 | Seed defaults | On tenant creation, seed standard stages: Scheduled, In Progress, Completed, Cancelled | P0 |
| PS-07 | Kanban integration | Kanban board columns render from `job_pipeline_stages` table; `jobs.status` is text referencing stage name | P0 |

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/pipeline-stages` | List all stages for tenant (ordered by sort_order) |
| POST | `/pipeline-stages` | Create new stage |
| PATCH | `/pipeline-stages/:id` | Update stage (label, color, sort_order) |
| DELETE | `/pipeline-stages/:id` | Delete stage (only if no jobs reference it) |
| PUT | `/pipeline-stages/reorder` | Bulk update sort_order for all stages |

---

### 5.17 Team Management & Roles

| ID | Feature | Specification | Priority |
|---|---|---|---|
| TM-01 | Team settings page | `/settings/team` — list all organization members with roles | P0 |
| TM-02 | Invite member | Send email invitation to join organization. Specify role: admin or member | P0 |
| TM-03 | Role hierarchy | Owner (org creator) → Admin (full access) → Member (limited access). Better Auth organization plugin handles roles | P0 |
| TM-04 | Invitation flow | E-14 email sent → user clicks link → `/invite/[id]` acceptance page → added to org | P0 |
| TM-05 | Remove member | Owner/admin can remove members. Removed users lose access to tenant data | P0 |
| TM-06 | Change role | Owner can promote member to admin or demote admin to member | P0 |
| TM-07 | Pending invitations | Show pending invitations with resend and cancel actions | P0 |

> Uses Better Auth `organization`, `member`, and `invitation` tables. No custom tables needed.

---

### 5.18 Multi-Channel Notifications

| ID | Feature | Specification | Priority |
|---|---|---|---|
| NT-01 | In-app notifications | Real-time in-app notifications via Supabase Realtime. Bell icon in navbar with unread count badge | P0 |
| NT-02 | Email notifications | Transactional email notifications for key events (booking received, invoice paid, etc.) | P0 |
| NT-03 | Notification preferences | `/settings/notifications` — per-user channel preferences (in_app, email) toggles per notification type | P0 |
| NT-04 | Mark as read | Individual and bulk "mark all as read" actions | P0 |
| NT-05 | Notification dropdown | Click bell → dropdown panel showing recent notifications with timestamps | P0 |
| NT-06 | Delivery tracking | `notification_deliveries` table tracks per-channel delivery status (pending/sent/failed) | P0 |

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notifications` | List notifications for current user |
| PATCH | `/notifications/:id/read` | Mark single notification as read |
| POST | `/notifications/read-all` | Mark all notifications as read |
| GET | `/notifications/preferences` | Get user notification channel preferences |
| PUT | `/notifications/preferences` | Update notification channel preferences |

---

### 5.19 AI Help Chatbot

| ID | Feature | Specification | Priority |
|---|---|---|---|
| CB-01 | Chat panel UI | Floating chat button (bottom-right) → animated slide-up panel with message history | P0 |
| CB-02 | AI engine | Groq `llama-3.3-70b-versatile` via Vercel AI SDK v6 `generateText()` with tool calling | P0 |
| CB-03 | Knowledge base | ~30 FAQ entries covering all platform features, injected as system prompt context | P0 |
| CB-04 | Greeting tool | `greet` — responds with contextual welcome message | P0 |
| CB-05 | Help tool | `answer_help` — answers questions using knowledge base entries | P0 |
| CB-06 | Entity creation tools | 8 tools: `create_customer`, `create_event`, `create_job`, `create_invoice`, `create_quote`, `create_catalog_item`, `create_equipment`, `create_booking` | P0 |
| CB-07 | Animated UI | CSS keyframe animations: slide, fade, pop, shake, pulse on chat elements | P0 |
| CB-08 | Session memory | Chat history persists within browser session | P0 |

**Implementation:**
- API route: `apps/web/src/app/api/chat/route.ts` (Next.js API route, not server action)
- UI: `apps/web/src/components/dashboard/chatbot/`
- Hook: `apps/web/src/hooks/use-chatbot.ts`
- Knowledge base: `apps/web/src/lib/chatbot/knowledge-base.ts`
- AI SDK v6 uses `inputSchema` (not `parameters`) and `maxOutputTokens` (not `maxTokens`)
- Env: `GROQ_API_KEY`

---

### 5.20 Customer Tags & Activity System

| ID | Feature | Specification | Priority |
|---|---|---|---|
| TA-01 | Reusable tags | Tenant-level tags with name and color. CRUD in customer detail sidebar | P0 |
| TA-02 | Tag assignment | Many-to-many via `customer_tags` junction table. Add/remove tags on customer detail | P0 |
| TA-03 | Filter by tag | Customer list supports filtering by one or more tags | P0 |
| TA-04 | Customer notes | CRUD notes on customer detail page. Each note has content + author + timestamps | P0 |
| TA-05 | Customer activity timeline | Automated activity log: customer created, job created, invoice sent, note added, tag added/removed, etc. | P0 |
| TA-06 | Job activity timeline | Automated activity log on job detail: status changed, line item added, checklist completed, etc. | P0 |
| TA-07 | Quote activity timeline | Automated activity log on quote detail: quote created, sent, accepted, declined, converted to job, etc. | P0 |

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/tags` | List all tags for tenant |
| POST | `/tags` | Create tag |
| PATCH | `/tags/:id` | Update tag |
| DELETE | `/tags/:id` | Delete tag |
| POST | `/customers/:id/tags` | Assign tag to customer |
| DELETE | `/customers/:id/tags/:tagId` | Remove tag from customer |
| GET | `/customers/:id/notes` | List notes for customer |
| POST | `/customers/:id/notes` | Create note |
| PATCH | `/customers/:id/notes/:noteId` | Update note |
| DELETE | `/customers/:id/notes/:noteId` | Delete note |
| GET | `/customers/:id/activities` | List customer activity timeline |
| GET | `/jobs/:id/activities` | List job activity timeline |
| GET | `/quotes/:id/activities` | List quote activity timeline |

---

### 5.21 Invoice & Quote PDF Customization

| ID | Feature | Specification | Priority |
|---|---|---|---|
| PC-01 | License number setting | `tenants.license_number` — printed on invoice/quote PDFs | P0 |
| PC-02 | Payment terms setting | `tenants.payment_terms` — default payment terms text for invoices | P0 |
| PC-03 | Payment instructions | `tenants.payment_instructions` — how-to-pay instructions on invoice PDFs | P0 |
| PC-04 | Terms & conditions | `tenants.terms_and_conditions` — legal text on invoice/quote PDFs | P0 |
| PC-05 | Footer text | `tenants.invoice_footer` — custom footer on all PDFs | P0 |
| PC-06 | Quote-specific settings | Separate quote acceptance terms, validity note on quote PDFs | P0 |
| PC-07 | Settings UI | `/settings/invoices` — form to edit all PDF customization fields | P0 |

---

### 5.22 Service Agreements

| ID | Feature | Specification | Priority |
|---|---|---|---|
| SA-01 | Agreements list page | `/service-agreements` — table with status, customer, frequency, next service date | P0 |
| SA-02 | Agreement creation | Create agreement linked to customer. Fields: service_type, frequency, start_date, end_date, price, notes | P0 |
| SA-03 | Frequency options | Weekly, bi-weekly, monthly, quarterly, semi-annual, annual | P0 |
| SA-04 | Customer tab | Service agreements tab on customer detail page showing all agreements for that customer | P0 |
| SA-05 | Status tracking | `active \| expired \| cancelled` status with auto-expiry based on end_date | P0 |
| SA-06 | Renewal reminders | E-09 cron: email customer when agreement approaching renewal date | P0 |
| SA-07 | Industry-agnostic naming | Named "Service Agreements" (not "Maintenance Contracts") for multi-industry compatibility | P0 |

> Uses existing `maintenance_contracts` table (renamed in UI to "Service Agreements"). No schema changes needed.

---

### 5.23 Asset Integration with Jobs

| ID | Feature | Specification | Priority |
|---|---|---|---|
| AI-01 | Assets list page | `/assets` — standalone equipment/assets page with search, filter, and status badges | P0 |
| AI-02 | Asset detail page | `/assets/[id]` — full asset detail with service history, linked jobs, customer info | P0 |
| AI-03 | Job-asset link | `jobs.equipment_id` FK → `equipment(id)` — associate a job with a specific asset | P0 |
| AI-04 | Asset picker in job form | Dropdown to select customer's equipment when creating/editing a job | P0 |
| AI-05 | Equipment history endpoint | API endpoint returning all jobs linked to a specific equipment item | P0 |
| AI-06 | Customer equipment tab | Equipment/assets tab on customer detail page | P0 |

**DB changes:**

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES equipment(id);
```

**API endpoints:**

| Method | Endpoint | Description |
|---|---|---|
| GET | `/equipment` | List all equipment for tenant |
| GET | `/equipment/:id` | Equipment detail with service history |
| GET | `/equipment/:id/jobs` | Jobs linked to this equipment |

---

### 5.24 Enterprise UI/UX Overhaul

| ID | Feature | Specification | Priority |
|---|---|---|---|
| UX-01 | Stats cards as page headers | KPI stats rendered as header cards on list pages (jobs, customers, invoices, quotes) | P0 |
| UX-02 | Grouped sidebar | Sidebar navigation grouped by category (Main, Operations, Financial, Settings) with collapsible sections | P0 |
| UX-03 | Settings redesign | Settings page with `SettingsSection` card components, icon+title pattern, grid layout | P0 |
| UX-04 | 3-panel detail layout | Customer/job/invoice detail: left sidebar (info) + center tabs (content) + right sidebar (related) | P0 |
| UX-05 | Badge system | Consistent status badges with color presets, dark mode variants, rounded-full design | P0 |
| UX-06 | Dark mode | Full dark mode via `next-themes` (class-based). All tokens have dark overrides in `globals.css` | P0 |
| UX-07 | Skeleton loading | All loading states use skeleton loaders instead of spinners | P0 |
| UX-08 | Empty states | Consistent `EmptyState` component with icon, title, description, action button | P0 |
| UX-09 | Responsive design | Mobile-first responsive layout. Sidebar collapses on mobile. Tables scroll horizontally | P0 |

---

### 5.25 React Email Template System

| ID | Feature | Specification | Priority |
|---|---|---|---|
| ET-01 | Email package | `@hvac-saas/email` package with React Email templates and shared brand components | P0 |
| ET-02 | 5 shared brand components | `BrandHeader`, `BrandFooter`, `BrandButton`, `BrandDivider`, `BrandContainer` — consistent branding across all emails | P0 |
| ET-03 | 14 email templates | E-01 through E-13 + E-14 (team invitation). See Section 7 for full list | P0 |
| ET-04 | Cron: overdue invoices | Daily cron sends E-07 for invoices past due date | P0 |
| ET-05 | Cron: contract renewal | Daily cron sends E-09 for agreements approaching renewal | P0 |
| ET-06 | Cron: trial expiring | Daily cron sends E-10 for tenants with trials expiring in 3 days | P0 |
| ET-07 | Template variables | All templates support dynamic variables: tenant name, customer name, amounts, dates, links | P0 |

---

### 5.26 Default Tax Rate Setting

| ID | Feature | Specification | Priority |
|---|---|---|---|
| TX-01 | Tenant-level default tax rate | `tenants.default_tax_rate` numeric field — configurable in `/settings/business` | P0 |
| TX-02 | Auto-fill on creation | When creating a new job, invoice, or quote, the tax_rate field auto-fills from the tenant default | P0 |
| TX-03 | Override per entity | Tax rate can be manually overridden on any individual job, invoice, or quote | P0 |

**DB changes:**

```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_tax_rate numeric(5,4) DEFAULT 0;
```

---

## 6. API Specification (Fastify)

### 6.1 – 6.6 (unchanged from v1.0)

All existing API endpoints remain for jobs, invoices, customers, bookings, and webhooks.

### 6.7 Admin API Routes

All admin routes require authenticated Better Auth session with `role = 'admin'`. Admin middleware (`requireAdmin`) checks the user's role from the Better Auth session. Uses application-level queries that bypass tenant filtering.

| Method | Endpoint | Role Required | Description |
|---|---|---|---|
| GET | `/admin/tenants` | admin | List tenants with filters + search |
| GET | `/admin/tenants/:id` | admin | Tenant detail: profile, stats, subscription |
| PATCH | `/admin/tenants/:id` | admin | Edit tenant fields |
| POST | `/admin/tenants/:id/impersonate` | admin | Generate impersonation JWT. Body: `{ reason }` |
| POST | `/admin/tenants/:id/deactivate` | admin | Set `is_active = false` |
| POST | `/admin/tenants/:id/activate` | admin | Set `is_active = true` |
| POST | `/admin/tenants/:id/extend-trial` | admin | Bump `trial_ends_at`. Body: `{ days }` |
| POST | `/admin/tenants/:id/override-subscription` | admin | Set subscription status manually |
| DELETE | `/admin/tenants/:id` | admin | Hard delete. Requires `{ confirm: "DELETE" }` in body |
| GET | `/admin/analytics/mrr` | admin | MRR, delta, trend |
| GET | `/admin/analytics/signups` | admin | Signups over time |
| GET | `/admin/analytics/active-users` | admin | DAT/WAT/MAT counts |
| GET | `/admin/analytics/churn` | admin | Churned tenants list |
| GET | `/admin/analytics/feature-adoption` | admin | Feature usage rates |
| GET | `/admin/search` | admin | Global search across all tables |
| GET | `/admin/audit-log` | admin | All admin actions log |
| GET | `/admin/system/webhooks` | admin | LS webhook history |
| GET | `/admin/system/crons` | admin | Cron run history |
| GET | `/admin/affiliates` | admin | Affiliate attribution overview |

### 6.8 Lemon Squeezy Webhook — Updated Handler

```typescript
// Extended to capture affiliate_id on subscription_created
case 'subscription_created': {
  const affiliateId = payload.meta?.affiliate_id ?? null;
  const referralSource = affiliateId ? 'affiliate' : 'organic';

  await db.update(tenants)
    .set({
      referred_by_affiliate_id: affiliateId,
      referral_source: referralSource
    })
    .where(eq(tenants.id, tenantId));

  await db.insert(tenantSubscriptions).values({
    tenant_id: tenantId,
    lemon_squeezy_subscription_id: payload.data.id,
    status: payload.data.attributes.status,
    // ... other fields
    affiliate_commission_rate: affiliateId ? 0.25 : null
  }).onConflictDoNothing();
  break;
}
```

---

## 7. Email Specifications

All transactional emails are built with React Email in `packages/email/` and sent via Resend. Each template uses 5 shared brand components (`BrandHeader`, `BrandFooter`, `BrandButton`, `BrandDivider`, `BrandContainer`) for consistent styling.

| ID | Trigger | Recipient | Subject |
|---|---|---|---|
| E-01 | User signup | New user | Welcome to [App Name] |
| E-02 | Booking submitted | Customer | Booking Confirmation |
| E-03 | Booking submitted | Tenant owner | New Booking Received |
| E-04 | Booking confirmed | Customer | Your Booking is Confirmed |
| E-05 | Job completed | Customer | Your Service is Complete |
| E-06 | Invoice sent | Customer | Invoice #INV-XXXX |
| E-07 | Invoice overdue (cron) | Customer | Payment Reminder |
| E-08 | Payment received | Customer | Payment Receipt |
| E-09 | Contract renewal (cron) | Customer | Service Agreement Renewal |
| E-10 | Trial expiring (cron) | Tenant owner | Trial Expiring Soon |
| E-11 | First paid subscription | Tenant owner | Welcome + Referral Link |
| E-12 | Invoice paid + google_review_url set | Customer | Review Request |
| E-13 | Quote sent | Customer | Estimate #QT-XXXX |
| E-14 | Team invitation | Invited user | You've Been Invited |

**Cron-triggered emails:**
- **E-07**: Daily cron checks for invoices past `due_date` with `status != paid`. Sends payment reminder.
- **E-09**: Daily cron checks for service agreements with renewal date within 30 days. Sends renewal notice.
- **E-10**: Daily cron checks for tenants with `trial_ends_at` within 3 days. Sends trial expiration warning.

---

## 8. Frontend Pages & Routes

**Tenant App (`apps/web`) — Dashboard Routes:**

| Route | Page | Description | Auth |
|---|---|---|---|
| `/dashboard` | KPI Dashboard | Stats cards, quick actions, business overview | Session |
| `/jobs` | Job Management | Kanban board + table view with custom pipeline stages | Session |
| `/jobs/[id]` | Job Detail | 3-panel layout: info, tabs (checklist, line items, photos, activity), sidebar | Session |
| `/customers` | Customer List | Searchable table with tag filters | Session |
| `/customers/[id]` | Customer Detail | 3-panel: info + tags, tabs (jobs, invoices, notes, equipment, agreements, activity), sidebar | Session |
| `/invoices` | Invoice List | Table with status badges, totals, filters | Session |
| `/invoices/[id]` | Invoice Detail | PDF preview, payment tracking, actions | Session |
| `/quotes` | Quote List | Table with status badges, totals, filters | Session |
| `/quotes/[id]` | Quote Detail | PDF preview, convert-to-job action | Session |
| `/bookings` | Bookings | Incoming booking management | Session |
| `/schedule` | Calendar | Multi-view calendar (month/week/day) with jobs, bookings, events | Session |
| `/assets` | Assets List | Equipment/assets page with search, filter, status | Session |
| `/assets/[id]` | Asset Detail | Equipment detail with service history, linked jobs | Session |
| `/service-agreements` | Service Agreements | Agreements list with status, frequency, next service | Session |
| `/settings` | Settings Hub | Grouped settings navigation | Session |
| `/settings/business` | Business Settings | Company info, logo, tax rate, review URL | Session |
| `/settings/team` | Team Management | Members list, invitations, role management | Session |
| `/settings/notifications` | Notification Preferences | Per-channel notification toggles | Session |
| `/settings/pipeline` | Pipeline Stages | Custom Kanban stage management | Session |
| `/settings/catalog` | Service Catalog | Price book items CRUD | Session |
| `/settings/checklists` | Checklists | Service template management | Session |
| `/settings/invoices` | Invoice Settings | PDF customization (license, terms, footer) | Session |

**Public Routes:**

| Route | Page | Description | Auth |
|---|---|---|---|
| `/book/[slug]` | Booking Portal | Customer self-scheduling | Public |
| `/ref/[code]` | Affiliate Redirect | Sets `aff_code` cookie, redirects to `/` | Public |
| `/invite/[id]` | Invitation Acceptance | Team invitation acceptance page | Public (then auth) |

**Super Admin Routes (same app — `(superadmin)` route group):**

| Route | Page | Description | Auth |
|---|---|---|---|
| `/login` | Unified Login | Same login page — admin role auto-detected, redirects to `/superadmin/dashboard` | Public |
| `/superadmin` | Admin Dashboard | MRR card, signups chart, active users, churn summary | Admin |
| `/superadmin/tenants` | Tenant List | Searchable table with filters | Admin |
| `/superadmin/tenants/[id]` | Tenant Detail | Profile, stats, impersonation, actions | Admin |
| `/superadmin/analytics` | Analytics | Full MRR, signups, churn, conversion charts | Admin |
| `/superadmin/analytics/active-users` | Active Users | DAT/WAT/MAT, last active per tenant, inactive list | Admin |
| `/superadmin/support` | Support Tools | Global search, audit log, email log | Admin |
| `/superadmin/affiliates` | Affiliate Overview | Attribution table, top affiliates, referred MRR | Admin |
| `/superadmin/system` | System Health | Webhook log, cron history | Admin |

---

## 9–12 (unchanged from v1.0)

Shared Packages, Environment Variables, Deployment Configuration remain the same.

### Environment Variables — additions

```bash
# Auth (Better Auth)
BETTER_AUTH_SECRET=[min 32 chars — session signing secret]
ADMIN_SEED_EMAIL=admin@yourapp.com
ADMIN_SEED_PASSWORD=[strong password — change after first login]

# AI Chatbot
GROQ_API_KEY=[Groq API key for AI chatbot]
```

---

## 11. Phase 1 Build Timeline — Updated (4 Weeks)

| Week | Focus | Deliverables | Done When |
|---|---|---|---|
| **Week 1** | Infrastructure + Auth + DB + KPI Dashboard + Admin Scaffold | Turborepo setup, Better Auth (unified login + org plugin), customer CRUD, `catalog_items` table, KPI dashboard homepage (6 cards), admin app + login + tenant list | Owner sees KPI dashboard on login; admin can log in at `/superadmin` |
| **Week 2** | Booking Portal + Kanban + Calendar View + Impersonation + Pipeline | Public booking portal, availability calendar, Kanban board with realtime, Calendar View with drag-to-reschedule, custom pipeline stages, admin tenant detail + impersonation | Customer can book; owner toggles Kanban/Calendar; admin can impersonate; stages are customizable |
| **Week 3** | Invoicing + Quote Builder + Service Catalog + Review Request + Team + Notifications | Invoice generation + PDF + Resend, Quote builder with convert-to-job + E-13, Service Catalog with autocomplete, Review request E-12, Team management + invitations, Multi-channel notifications | Owner sends invoices and quotes; price book live; review auto-sent; team members can be invited |
| **Week 4** | Equipment/Assets + Checklists + Agreements + Chatbot + Email Templates + UI Polish | Equipment records + asset pages, refrigerant logs, job checklists, service agreements, AI chatbot (Groq + 10 tools), React Email templates (E-01 to E-14), enterprise UI overhaul, dark mode, default tax rate, tags + activity system, affiliate capture | Full end-to-end flow; chatbot answers questions; emails are branded; dark mode works; all features polished |

---

## 13. Non-Functional Requirements (additions)

| Category | Requirement | Target |
|---|---|---|
| Security | Admin routes isolated via middleware | Same deployment, `/superadmin/*` protected by Better Auth session with admin role; middleware blocks all access without valid admin session |
| Security | Impersonation sessions | Max 60-minute TTL on impersonation JWT; auto-expire |
| Security | Admin audit log | Append-only; no delete operations even for admin role |
| Security | Tenant isolation | Application-level via `tenantFilter()` helper on every tenant query |
| Performance | Admin dashboard load | < 3s — admin analytics queries use aggregated views, not real-time scans |
| Performance | Chatbot response | < 3s — Groq inference latency for AI chatbot responses |
| Performance | Notification delivery | < 5s — in-app notifications delivered via Supabase Realtime within 5s |
| Compliance | GDPR delete | Hard delete via admin removes all tenant + customer PII within 30 days of request |
| UX | Dark mode | Full dark mode support with CSS variables and class-based toggling |
| UX | Loading states | All pages use skeleton loaders, never spinners |

---

## 14. Phase 1 — Out of Scope

The following items are explicitly out of scope for Phase 1:

- **Online payment processing (Stripe)** — Phase 2+. Invoices track payments manually
- **Affiliate self-signup portal UI** — handled entirely by Lemon Squeezy
- **Commission payout management** — handled entirely by Lemon Squeezy
- **Advanced analytics** — cohort analysis, LTV curves, revenue forecasting (Phase 2)
- **SMS/Voice notifications** — stubs exist in notification system, not active
- **Broadcast email from admin** — mass email to all tenants (Phase 2)
- **Feature flags per tenant** — per-tenant feature toggling (Phase 2)
- **Bulk CSV import for catalog** — catalog items can be added individually; CSV import deferred

---

## 15. Phase 1 Acceptance Criteria

All v1.0 acceptance criteria remain (AC-01 through AC-10). Extended criteria:

| # | Scenario | Steps | Pass Condition |
|---|---|---|---|
| AC-11 | Admin impersonation | Admin logs in via `/login` (auto-redirected to `/superadmin`), opens Tenant A, clicks Impersonate, enters reason | Admin session opens tenant dashboard with red banner; session logged in audit log with reason |
| AC-12 | Impersonation isolation | Admin impersonates Tenant A; queries jobs | Zero rows from Tenant B visible — tenant filter still enforced on impersonation context |
| AC-13 | Audit log immutability | Admin performs 3 actions; attempt DELETE on audit_log | DELETE rejected; all 3 entries intact |
| AC-14 | MRR accuracy | Create 5 active subscriptions at $49; open admin analytics | MRR shows $245; delta correct vs prior period |
| AC-15 | Active user tracking | Tenant logs in and creates a job; check admin analytics | Tenant appears in DAT; `platform_events` has login + job_created entries |
| AC-16 | Affiliate referral capture | Sign up via `/?aff=TEST123`; complete checkout | `tenants.referred_by_affiliate_id = 'TEST123'`; `referral_source = 'affiliate'` |
| AC-17 | Affiliate cookie persistence | Visit `/?aff=TEST123`; navigate to `/pricing`; sign up | `aff_code` cookie preserved through navigation; captured on checkout |
| AC-18 | KPI dashboard accuracy | Create 3 jobs for today, 2 open invoices with $500 balance; open dashboard | KPI cards show: Jobs Today=3, Open Invoices=2, Outstanding Balance=$500 |
| AC-19 | Service catalog autocomplete | Create catalog item "AC Service Call $95"; open new job, add line item, type "AC" | Autocomplete shows catalog item; selecting it fills description + price |
| AC-20 | Review request auto-send | Mark invoice as paid with `google_review_url` set; wait 2h (or trigger manually) | E-12 email delivered to customer; `invoices.review_requested_at` set; no duplicate sent on second trigger |
| AC-21 | Checklist auto-attach | Create checklist template for service type (3 items, 2 required); create a job of that type | Job opens with 3 checklist items; "Complete Job" disabled until 2 required items checked |
| AC-22 | Checklist auto line item | Checklist item has `catalog_item_id` linked; tech checks the item | Corresponding line item auto-added to job; total updates correctly |
| AC-23 | Quote to job conversion | Create quote with 3 line items, send to customer, click "Accept & Create Job" | Job created with same 3 line items; `quotes.converted_to_job_id` set; quote status = accepted |
| AC-24 | Calendar drag reschedule | Open calendar view; drag a job from Monday to Wednesday | `jobs.scheduled_date` updated in DB; Kanban card reflects new date without page refresh |
| AC-25 | Custom pipeline stages | Tenant creates new stage "Awaiting Parts" with purple color; reorders stages | Kanban shows new column in correct position with purple styling; new jobs can be moved to it |
| AC-26 | Team invitation | Owner invites member via email; member accepts invitation | Member appears in team list with assigned role; can access tenant dashboard |
| AC-27 | Role-based access | Member (non-admin) attempts to access settings | Settings pages restricted based on role; appropriate error/redirect shown |
| AC-28 | In-app notifications | New booking is received; check notification bell | Bell shows unread count badge; dropdown shows booking notification in real-time |
| AC-29 | Notification preferences | User disables email channel for bookings; new booking received | In-app notification sent; no email sent for that notification type |
| AC-30 | AI chatbot help | Open chat panel; ask "How do I create an invoice?" | Chatbot responds with accurate step-by-step instructions from knowledge base |
| AC-31 | AI chatbot entity creation | Open chat panel; say "Create a customer named John Smith" | Chatbot calls `create_customer` tool; confirms customer was created with correct details |
| AC-32 | Customer tags | Create tag "VIP" with gold color; assign to customer; filter customer list by "VIP" | Tag appears on customer detail; filter returns only customers with "VIP" tag |
| AC-33 | Activity timeline | Create a job for a customer; change job status; add a note | Customer activity timeline shows all three events in chronological order with descriptions |
| AC-34 | Service agreements | Create a service agreement for a customer with monthly frequency | Agreement appears on agreements list and customer detail tab; renewal cron schedules E-09 |
| AC-35 | Asset-job integration | Create equipment for customer; create job and select that equipment | Job detail shows linked equipment; equipment detail shows job in service history |
| AC-36 | Dark mode | Toggle dark mode in settings/navbar | All pages render correctly with dark theme; no broken colors or missing dark variants |
| AC-37 | Default tax rate | Set default tax rate to 8.25% in business settings; create new invoice | Invoice tax_rate auto-filled with 8.25%; can be manually overridden |
| AC-38 | Email templates | Trigger invoice send; check customer inbox | Branded email received with correct template (E-06), business logo, and all dynamic fields populated |

---

## 16. Getting Started — Developer Setup

```bash
# Clone and install
git clone <repo-url>
pnpm install

# Set up environment
cp .env.example .env
# Fill in: DATABASE_URL, BETTER_AUTH_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY

# Push schema to database
pnpm db:push

# Seed first super admin (run once after initial setup)
pnpm seed:admin
# Creates admin user from ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars

# Start the app (includes both tenant dashboard + superadmin)
pnpm dev

# Access tenant app: http://localhost:3000/login
# Access superadmin: log in with admin credentials → auto-redirected to /superadmin/dashboard
```

---

*Multi-Industry Service Management SaaS — Phase 1 PRD · Version 4.0 · April 2026*
