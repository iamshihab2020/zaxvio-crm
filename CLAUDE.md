# [CLAUDE.md](http://CLAUDE.md)

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
6. **Component Organization (STRICTLY FOLLOW)**:
  - **NEVER** place components inside route/page folders (e.g., `app/(dashboard)/customers/components/` is FORBIDDEN).
  - All dashboard-related components live under `apps/web/src/components/dashboard/`.
  - **Entity-specific components**: Create a subfolder per entity — e.g., `components/dashboard/customers/` for customer page components (`customer-table.tsx`, `customer-dialog.tsx`, etc.).
  - **Reusable components**: If a component can be shared across multiple entities (pagination, empty states, delete dialogs, table skeletons), place it in `components/dashboard/reusable/` (create the folder if it doesn't exist).
  - **Route files only** in route folders: Only `page.tsx` and `*-page-client.tsx` stay in `app/(dashboard)/<entity>/`. They import components from `@/components/dashboard/`.
  - **UI primitives** (shadcn) stay in `apps/web/src/components/ui/`.

7. **Read memory files at session start** — `scripts/memory/recent-memory.md` + `scripts/memory/project-memory.md` for recent context; reference `scripts/memory/long-term-memory.md` for architecture/library decisions.

> **Skill**: If the file `skills/consolidate-memory.md` exists locally, follow its methodology whenever consolidating session memory.

---

## Memory System

Three-tier persistent memory that complements `docs/todo.md`, `docs/lessons.md`, and `MEMORY.md`:

| Memory File | Purpose | Lifecycle | Source |
|---|---|---|---|
| `scripts/memory/recent-memory.md` | Rolling 48hr session summaries | Overwritten each run | JSONL conversation logs |
| `scripts/memory/long-term-memory.md` | Stable facts, preferences, gotchas | Append-only | `docs/lessons.md` + session corrections |
| `scripts/memory/project-memory.md` | Active project snapshot | Overwritten each run | `docs/todo.md` + git state |

**At session start**: Read `recent-memory.md` + `project-memory.md` for context. Reference `long-term-memory.md` for architecture/library decisions.

**Authoritative sources remain**: `docs/todo.md` (tasks) and `docs/lessons.md` (lessons). Memory files are optimized read-only views.

**Consolidation**: Run `node scripts/memory/consolidate-memory.mjs` manually or via nightly scheduled task (`scripts/memory/install-memory-task.bat`). For in-session updates, use the `consolidate-memory` skill.

---

## Project Overview

HVAC Field Service Management SaaS for solo HVAC contractors (1–3 person teams) in Texas & Florida. Multi-tenant platform ($49/mo via Lemon Squeezy) replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

## Tech Stack


| Layer    | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Monorepo | Turborepo + [pnpm@10.20.0](mailto:pnpm@10.20.0) workspaces           |
| Frontend | Next.js 14 (App Router) — port 3000                                  |
| Backend  | Fastify — port 4000                                                  |
| Database | Supabase (PostgreSQL 15)                                             |
| ORM      | Drizzle ORM (schema-as-code, type-safe queries)                      |
| Auth     | Better Auth (unified — email/password, organization + admin plugins) |
| Email    | Resend + React Email templates                                       |
| Billing  | Lemon Squeezy (subscriptions + affiliate program)                    |
| Maps     | Mapbox GL JS (address autocomplete, geocoding)                       |
| PDF      | pdfkit (invoices, quotes)                                            |
| Realtime | Supabase Realtime (Kanban live updates)                              |
| Testing  | Vitest (unit/integration), Playwright (e2e)                          |


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

scripts/
  memory/       # Memory consolidation system (auto-generated .md files are gitignored)

skills/         # Claude Code skill files (methodology docs)
```

All packages use ES modules (`"type": "module"`). Path alias `@/*` maps to `./src/*` in both apps.

### Package Dependencies

```
apps/api  → @hvac-saas/database, @hvac-saas/types
apps/web  → @hvac-saas/types, @hvac-saas/ui
packages/types → @hvac-saas/database
```

### Multi-Tenancy

Shared-database, shared-schema. Every tenant table has a `tenant_id` column. Application-level tenant isolation via `tenantFilter()` helper in `apps/api/src/lib/db/tenant-scope.ts`. Better Auth organizations map to tenants.

### Authentication (Better Auth)

Single unified auth system via [Better Auth](https://www.better-auth.com/) with organization + admin plugins.

- **Server config**: `apps/api/src/lib/auth.ts` — Better Auth with drizzle adapter
- **Fastify mount**: `apps/api/src/server.ts` — `auth.handler()` with reconstructed Fetch Request (not toNodeHandler)
- **Middleware**: `apps/api/src/lib/auth-middleware.ts` — `requireAuth`, `requireAdmin`, `requireTenant` preHandlers
- **Client**: `apps/web/src/lib/auth-client.ts` — `useSession`, `signIn`, `signUp`, `signOut`
- **Server helper**: `apps/web/src/lib/auth-server.ts` — forwards cookies for SSR session checks
- **Route protection**: `apps/web/src/middleware.ts` — checks Better Auth session cookie

Login flow:

1. `signIn.email({ email, password })` via Better Auth React client
2. Better Auth returns session token + user with `role` field
3. `role === "admin"` → redirect to `/superadmin/dashboard`
4. Otherwise → redirect to `/dashboard`

## Database

### Schema (Drizzle ORM)

Schema defined in `packages/database/src/schema/` (19 files, 33 tables):


| File               | Tables                                                                                             |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| `auth.ts`          | `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation` (Better Auth) |
| `enums.ts`         | 12 `pgEnum` definitions                                                                            |
| `tenants.ts`       | `tenants` (with `organizationId` FK to Better Auth organization)                                   |
| `admin.ts`         | `adminAuditLog`, `adminImpersonationSessions`, `platformEvents`                                    |
| `users.ts`         | (empty — replaced by Better Auth `user` + `member`)                                                |
| `subscriptions.ts` | `tenantSubscriptions`                                                                              |
| `customers.ts`     | `customers`                                                                                        |
| `catalog.ts`       | `catalogItems`                                                                                     |
| `equipment.ts`     | `equipment`, `refrigerantLogs`                                                                     |
| `maintenance.ts`   | `maintenanceContracts`                                                                             |
| `bookings.ts`      | `bookings`                                                                                         |
| `jobs.ts`          | `jobs`, `jobLineItems`, `jobPhotos`                                                                |
| `invoices.ts`      | `invoices`, `invoiceLineItems`, `invoicePayments`                                                  |
| `quotes.ts`        | `quotes`, `quoteLineItems`                                                                         |
| `schedule.ts`      | `availabilitySchedules`, `scheduleOverrides`                                                       |
| `checklists.ts`    | `checklistTemplates`, `checklistItems`, `jobChecklistCompletions`                                  |
| `pipeline-stages.ts` | `jobPipelineStages` (per-tenant Kanban pipeline stages config)                                   |
| `customer-notes.ts`| `customerNotes` (per-customer notes with author tracking)                                          |
| `customer-activities.ts` | `customerActivities` (activity log timeline)                                                 |
| `job-activities.ts`      | `jobActivities` (job activity log timeline)                                                   |
| `quote-activities.ts`    | `quoteActivities` (quote activity log timeline)                                               |
| `tags.ts`          | `tags` (tenant-level reusable tags), `customerTags` (many-to-many junction)                        |
| `relations.ts`     | All Drizzle `relations()` for query builder joins                                                  |
| `index.ts`         | Barrel re-export                                                                                   |


**Tenant isolation**: Application-level via `tenantFilter()` helper (RLS removed). Triggers in `supabase/migrations/20260315000002_triggers.sql`.

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
const admin = getSupabaseAdmin();                 // service role, for Storage + Realtime
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

- `(landing)/` — Public landing page (hero, features, pricing, FAQ, testimonials)
- `(auth)/` — Login, signup, forgot-password
- `(dashboard)/` — Tenant pages: KPI home, jobs (Kanban), customers, invoices, quotes, bookings, schedule, settings
- `(superadmin)/` — Admin panel: dashboard, tenants, analytics, support, affiliates, system health
- `book/[slug]/` — Public customer booking portal
- `ref/[code]/` — Affiliate redirect (sets `aff_code` cookie, 30-day)

### API (apps/api)

- **Auth routes** (Better Auth): `/api/auth/`* (sign-up, sign-in, sign-out, get-session, etc.)
- **Tenant routes** (requireAuth + requireTenant): `/jobs`, `/customers`, `/invoices`, `/quotes`, `/bookings`, `/catalog`, `/checklists`, `/pipeline-stages`, `/equipment`, `/refrigerant-logs`, `/availability`, `/settings`
- **Admin routes** (requireAdmin): `/admin/tenants`, `/admin/analytics`, `/admin/search`, `/admin/audit-log`, `/admin/system`, `/admin/affiliates`
- **Public routes** (no auth): `/public/booking`, `/webhooks/lemon-squeezy`, `/health`

## Key Data Flows

**Job lifecycle**: Booking/direct → Job (scheduled) → auto-attach checklist → tech completes items → checked items with `catalog_item_id` auto-add line items → complete job → generate invoice → email → customer pays → auto review request (2h delay)

**Quote-to-job**: Create quote → add line items → PDF → email → customer accepts → "Create Job" copies line items → normal job flow

**Affiliate**: `/ref/[code]` sets cookie → signup → Lemon Squeezy checkout → webhook captures `affiliate_id` → saved to `tenants.referred_by_affiliate_id`

**Server Actions**: All frontend API calls go through `apps/web/src/actions/`. Never call the API directly from client components: `Component → Server Action → Fastify API`.

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

## Frontend Design System

- **No hardcoded colors**: NEVER use raw hex/rgb/hsl values in components. ALL colors must come from CSS variables defined in `globals.css` and referenced via Tailwind tokens (e.g., `bg-brand`, `text-ink`, `bg-surface`).
- **Icon library**: Tabler Icons (`@tabler/icons-react`). NEVER use lucide-react. Always import icons individually (`import { IconName } from "@tabler/icons-react"`), never wildcard.
- **Fonts**: Space Grotesk (headings, `font-heading`), DM Sans (body, `font-body`). NEVER use Inter, Roboto, Arial, or system defaults.
- **Color system**: Brand orange for CTAs/accents, midnight navy for dark sections, warm off-white (`surface`) for body. Use CSS variables (`--brand`, `--surface`, `--ink`, `--midnight`).
- **Component library**: shadcn/ui pattern (Radix primitives + CVA + tailwind-merge). Components live in `apps/web/src/components/ui/`.
- **Animations**: CSS-only (no framer-motion). Use `IntersectionObserver` for scroll reveals via `SectionReveal` component.
- **Landing page components**: Co-located in `apps/web/src/app/(landing)/_components/`.
- **No generic AI aesthetics**: No purple gradients on white, no cookie-cutter layouts. Every page should have intentional design direction ("Industrial Warmth" / "Desert Heat" palette).
- **Semantic HTML**: Use `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<article>`, `<blockquote>`, `<dl>` etc. for SEO. All sections must have `aria-labelledby` pointing to their heading.
- **Never use `template.tsx` for route group layouts**: In Next.js App Router, `template.tsx` remounts on every navigation, destroying browser history state and breaking back/forward navigation. Always use `layout.tsx` for route group layouts (`(auth)`, `(landing)`, `(dashboard)`, etc.). Only use `template.tsx` for rare cases like per-page entry animations where you intentionally want state reset.

### Color System & Tokens

All colors defined as CSS variables in `apps/web/src/app/globals.css`, mapped to Tailwind tokens.

**Brand palette:**
- `--brand` (24 95% 53%) → `bg-brand`, `text-brand`, `border-brand`
- `--brand-light` → `bg-brand-light` (subtle backgrounds, hover states)
- `--brand-foreground` → `text-brand-foreground` (text on brand backgrounds)

**Semantic tokens (light/dark auto-switch):**
- `--background` / `--foreground` — page background & primary text
- `--card` / `--card-foreground` — card surfaces & card text
- `--muted` / `--muted-foreground` — subdued backgrounds & secondary text
- `--accent` / `--accent-foreground` — hover highlights
- `--destructive` / `--destructive-foreground` — error/delete states
- `--border`, `--input`, `--ring` — borders, inputs, focus rings

**Custom tokens:**
- `--midnight` → `bg-midnight` (dark navy sections, landing page)
- `--surface` → `bg-surface` (warm off-white body background)
- `--surface-alt` → `bg-surface-alt` (alternate surface shade)
- `--ink` → `text-ink` (primary text on light backgrounds)

**Dark mode:** Class-based via `next-themes` (`.dark` on `<html>`). All tokens have dark overrides in `globals.css`. Always use Tailwind tokens (`bg-brand`, `text-foreground`, `border-border`), never raw HSL/hex.

### Page Layout Patterns

Four standard dashboard page layouts:

**1. List pages** (customers, invoices):
```
<section className="p-6">
  header row: mb-6 flex items-center justify-between
  card wrapper: rounded-lg border border-border bg-card overflow-hidden
    search/filters: border-b border-border px-4 py-3
    table: flush inside card (no extra padding)
  pagination: outside card, below
</section>
```

**2. Detail pages** (customer/[id], invoice/[id], job/[id]):
```
flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface
  header bar
  flex flex-col lg:flex-row gap-4
    left panel: w-full lg:w-80 shrink-0
    center tabs: flex-1 min-w-0
    right sidebar: hidden xl:block w-72 shrink-0
  all panels: rounded-lg border border-border bg-card shadow-sm
```

**3. Settings pages** (business, profile, invoices):
```
grid grid-cols-1 gap-6 lg:grid-cols-3
  form: lg:col-span-2
  sidebar: lg:col-span-1
```

**4. Kanban/dual-view** (jobs): View toggle + board (`flex gap-4 overflow-x-auto`) or table (same card wrapper as list pages).

### Component Conventions

- **Tables**: Always use shadcn `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`. Never raw `<table>`. Wrap in card container (list page pattern).
- **Buttons**: Always `<Button>` from shadcn. CTA: `className="bg-brand text-brand-foreground hover:bg-brand/90"`. Ghost for icon buttons: `variant="ghost" size="icon"`. Never raw `<button>`.
- **Badges**: `<Badge>` with variants (default, secondary, destructive, outline, brand). Status badges use mapped color configs with `dark:` variants. Pattern: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium`.
- **Dialogs**: Center modal (`<Dialog>`) for confirmations/forms (`sm:max-w-md`). Side drawer (`<Sheet side="right">`) for detail views (`sm:max-w-lg`).
- **Filters**: `<Popover>` with button-based options for simple filters. `<Command>` inside `<Popover>` for searchable filters. Active state: `border-brand/40 bg-brand-light/20 text-brand`.
- **Forms**: Grid layout `grid grid-cols-1 gap-4 sm:grid-cols-2`. Label+input wrapper: `space-y-2`. Settings forms use `<SettingsSection>` wrapper.
- **Row actions**: `<DropdownMenu>` with `<Button variant="ghost" size="icon" className="h-8 w-8">` trigger. Stop propagation on trigger click.
- **Delete confirm**: `<DeleteConfirmDialog>` from `components/dashboard/reusable/`. Props: `entityName`, `itemLabel`, `open`, `onOpenChange`, `onConfirm`, `loading`.
- **Empty states**: `<EmptyState>` from `components/dashboard/reusable/`. Props: `icon`, `title`, `description`, `actionLabel`, `onAction`.
- **Loading states**: Always skeleton loaders, never spinners. `<TableSkeleton columns={N} rows={N}>` for tables, custom `<Skeleton>` layouts for other content.
- **Pagination**: `<Pagination>` from `components/dashboard/reusable/`. Rendered outside the card wrapper.
- **Icons**: Tabler Icons only. Sizes: `h-3.5 w-3.5` (section labels), `h-4 w-4` (inline/buttons), `h-5 w-5` (section icons), `h-8 w-8` (empty state/avatar). Colors: `text-brand` (accents), `text-muted-foreground` (context).

### Settings Components

- **`SettingsSection`** — `components/dashboard/settings/settings-section.tsx`. Card with icon (`h-5 w-5 text-brand`) + title (`font-heading text-base font-semibold`) + optional description + optional action. Replaces hand-rolled Card+CardHeader+CardTitle+CardContent.
- **`SettingsFormMessage`** — `components/dashboard/settings/settings-form-message.tsx`. Success (green) / error (destructive) inline message with icon. Has dark mode variants.
- **`SettingsPageHeader`** — `components/dashboard/settings/settings-page-header.tsx`. Description + action button row for list pages (Catalog, Checklists).

### Dark Mode Rules

- Strategy: class-based via `next-themes`, `attribute="class"`, `defaultTheme="system"`
- All status/badge colors MUST have `dark:` variants (e.g., `bg-blue-50 dark:bg-blue-950/40`, `text-blue-700 dark:text-blue-300`)
- Card backgrounds auto-adapt via `bg-card` CSS variable
- Invoice/PDF preview paper stays `bg-white dark:bg-white` (document preview, not UI element)
- Sidebar detail sections use `bg-muted/50` for content boxes (adapts automatically)
- Never hardcode `gray-xxx` — always use `text-muted-foreground`, `bg-muted`, `border-border`
- Sidebar summary cards (settings) use default `<Card>`, no special backgrounds

### Stage Color Presets

Reference: `apps/web/src/lib/constants/stage-color-presets.ts`. Eight presets: blue, brand, green, red, purple, amber, gray, teal. Each provides: dot, bg, text, border, borderTop, ring classes with dark mode variants. Helper: `getStageColors(colorKey)` returns the preset or gray fallback.

### Typography Conventions

- **Headings**: `font-heading` (Space Grotesk) — page titles, card titles, section headers, accordion triggers
- **Body**: `font-body` (DM Sans) — paragraphs, labels, table cells, filter text, badge text, help text
- **Page title**: `font-heading text-2xl font-bold text-foreground`
- **Subtitle**: `mt-1 text-sm text-muted-foreground font-body`
- **Section header (sidebar)**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading`
- **Table header**: `font-body` (via TableHead default)

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `docs/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

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

