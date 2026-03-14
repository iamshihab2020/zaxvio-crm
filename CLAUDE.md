# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Strict Rules (MUST FOLLOW)

1. **Read PRD & Architecture docs** before any major feature or architectural task:
   - `docs/project_doc/HVAC_SaaS_Phase1_PRD_v2.md` — Product requirements, features, timeline, business logic
   - `docs/project_doc/HVAC_SaaS_System_Diagrams_and_Unified_Auth.md` — System diagrams, auth flow, data architecture

2. **Read & update `docs/todo.md` and `docs/lessons.md` throughout work** — not just at the end:
   - **BEFORE** starting any task — read both files for context and to avoid past mistakes
   - **DURING** work — re-read lessons when hitting bugs/errors; check todo for tracked issues
   - **CONTINUOUSLY** — update as you go: move completed items to Done, add new tasks to Upcoming, append lessons immediately when learned

3. **Update the repo map** in this CLAUDE.md (Monorepo Structure + Schema sections) whenever files/folders are created, renamed, moved, or deleted. Consult the repo map FIRST when planning or searching before using Glob/Grep.

4. **All migration SQL must be idempotent** — use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`.

5. **All `.md` files except `CLAUDE.md` live in `docs/`**.

---

## Project Overview

HVAC Field Service Management SaaS for solo HVAC contractors (1–3 person teams) in Texas & Florida. Multi-tenant platform ($49/mo via Lemon Squeezy) replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm@10.20.0 workspaces |
| Frontend | Next.js 14 (App Router) — port 3000 |
| Backend | Fastify — port 4000 |
| Database | Supabase (PostgreSQL 15 + Row Level Security) |
| ORM | Drizzle ORM (schema-as-code, type-safe queries) |
| Auth | Supabase Auth (tenants) + Fastify bcrypt/JWT (super admin) |
| Email | Resend + React Email templates |
| Billing | Lemon Squeezy (subscriptions + affiliate program) |
| Maps | Mapbox GL JS (address autocomplete, geocoding) |
| PDF | pdfkit (invoices, quotes) |
| Realtime | Supabase Realtime (Kanban live updates) |
| Testing | Vitest (unit/integration), Playwright (e2e) |

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

# Database (Drizzle ORM)
pnpm db:generate            # Generate SQL migrations from schema
pnpm db:push                # Push schema directly to DB (dev only)
pnpm db:studio              # Open Drizzle Studio (DB browser)
pnpm db:migrate             # Run pending migrations

# Testing
pnpm test:unit              # API unit tests
pnpm test:integration       # API integration tests
pnpm test:e2e               # Playwright e2e tests

# Seeding
pnpm seed:admin             # Create admin user (uses ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars)
```

## Architecture

### Monorepo Structure

```
apps/
  api/          # Fastify REST API (port 4000)
  web/          # Next.js 14 unified app (port 3000)

packages/
  database/     # @hvac-saas/database — Drizzle schema, clients (Drizzle + Supabase)
  types/        # @hvac-saas/types — TypeScript types inferred from Drizzle schema
  ui/           # @hvac-saas/ui — shared React components
  email/        # @hvac-saas/email — React Email templates (E-01 through E-13)
  config/       # @hvac-saas/config — shared ESLint + TypeScript config
```

All packages use ES modules (`"type": "module"`). Path alias `@/*` maps to `./src/*` in both apps.

### Package Dependencies

```
apps/api  → @hvac-saas/database, @hvac-saas/types
apps/web  → @hvac-saas/types, @hvac-saas/ui
packages/types → @hvac-saas/database
```

### Multi-Tenancy

Shared-database, shared-schema. Every tenant table has a `tenant_id` column. Supabase RLS enforces isolation — queries only return rows matching the JWT's `tenant_id`. Super admin uses the **service role key** to bypass RLS.

### Dual Authentication

Single `/login` page handles both user types:

1. Form submits to Next.js API route
2. Tries `POST /admin/auth/login` on Fastify first (checks `admin_users` with bcrypt)
3. Admin match → admin JWT in httpOnly `admin_token` cookie (4h TTL) → `/superadmin/dashboard`
4. Not admin (401) → falls through to `supabase.auth.signInWithPassword()`
5. Tenant match → Supabase session cookies → `/dashboard`
6. Both fail → error

Route protection via `middleware.ts`: `/superadmin/*` requires `admin_token`, `/dashboard/*` requires Supabase session.

## Database

### Schema (Drizzle ORM)

Schema defined in `packages/database/src/schema/` (17 files, 26 tables):

| File | Tables |
|------|--------|
| `enums.ts` | 13 `pgEnum` definitions |
| `tenants.ts` | `tenants` |
| `admin.ts` | `adminUsers`, `adminAuditLog`, `adminImpersonationSessions`, `platformEvents` |
| `users.ts` | `users` |
| `subscriptions.ts` | `tenantSubscriptions` |
| `customers.ts` | `customers` |
| `catalog.ts` | `catalogItems` |
| `equipment.ts` | `equipment`, `refrigerantLogs` |
| `maintenance.ts` | `maintenanceContracts` |
| `bookings.ts` | `bookings` |
| `jobs.ts` | `jobs`, `jobLineItems`, `jobPhotos` |
| `invoices.ts` | `invoices`, `invoiceLineItems`, `invoicePayments` |
| `quotes.ts` | `quotes`, `quoteLineItems` |
| `schedule.ts` | `availabilitySchedules`, `scheduleOverrides` |
| `checklists.ts` | `checklistTemplates`, `checklistItems`, `jobChecklistCompletions` |
| `relations.ts` | All Drizzle `relations()` for query builder joins |
| `index.ts` | Barrel re-export |

