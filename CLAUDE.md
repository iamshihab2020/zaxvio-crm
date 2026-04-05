# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Reference Documents (READ BEFORE MAJOR WORK)

These docs are the source of truth. Read the relevant ones before starting any task.

| Document | Purpose | When to Read | When to Update |
|----------|---------|--------------|----------------|
| `docs/project_docs/HVAC_SaaS_Phase1_PRD_v2.md` | Product requirements, features, business logic | Before any major feature or architectural task | When features are added/changed |
| `docs/project_docs/HVAC_SaaS_System_Diagrams_and_Unified_Auth.md` | System diagrams, auth flow, data architecture | Before auth or architecture work | When architecture changes |
| `docs/project_docs/HVAC_Saas_Proposal.md` | Business proposal, market strategy, profit projections | Before business-facing decisions | When platform scope changes |
| `docs/project_docs/REPO_MAP.md` | **Single source of truth for project structure** — every file, route, component, schema, action | **READ FIRST** before planning, searching, or exploring. Faster than Glob/Grep | **UPDATE ALWAYS** when files/folders are created, renamed, moved, or deleted |
| `docs/todo.md` | Task tracking (plan, progress, done) | Before starting any task; during work to track progress | Continuously — move items to Done, add new tasks |
| `docs/lessons.md` | Non-obvious insights, patterns, mistakes | Before starting work; when hitting bugs/errors | After ANY user correction or hard-won insight |
| `docs/API_DOCUMENTATION.md` | API endpoint reference (methods, paths, request/response shapes) | When working on frontend actions, server actions, or API routes | When any API endpoint is added, modified, or removed |
| `docs/design.md` | **Frontend design system** — colors, typography, icons, animations, component library, layout patterns, conventions, performance rules | **Before any frontend work** | When design patterns, components, or conventions change |

> **Skill**: If the file `skills/consolidate-memory.md` exists locally, follow its methodology whenever consolidating session memory.

> **Skill**: Use `.claude/skills/planner.md` **PROACTIVELY** whenever the user requests feature implementation, architectural changes, or complex refactoring. Enter plan mode, follow the planner skill's format (Overview → Requirements → Architecture Changes → Phased Implementation Steps with file paths → Testing Strategy → Risks → Success Criteria), and write the plan to `docs/todo.md` before writing any code.

---

## Strict Rules (MUST FOLLOW)

1. **All migration SQL must be idempotent** — use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`. See PRD for full pattern reference.
2. **All `.md` files except `CLAUDE.md` live in `docs/`**.
3. **Component Organization**:
   - **NEVER** place components inside route/page folders (e.g., `app/(dashboard)/customers/components/` is FORBIDDEN)
   - Entity-specific components: `components/dashboard/<entity>/` (e.g., `components/dashboard/customers/`)
   - Reusable components: `components/dashboard/reusable/` (EmptyState, DeleteConfirmDialog, Pagination, TableSkeleton, StatsCards, ConfirmActionDialog)
   - Route files only in route folders: `page.tsx` and `*-page-client.tsx` — they import from `@/components/dashboard/`
   - UI primitives (shadcn): `apps/web/src/components/ui/`
4. **NEVER use `as any`, `as unknown`, `@ts-expect-error`, or `@ts-ignore`** — always fix TypeScript errors properly. Define proper types/interfaces. For untyped third-party data, assert to a specific type (`as MyType`), never `as any`. For third-party library type mismatches (e.g., React 18 vs 19 ref issues), use specific type casts like `as React.MutableRefObject<T>` or split conditional rendering paths instead of suppressing errors.
5. **Maximize shadcn/ui and reusable components** — always check `components/ui/` and `components/dashboard/reusable/` before building anything. Install missing shadcn components via `npx shadcn@latest add <component>` from `apps/web/`. Never hand-roll HTML when a shadcn equivalent exists. Never duplicate UI patterns.
6. **Keep the chatbot knowledge base up to date** — `apps/web/src/lib/chatbot/knowledge-base.ts` contains all FAQ entries. Update in the same commit when features change. Use industry-agnostic language.
7. **Never use `template.tsx` for route group layouts** — causes remount on every navigation, breaks browser history. Always use `layout.tsx`.
8. **Housekeeping on every change** — When adding, modifying, or removing anything (new routes, components, schema files, actions, API endpoints, migrations, etc.), update **all** of these in the same commit:
   - `docs/project_docs/REPO_MAP.md` — add/remove/rename file entries
   - `docs/API_DOCUMENTATION.md` — add/update/remove endpoint docs (method, path, auth, request/response shapes)
   - `apps/web/src/lib/chatbot/knowledge-base.ts` — add/edit/remove FAQ entries for affected features
   - `docs/todo.md` — mark completed items, add new tasks if needed
   - `docs/lessons.md` — add any non-obvious insights, gotchas, or corrections from the work
9. **`docs/todo.md` formatting rules** — Keep the todo file clean, concise, and current:
   - **Three sections only**: `## In Progress`, `## Backlog`, `## Completed`
   - **In Progress** — only genuinely open work with unchecked `[ ]` items. Move here when you start working on something. Never leave completed items lingering.
   - **Backlog** — planned/deferred work not yet started. Split into subsections if needed (e.g., "Deferred / Blocked", "Future Ideas").
   - **Completed** — one-line summaries with date. No verbose sub-task breakdowns — that detail lives in git history. Format: `- [x] **Feature Name** (YYYY-MM-DD) — brief description`
   - **Keep it short** — aim for <120 lines total. If the Completed section grows beyond ~50 items, archive older ones into a collapsed `<details>` block or remove them entirely.
   - **No duplicate sections** — never have two "In Progress" or two "Recently Completed" headings.
   - **Mark done immediately** — check off `[x]` items and move to Completed as soon as work is done, not in batches.
   - **Use absolute dates** — never "next Thursday" or "tomorrow". Always `YYYY-MM-DD`.
   - **No orphan checkboxes** — every `[ ]` must be under an active In Progress or Backlog item. If it's done, check it. If it's abandoned, remove it.
