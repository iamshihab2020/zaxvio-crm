# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HVAC Field Service Management SaaS for solo HVAC contractors (1–3 person teams) in Texas & Florida. Multi-tenant platform ($49/mo via Lemon Squeezy) replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

## Tech Stack

- **Monorepo**: Turborepo + pnpm@10.20.0 workspaces
- **Frontend**: Next.js 14 (App Router) — port 3000
- **Backend**: Fastify — port 4000
- **Database**: Supabase (PostgreSQL 15 + Row Level Security)
- **Auth**: Supabase Auth (tenants) + Fastify bcrypt/JWT (super admin) — unified `/login` page
- **Email**: Resend + React Email templates
- **Billing**: Lemon Squeezy (subscriptions + built-in affiliate program)
- **Maps**: Mapbox GL JS (address autocomplete, geocoding)
- **PDF**: pdfkit (invoices, quotes)
- **Realtime**: Supabase Realtime (Kanban live updates)
- **Testing**: Vitest (unit/integration), Playwright (e2e)

## Commands

```bash
# Development
pnpm dev                    # Start all apps in parallel
pnpm dev:api                # Fastify only (port 4000)
pnpm dev:web                # Next.js only (port 3000)

# Build & Quality
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages
pnpm typecheck              # TypeCheck all packages
pnpm test                   # Run all tests
pnpm format                 # Prettier format all files

# API tests
pnpm -F api test:unit                               # All unit tests
pnpm -F api test:integration                        # All integration tests
pnpm -F api test:unit tests/unit/path/to/test.ts    # Single test file

# Web tests
pnpm -F web test                                    # Vitest
pnpm -F web test:e2e                                # Playwright

# Admin seed (run once after first migration)
pnpm -F api seed:admin      # Creates admin from ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars
```

## Architecture

### Monorepo Structure

```
apps/
  api/          # Fastify REST API (port 4000)
  web/          # Next.js 14 unified app (port 3000) — tenant + superadmin + public booking

packages/
  database/     # @hvac-saas/database — Supabase client wrapper
  types/        # @hvac-saas/types — shared TypeScript interfaces
  ui/           # @hvac-saas/ui — shared React components
  email/        # @hvac-saas/email — React Email templates (E-01 through E-13)
  config/       # @hvac-saas/config — shared ESLint + TypeScript config
```

All apps use ES modules (`"type": "module"`). Path alias `@/*` maps to `./src/*` in both apps.

### Package Dependencies

```
apps/web  → @hvac-saas/types, @hvac-saas/ui
apps/api  → @hvac-saas/database, @hvac-saas/types
```

### Multi-Tenancy Model

Shared-database, shared-schema. Every tenant table has a `tenant_id` column. Supabase Row Level Security enforces isolation — queries only return rows matching the JWT's `tenant_id`. Super admin uses the **service role key** to bypass RLS.

### Dual Authentication

Single `/login` page handles both user types:

1. Login form submits to Next.js API route
2. First tries `POST /admin/auth/login` on Fastify (checks `admin_users` table with bcrypt)
3. If admin match → admin JWT in httpOnly `admin_token` cookie (4h TTL) → redirect `/superadmin/dashboard`
4. If not admin (401) → falls through to `supabase.auth.signInWithPassword()`
5. If tenant match → Supabase session cookies → redirect `/dashboard`
6. If both fail → error

Route protection in `middleware.ts`: `/superadmin/*` requires `admin_token` cookie, `/dashboard/*` requires Supabase session.

### Frontend Route Groups (apps/web)

- `(auth)/` — Login, signup, forgot-password (public)
- `(dashboard)/` — Tenant owner pages: KPI home, jobs (Kanban), customers, invoices, quotes, bookings, schedule (calendar), settings (business, billing, catalog, checklists)
- `(superadmin)/` — Admin panel: dashboard, tenants (list/detail/impersonation), analytics, support, affiliates, system health
- `book/[slug]/` — Public customer booking portal (no auth)
- `ref/[code]/` — Affiliate redirect, sets `aff_code` cookie (30-day)

### API Route Groups (apps/api)

**Tenant routes** (Supabase JWT): `/jobs`, `/customers`, `/invoices`, `/quotes`, `/bookings`, `/catalog`, `/checklists`, `/equipment`, `/refrigerant-logs`, `/availability`, `/settings`

**Admin routes** (Admin JWT): `/admin/auth`, `/admin/tenants` (CRUD + impersonate), `/admin/analytics` (MRR, signups, churn, active users), `/admin/search`, `/admin/audit-log`, `/admin/system`, `/admin/affiliates`

**Public routes** (no auth): `/public/booking`, `/webhooks/lemon-squeezy`

**Background crons**: Invoice reminders (daily 9am), quote expiry (daily midnight), review request emails (every 2h), platform event aggregation

### Database Schema

**Core tables**: `tenants`, `tenant_subscriptions`, `users`, `customers`, `equipment`, `maintenance_contracts`, `jobs`, `job_line_items`, `job_photos`, `refrigerant_logs`, `invoices`, `invoice_line_items`, `invoice_payments`, `bookings`, `availability_schedules`, `schedule_overrides`, `quotes`, `quote_line_items`, `catalog_items`

**Checklist tables**: `checklist_templates` (per service_type), `checklist_items` (with optional `catalog_item_id` for auto line item generation), `job_checklist_completions`

**Admin tables** (no RLS): `admin_users` (bcrypt auth, roles: super_admin/support/billing_admin), `admin_audit_log` (append-only), `admin_impersonation_sessions`, `platform_events` (DAT/WAT/MAT tracking)

Migrations live in `supabase/migrations/`. All migration SQL must be idempotent (use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`).

### Key Data Flows

**Job lifecycle**: Booking/direct → Job (scheduled) → auto-attach checklist if template exists for service_type → tech completes items → checked items with `catalog_item_id` auto-add line items → complete job → generate invoice → send email → customer pays → auto review request email (2h delay, if `google_review_url` set)

**Quote-to-job**: Create quote → add catalog line items → generate PDF → email customer → customer accepts → "Create Job" copies line items → normal job flow

**Affiliate**: `/ref/[code]` sets cookie → signup → Lemon Squeezy checkout → `subscription_created` webhook captures `affiliate_id` → saved to `tenants.referred_by_affiliate_id` → LS handles payouts

### Server Actions (Frontend API Access)

All frontend API calls go through Next.js Server Actions in `apps/web/src/actions/`. Never call the API directly from client components.

```
Component (client) → Server Action → Fastify API
```
