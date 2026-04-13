# Architecture

## Monorepo Structure

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
apps/api  -> @hvac-saas/database, @hvac-saas/types, @hvac-saas/email
apps/web  -> @hvac-saas/types, @hvac-saas/ui
packages/types -> @hvac-saas/database
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
3. `role === "admin"` -> redirect to `/superadmin/dashboard`
4. Otherwise -> redirect to `/dashboard`

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
- All hand-written migration SQL must be idempotent (see Strict Rules).

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

**Job lifecycle**: Booking/direct -> Job (scheduled) -> auto-attach checklist -> tech completes items -> checked items with `catalog_item_id` auto-add line items -> complete job -> generate invoice -> email -> customer pays -> auto review request (2h delay)

**Quote-to-job**: Create quote -> add line items -> PDF -> email -> customer accepts -> "Create Job" copies line items -> normal job flow

**Notifications**: Entity events (customer created, job updated, invoice paid, etc.) -> `dispatchNotification()` -> in-app (Supabase Realtime) + email channels -> NotificationBell UI updates in real-time

**Affiliate**: `/ref/[code]` sets cookie -> signup -> Lemon Squeezy checkout -> webhook captures `affiliate_id` -> saved to `tenants.referred_by_affiliate_id`

**Server Actions**: All frontend API calls go through `apps/web/src/actions/`. Never call the API directly from client components: `Component -> Server Action -> Fastify API`.