10. **`docs/lessons.md` MUST be updated after every session** — This is the project's institutional memory. Rules:
    - **When to add**: After ANY user correction, hard-won debugging insight, library gotcha, workaround, or non-obvious pattern discovery. If you struggled with something for more than 5 minutes, it's a lesson.
    - **When to update**: If an existing lesson is outdated or wrong (e.g., library upgraded, workaround no longer needed), update or remove it.
    - **Format**: Group by topic (existing sections or new ones). Each bullet: bold the takeaway, then explain why. Keep it specific and actionable — "don't do X because Y" not "be careful with X".
    - **Not for code patterns** — Don't log things derivable from reading the code. Log the *surprise*: the thing that wasn't obvious, that cost time, that would bite someone again.
    - **Review at session start** — Always skim `docs/lessons.md` before starting work to avoid repeating past mistakes.
    - **NEVER let it go stale** — If multiple sessions pass without a lessons update, something is wrong. Every significant piece of work teaches something.

## API Architecture Rules (MUST FOLLOW)

1. **Service layer for business logic** — Route handlers MUST be thin: validate input, call a service function, return the response. Never put SQL queries, data transformations, or business logic directly in route handlers. Service files live in `apps/api/src/services/`.
2. **Query layer separation** — Complex or reusable SQL queries MUST live in dedicated query files under `services/<domain>/queries/`. Each function accepts `(db, params)` and returns typed data. Route handlers never call `db.execute()` or `db.select()` directly.
3. **Hybrid ORM approach** — Use Drizzle query builder for simple CRUD and aggregations. Use `db.execute(sql\`...\`)` only for PostgreSQL-specific features (`generate_series`, CTEs, window functions, `CASE WHEN` bucketing). Never fight the ORM — if it takes >10 minutes to express a query in Drizzle, use raw SQL.
4. **Zod validation on query results** — All raw SQL query results MUST be validated with Zod schemas at the query function level (not in routes). Schemas live in the service's `schemas.ts` file. This catches database schema drift at runtime.
5. **Shared query functions** — If the same query is used by multiple features (e.g., dashboard and reports both need revenue totals), extract it into a shared query file. Never duplicate SQL across routes.
6. **Analytics caching** — Analytics/dashboard endpoints MUST use the `analyticsCache` from `services/analytics/cache.ts` with appropriate TTL presets (`REALTIME: 30s`, `TRENDS: 5min`, `REPORTS: 10min`). Use stale-while-revalidate for chart data.

---

## Zod Validation Rules (MUST FOLLOW)

`fastify-type-provider-zod` is configured in `apps/api/src/server.ts`. All routes MUST use it.