**RLS**: 23 tenant tables have RLS enabled. Admin tables (3) have RLS disabled. Policies and triggers are in `supabase/migrations/20260314000001_rls_triggers.sql`.

**Auto-numbering triggers**: Jobs (`JOB-YYYY-XXXX`), Invoices (`INV-YYYY-XXXX`), Quotes (`QT-YYYY-XXXX`).

**Generated columns**: Line item tables use `GENERATED ALWAYS AS (quantity * unit_price) STORED` for totals.

### Drizzle Usage

```typescript
// Database client
import { getDb } from "@hvac-saas/database";
const db = getDb();

// Typed queries
import { jobs, customers } from "@hvac-saas/database";
import { eq } from "drizzle-orm";
const result = await db.select().from(jobs).where(eq(jobs.tenantId, tenantId));

// Supabase client (auth + realtime only)
import { getSupabaseClient, getSupabaseAdmin } from "@hvac-saas/database";
const supabase = getSupabaseClient(accessToken); // tenant-scoped, respects RLS
const admin = getSupabaseAdmin();                 // service role, bypasses RLS
```

### Drizzle-kit Gotchas

- **Extensionless imports only** — `drizzle-kit` uses CJS internally. Use `"./enums"` not `"./enums.js"` in schema files.
- **dotenv required in config** — `drizzle.config.ts` loads `.env` from monorepo root via `import { config } from "dotenv"`.
- **Migrations output** — Generated into `supabase/migrations/`. Hand-written SQL (RLS, triggers) also lives there.
- All hand-written migration SQL must be idempotent (see Strict Rules above).

### Types (Inferred from Schema)

Types in `packages/types/src/` are inferred from Drizzle schema:

```typescript
import { jobs } from "@hvac-saas/database";
export type Job = typeof jobs.$inferSelect;
export type JobInsert = typeof jobs.$inferInsert;
export type JobUpdate = Partial<JobInsert>;
```

## Route Groups

### Frontend (apps/web)

- `(auth)/` — Login, signup, forgot-password
- `(dashboard)/` — Tenant pages: KPI home, jobs (Kanban), customers, invoices, quotes, bookings, schedule, settings
- `(superadmin)/` — Admin panel: dashboard, tenants, analytics, support, affiliates, system health
- `book/[slug]/` — Public customer booking portal
- `ref/[code]/` — Affiliate redirect (sets `aff_code` cookie, 30-day)

### API (apps/api)

- **Tenant routes** (Supabase JWT): `/jobs`, `/customers`, `/invoices`, `/quotes`, `/bookings`, `/catalog`, `/checklists`, `/equipment`, `/refrigerant-logs`, `/availability`, `/settings`
- **Admin routes** (Admin JWT): `/admin/auth`, `/admin/tenants`, `/admin/analytics`, `/admin/search`, `/admin/audit-log`, `/admin/system`, `/admin/affiliates`
- **Public routes** (no auth): `/public/booking`, `/webhooks/lemon-squeezy`

## Key Data Flows

**Job lifecycle**: Booking/direct → Job (scheduled) → auto-attach checklist → tech completes items → checked items with `catalog_item_id` auto-add line items → complete job → generate invoice → email → customer pays → auto review request (2h delay)

**Quote-to-job**: Create quote → add line items → PDF → email → customer accepts → "Create Job" copies line items → normal job flow

**Affiliate**: `/ref/[code]` sets cookie → signup → Lemon Squeezy checkout → webhook captures `affiliate_id` → saved to `tenants.referred_by_affiliate_id`

**Server Actions**: All frontend API calls go through `apps/web/src/actions/`. Never call the API directly from client components: `Component → Server Action → Fastify API`.

## Environment

`.env` at monorepo root with:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (bypasses RLS)
- `DATABASE_URL` — PostgreSQL connection string (Supabase pooler)
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — for `seed:admin` script

## Workflow Rules

### Planning & Execution

- **Default to plan mode** for non-trivial tasks. Read relevant code, draft a plan, get approval before writing code. Skip only for single-line fixes, typos, or tasks with explicit instructions.
- **Verify before marking done.** Run typecheck, lint, tests after implementing. Don't call a task complete until verification passes.

### Subagent Strategy

- **Offload research to subagents.** Use Explore agents for searching and context gathering. Keep the main conversation focused on decisions and code.
- **One task per agent.** Each subagent gets a single, well-scoped objective.

### Core Principles

- **Simplicity first.** Simplest approach that solves the problem. Add abstraction only for concrete, current needs.
- **No laziness.** No placeholder code, no TODO comments instead of implementing.
- **Minimal impact.** Keep changes focused. Don't refactor adjacent code or add unrelated improvements.
- **Autonomous bug fixing.** Fix small obvious bugs (< 10 lines) on sight. Log larger ones in `docs/todo.md`.