### 1. Every route handler requires a Zod schema

```typescript
// CORRECT — schema declared, request fields are typed and validated automatically
fastify.post("/", {
  preHandler: [requireAuth, requireTenant],
  schema: { body: createCustomerBody },
}, async (request, reply) => {
  const { firstName, lastName, email } = request.body; // fully typed, safe to use
});

// WRONG — manual cast, no runtime validation
fastify.post("/", async (request, reply) => {
  const body = request.body as Record<string, unknown>; // FORBIDDEN
  const firstName = body.firstName as string;            // FORBIDDEN
});
```

### 2. Schema file location

One schema file per domain: `apps/api/src/lib/schemas/<domain>.ts`

```
apps/api/src/lib/schemas/
  common.ts           ← idParam, paginationQuery — ALWAYS reuse these
  auth.ts             ← passwordSchema
  customers.ts        ← createCustomerBody, updateCustomerBody, customerListQuery, ...
  jobs.ts             ← createJobBody, updateJobBody, jobListQuery, ...
  invoices.ts         ← createInvoiceBody, ...
  quotes.ts           ← createQuoteBody, ...
  tags.ts             ← createTagBody, ...
  pipelines.ts        ← createPipelineBody, ...
  bookings.ts         ← createBookingBody, availabilityQuery, ...
  catalog.ts          ← createCatalogItemBody, ...
  equipment.ts        ← createEquipmentBody, ...
  checklists.ts       ← createChecklistBody, ...
  calendar-events.ts  ← createEventBody, ...
  notifications.ts    ← markReadBody, ...
  tenants.ts          ← updateTenantBody, ...
  admin.ts            ← createAdminBody, impersonateBody, ...
  public-booking.ts   ← submitBookingBody, publicSlotsQuery, ...
```

### 3. Reuse common schemas — never redefine

```typescript
import { idParam, paginationQuery } from "../lib/schemas/common.js";

// idParam = z.object({ id: z.string().uuid() })
// paginationQuery = z.object({ page: z.coerce.number()..., limit: ..., search: ... })
```

### 4. Enum schema pattern

Mirror Drizzle pgEnums as Zod enums in the schema file — never import pgEnum directly into Zod:

```typescript
// In apps/api/src/lib/schemas/jobs.ts
export const jobStatusSchema = z.enum(["scheduled", "in_progress", "completed", "cancelled"]);
export const jobPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
```

### 5. Coerce query string numbers

Query params arrive as strings — always use `z.coerce.number()`:

```typescript
export const listQuery = paginationQuery.extend({
  page: z.coerce.number().int().min(1).default(1),   // "1" → 1
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### 6. NEVER add a route without a schema

If you write a new route handler, its schema MUST be added to the domain schema file in the same commit. No exceptions.

**Service layer structure:**
```
apps/api/src/services/
  analytics/
    types.ts               # Shared param interfaces
    helpers.ts             # Parse helpers, label maps
    schemas.ts             # Zod schemas for raw SQL results
    cache.ts               # In-memory TTL cache
    queries/               # Individual query functions
      revenue.ts
      jobs.ts
      customers.ts
      quotes-invoices.ts
      bookings.ts
      dashboard-only.ts
    reports.service.ts     # Report section aggregators
    dashboard.service.ts   # Dashboard aggregator
  notifications.service.ts # Notification queries
```

---

## Security Rules (MUST FOLLOW)

1. **Tenant isolation in EVERY query**: Every `UPDATE`, `DELETE`, and `SELECT` on tenant-scoped tables MUST include `tenantId` in the WHERE clause. Never use only the record ID. Pattern: `and(eq(table.tenantId, tenantId), eq(table.id, id))`.
2. **Zod validation on ALL request inputs**: Every route handler MUST use Zod schemas for `params`, `body`, and `query` via `fastify-type-provider-zod`. Never use `as Record<string, unknown>`, `as any`, or manual type casts on request data.
3. **Never trust client-side cookies for authorization**: Role/permission checks must use server-side session verification (`getServerSession()` or `auth.api.getSession()`). Client-set cookies are for UI hints only.
4. **Rate limiting required**: All public endpoints and auth endpoints MUST have rate limits via `@fastify/rate-limit` route-level config.
5. **Sanitize LLM/AI prompt inputs**: Never interpolate raw user input into system prompts. Always sanitize (strip control chars, limit length) before inclusion.
6. **Email subject sanitization**: All email subject lines that interpolate user data MUST use `sanitizeSubject()` from `lib/email.ts` to strip `\r`, `\n`, `\t` and prevent header injection.
7. **Security headers required**: `next.config.mjs` must include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
8. **Password policy**: Minimum 12 characters, must contain uppercase + lowercase + number. Use the shared `passwordSchema` from `lib/schemas/auth.ts`.
9. **Storage path validation**: User-provided storage paths must be validated to start with `tenantId/`. Never store arbitrary paths.
10. **Swagger disabled in production**: API docs (`/docs`) must be gated behind `NODE_ENV !== "production"`.
11. **No unsafe type assertions on user input**: Never use `as string`, `as number`, `as any` on `request.body`, `request.params`, or `request.query`. Always validate with Zod first.

## Frontend Design & Performance Rules

> **Full reference**: [`docs/design.md`](docs/design.md) — color system, typography, icons, animations, component library, page layout patterns, component conventions, data fetching patterns, and performance rules.
>
> Read `docs/design.md` before any frontend work. Update it when design patterns change.

---

## Memory System

Three-tier persistent memory that complements `docs/todo.md`, `docs/lessons.md`, and auto-memory `MEMORY.md`:

| Memory File | Purpose | Lifecycle | Source |
|---|---|---|---|
| `scripts/memory/recent-memory.md` | Rolling 48hr session summaries | Overwritten each run | JSONL conversation logs |
| `scripts/memory/long-term-memory.md` | Stable facts, preferences, gotchas | Append-only | `docs/lessons.md` + session corrections |
| `scripts/memory/project-memory.md` | Active project snapshot | Overwritten each run | `docs/todo.md` + git state |

**At session start**: Read `recent-memory.md` + `project-memory.md` for context. Reference `long-term-memory.md` for architecture/library decisions.

**Authoritative sources remain**: `docs/todo.md` (tasks) and `docs/lessons.md` (lessons). Memory files are optimized read-only views.

**Consolidation**: Run `node scripts/memory/consolidate-memory.mjs` manually or via nightly scheduled task (`scripts/memory/install-memory-task.bat`). For in-session updates, use the `consolidate-memory` skill.

**Auto-memory** (`.claude/projects/.../memory/MEMORY.md`): Loaded at start of every conversation. Update the "Current State" section after completing major work, after user corrections, and after major architecture decisions.

---

## Project Overview

Multi-industry Service Management SaaS platform (initial target: solo HVAC contractors, 1–3 person teams, Texas & Florida). Multi-tenant platform ($49/mo via Lemon Squeezy) replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

**Platform vision**: Industry-agnostic — all features must work for any service business, not just HVAC.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm@10.20.0 workspaces |
| Frontend | Next.js 14 (App Router) — port 3000 |
| Backend | Fastify — port 4000 |
| Database | Supabase (PostgreSQL 15) |
| ORM | Drizzle ORM (schema-as-code, type-safe queries) |
| Auth | Better Auth (unified — email/password, organization + admin plugins) |
| Email | Resend + React Email templates (`@hvac-saas/email`) |
| Billing | Lemon Squeezy (subscriptions + affiliate program) |
| Maps | Mapbox GL JS (address autocomplete, geocoding) |
| PDF | @react-pdf/renderer (invoices, quotes) |
| Realtime | Supabase Realtime (Kanban live updates, notifications) |
| AI/Chat | Groq (llama-3.3-70b-versatile) + Vercel AI SDK v6 |
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

---

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
  email/        # @hvac-saas/email — React Email templates (E-01 through E-14)
  config/       # @hvac-saas/config — shared ESLint + TypeScript config

scripts/
  memory/       # Memory consolidation system (auto-generated .md files are gitignored)

skills/         # Claude Code skill files (methodology docs)
```

All packages use ES modules (`"type": "module"`). Path alias `@/*` maps to `./src/*` in both apps.

### Package Dependencies

```
apps/api  → @hvac-saas/database, @hvac-saas/types, @hvac-saas/email
apps/web  → @hvac-saas/types, @hvac-saas/ui
packages/types → @hvac-saas/database
```

### Multi-Tenancy

Shared-database, shared-schema. Every tenant table has a `tenant_id` column. Application-level tenant isolation via `tenantFilter()` helper in `apps/api/src/lib/db/tenant-scope.ts`. Better Auth organizations map to tenants.

### Authentication (Better Auth)

Single unified auth system via [Better Auth](https://www.better-auth.com/) with organization + admin plugins.

- **Server config**: `apps/api/src/lib/auth.ts` — Better Auth with drizzle adapter
- **Fastify mount**: `apps/api/src/server.ts` — `auth.handler()` with reconstructed Fetch Request (not toNodeHandler)
- **Middleware**: `apps/api/src/lib/auth-middleware.ts` — `requireAuth`, `requireAdmin`, `requireTenant`, `requireOrgRole()` preHandlers
- **Client**: `apps/web/src/lib/auth-client.ts` — `useSession`, `signIn`, `signUp`, `signOut`
- **Server helper**: `apps/web/src/lib/auth-server.ts` — forwards cookies for SSR session checks
- **Route protection**: `apps/web/src/middleware.ts` — checks Better Auth session cookie

Login flow:

1. `signIn.email({ email, password })` via Better Auth React client
2. Better Auth returns session token + user with `role` field
3. `role === "admin"` → redirect to `/superadmin/dashboard`
4. Otherwise → redirect to `/dashboard`

### AI Chatbot

- **Engine**: Groq `llama-3.3-70b-versatile` via Vercel AI SDK v6 `generateText()` + tool calling
- **API route**: `apps/web/src/app/api/chat/route.ts` (Next.js API route, not server action)
- **10 AI tools**: greet, answer_help, create customer/event/job/invoice/quote/catalog_item/equipment/booking
- **Knowledge base**: `apps/web/src/lib/chatbot/knowledge-base.ts` (~30 FAQ entries)
- **UI**: `apps/web/src/components/dashboard/chatbot/` — floating chat panel (z-40)
- **Key**: AI SDK v6 uses `inputSchema` (not `parameters`) and `maxOutputTokens` (not `maxTokens`)
- **Env**: `GROQ_API_KEY` in `.env`

---

## Database

### Schema (Drizzle ORM)

Schema defined in `packages/database/src/schema/` — key files:

| File | Tables |
|------|--------|
| `auth.ts` | `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` (Better Auth) |
| `enums.ts` | 12+ `pgEnum` definitions |
| `tenants.ts` | `tenants` (with `organizationId` FK to Better Auth organization) |
| `admin.ts` | `adminAuditLog`, `adminImpersonationSessions`, `platformEvents` |
| `customers.ts` | `customers` |
| `catalog.ts` | `catalogItems` |
| `equipment.ts` | `equipment`, `refrigerantLogs` |
| `maintenance.ts` | `maintenanceContracts` (service agreements) |
| `bookings.ts` | `bookings` |
| `jobs.ts` | `jobs`, `jobLineItems`, `jobPhotos` |
| `invoices.ts` | `invoices`, `invoiceLineItems`, `invoicePayments` |
| `quotes.ts` | `quotes`, `quoteLineItems` |
| `schedule.ts` | `availabilitySchedules`, `scheduleOverrides` |
| `checklists.ts` | `checklistTemplates`, `checklistItems`, `jobChecklistCompletions` |
| `pipeline-stages.ts` | `jobPipelineStages` (per-tenant Kanban pipeline stages config) |
| `customer-notes.ts` | `customerNotes` (per-customer notes with author tracking) |
| `customer-activities.ts` | `customerActivities` (activity log timeline) |
| `job-activities.ts` | `jobActivities` (job activity log timeline) |
| `quote-activities.ts` | `quoteActivities` (quote activity log timeline) |
| `tags.ts` | `tags` (tenant-level reusable tags), `customerTags` (many-to-many junction) |
| `notifications.ts` | `notifications`, `notificationReads`, `notificationChannelConfig`, `notificationDeliveries` |
| `relations.ts` | All Drizzle `relations()` for query builder joins |

**Tenant isolation**: Application-level via `tenantFilter()` helper (RLS removed).

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

// Supabase client (storage + realtime only)
import { getSupabaseAdmin } from "@hvac-saas/database";
const admin = getSupabaseAdmin();
```

### Drizzle-kit Gotchas

- **Extensionless imports only** — `drizzle-kit` uses CJS internally. Use `"./enums"` not `"./enums.js"` in schema files.
- **dotenv required in config** — `drizzle.config.ts` loads `.env` from monorepo root via `import { config } from "dotenv"`.
- **Migrations output** — Generated into `supabase/migrations/`. Hand-written SQL also lives there.
- All hand-written migration SQL must be idempotent (see Strict Rules above).

### Types (Inferred from Schema)

Types in `packages/types/src/` are inferred from Drizzle schema:

```typescript
import { jobs } from "@hvac-saas/database";
export type Job = typeof jobs.$inferSelect;
export type JobInsert = typeof jobs.$inferInsert;
export type JobUpdate = Partial<JobInsert>;
```

---

## Route Groups

### Frontend (apps/web)

- `(landing)/` — Public landing page (hero, features, pricing, FAQ, testimonials)
- `(auth)/` — Login, signup, forgot-password
- `(dashboard)/` — Tenant pages: KPI home, jobs (Kanban + table), customers, invoices, quotes, bookings, schedule, assets, service-agreements, catalog, checklists, settings (profile, business, invoices, quotes, team, notifications, scheduling)
- `(superadmin)/` — Admin panel: dashboard, tenants, analytics, support, affiliates, system health
- `book/[slug]/` — Public customer booking portal
- `ref/[code]/` — Affiliate redirect (sets `aff_code` cookie, 30-day)
- `invite/[id]/` — Team invitation acceptance page

### API (apps/api)

- **Auth routes** (Better Auth): `/api/auth/*` (sign-up, sign-in, sign-out, get-session, etc.)
- **Tenant routes** (requireAuth + requireTenant): `/jobs`, `/customers`, `/invoices`, `/quotes`, `/bookings`, `/catalog`, `/checklists`, `/pipeline-stages`, `/equipment`, `/refrigerant-logs`, `/availability`, `/settings`, `/tags`, `/notifications`, `/dashboard/stats`
- **Admin routes** (requireAdmin): `/admin/tenants`, `/admin/analytics`, `/admin/search`, `/admin/audit-log`, `/admin/system`, `/admin/affiliates`
- **Public routes** (no auth): `/public/booking`, `/webhooks/lemon-squeezy`, `/health`

---

## Key Data Flows

**Job lifecycle**: Booking/direct → Job (scheduled) → auto-attach checklist → tech completes items → checked items with `catalog_item_id` auto-add line items → complete job → generate invoice → email → customer pays → auto review request (2h delay)

**Quote-to-job**: Create quote → add line items → PDF → email → customer accepts → "Create Job" copies line items → normal job flow

**Notifications**: Entity events (customer created, job updated, invoice paid, etc.) → `dispatchNotification()` → in-app (Supabase Realtime) + email channels → NotificationBell UI updates in real-time

**Affiliate**: `/ref/[code]` sets cookie → signup → Lemon Squeezy checkout → webhook captures `affiliate_id` → saved to `tenants.referred_by_affiliate_id`

**Server Actions**: All frontend API calls go through `apps/web/src/actions/`. Never call the API directly from client components: `Component → Server Action → Fastify API`.

---

## Environment

`.env` at monorepo root with:

- `DATABASE_URL` — PostgreSQL connection string (Supabase pooler, must use `prepare: false`)
- `BETTER_AUTH_SECRET` — Secret for Better Auth session signing (min 32 chars)
- `API_BASE_URL` — API base URL (default `http://localhost:4000`)
- `FRONTEND_URL` — Frontend URL (default `http://localhost:3000`)
- `NEXT_PUBLIC_API_URL` — API URL for frontend (default `http://localhost:4000`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (for Storage + Realtime)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (for Storage + Realtime)
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` — for `seed:admin` script
- `GROQ_API_KEY` — Groq API key for AI chatbot
- `RESEND_API_KEY` — Resend API key for transactional emails

---

---

## Workflow Orchestration

### Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- One task per subagent for focused execution

### Self-Improvement Loop
- After ANY correction from the user: update `docs/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Review lessons at session start

### Verification Before Done
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"

### Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them

### Task Management

1. **Plan First**: Write plan to `docs/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `docs/todo.md`
6. **Capture Lessons**: Update `docs/lessons.md` after corrections

### Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.
- **Demand Elegance (Balanced)**: For non-trivial changes, pause and ask "is there a more elegant way?" Skip for simple, obvious fixes.
