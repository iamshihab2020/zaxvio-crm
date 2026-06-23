# PROJECT_MAP.md — Zaxvio CRM Architecture Guide

> Related: [[REPO_MAP_1]] | [[architecture]] | [[strict-rules]] | [[api-rules]] | [[API_DOCUMENTATION_1|API Docs]]

A comprehensive architecture map of the **Zaxvio CRM** monorepo — a multi-tenant, multi-industry Service Management SaaS (initial target: solo HVAC contractors). Built as a Turborepo + pnpm workspace with a Next.js 14 frontend and a Fastify backend over Supabase Postgres.

---

## 1. Technology & Dependencies

### Runtimes & Tooling
| Concern | Choice |
|---------|--------|
| Package manager | **pnpm 10.20** (workspaces) |
| Monorepo orchestrator | **Turborepo 2.8** (`turbo dev/build/lint/typecheck/test`) |
| Language | **TypeScript 5.9** (ESM, `"type": "module"` everywhere) |
| Formatting / Lint | Prettier 3, ESLint |
| Node types | `@types/node` 25 |

### Frontend (`apps/web`) — Next.js 14, port 3000
| Area | Library |
|------|---------|
| Framework | **Next.js 14.2** (App Router) + React 18.3 |
| Data layer | **TanStack Query 5** (client cache) + **Next Server Actions** |
| UI primitives | **shadcn/ui** over Radix UI, `class-variance-authority`, `tailwind-merge` |
| Styling | **Tailwind CSS 3.4** + `tailwindcss-animate` |
| Animation | **Motion 12** (Framer), custom `animate-ui` primitives |
| Icons | `lucide-react`, `@tabler/icons-react` |
| Charts | **Recharts 2**, Chart.js + `react-chartjs-2` |
| Calendar | `react-big-calendar`, `react-day-picker`, `date-fns 4` |
| Drag & drop | `@dnd-kit/*` (Kanban board) |
| AI / Chat | **Vercel AI SDK v6** (`ai`) + `@ai-sdk/groq` (llama-3.3-70b-versatile) |
| Auth client | **Better Auth** client |
| Realtime | `@supabase/supabase-js` (Realtime channels) |
| Toasts | `sonner` |

### Backend (`apps/api`) — Fastify, port 4000
| Area | Library |
|------|---------|
| Framework | **Fastify 5** (`FastifyPluginAsyncZod` route modules) |
| Validation | **Zod 4** via `fastify-type-provider-zod` |
| Auth | **Better Auth 1.5** (email/password, organization + admin plugins) |
| ORM | **Drizzle ORM 0.45** over `postgres` (postgres.js) |
| Rate limiting | `@fastify/rate-limit` |
| API docs | `@fastify/swagger` + swagger-ui (dev only, gated on `NODE_ENV`) |
| PDF | `@react-pdf/renderer` (invoice + quote PDFs) |
| Email send | **Resend 6** |
| Logging | Fastify pino + `pino-pretty` (emoji levels) |

### Shared Packages
| Package | Role |
|---------|------|
| `@hvac-saas/database` | Drizzle schema, DB client, Supabase client, migrations config |
| `@hvac-saas/types` | TS types inferred from Drizzle schema (shared web + api) |
| `@hvac-saas/email` | React Email templates + shared email components |
| `@hvac-saas/ui` | Shared UI package (placeholder/minimal) |
| `packages/config` | Shared config (placeholder) |

### Data & Infra
- **Supabase (PostgreSQL 15)** — shared-database, shared-schema multi-tenancy.
- **Drizzle Kit** — migration generation; SQL migrations in `supabase/migrations/`.
- Billing target: **Lemon Squeezy** ($49/mo) — partially deferred.

---

## 2. Directory Tree

```
zaxvio-crm/
├── CLAUDE.md                  # AI agent project instructions (only root .md allowed)
├── turbo.json                 # Turborepo task graph
├── pnpm-workspace.yaml        # workspaces: apps/*, packages/*
├── package.json               # root scripts (dev/build/db:*/seed:admin)
│
├── apps/
│   ├── api/                   # ── Fastify REST API (port 4000) ──
│   │   └── src/
│   │       ├── server.ts          # entry: plugins, auth handler, route registration
│   │       ├── lib/               # cross-cutting concerns
│   │       │   ├── auth.ts             # Better Auth instance
│   │       │   ├── auth-middleware.ts  # requireAuth / requireTenant preHandlers
│   │       │   ├── env.ts              # env validation
│   │       │   ├── db/tenant-scope.ts  # tenantFilter() isolation helper
│   │       │   ├── email.ts            # Resend wrapper + sanitizeSubject()
│   │       │   ├── sanitize.ts         # LLM/HTML input sanitization
│   │       │   ├── notifications.ts    # in-app + email dispatch
│   │       │   ├── pdf/                # invoice + quote PDF generation (.tsx)
│   │       │   ├── cron/email-cron.ts  # overdue/renewal/trial scheduled emails
│   │       │   ├── schemas/            # ← Zod schemas, ONE file per domain
│   │       │   ├── quote-to-job.ts / job-helpers.ts / timezone.ts ...
│   │       ├── routes/             # thin handlers (validate → service → respond)
│   │       │   ├── customers|jobs|invoices|quotes|catalog|bookings|...
│   │       │   ├── public/             # booking.ts, quote.ts (unauthenticated)
│   │       │   └── admin/              # super-admin: tenants, analytics, audit, system
│   │       ├── services/           # business logic
│   │       │   ├── analytics/          # dashboard + reports + queries/ + cache.ts
│   │       │   ├── conversations.service.ts
│   │       │   └── notifications.service.ts
│   │       └── scripts/seed-admin.ts
│   │
│   └── web/                   # ── Next.js 14 App Router (port 3000) ──
│       ├── next.config.mjs        # security headers
│       └── src/
│           ├── app/               # routes (route groups)
│           │   ├── (landing)/          # marketing home
│           │   ├── (auth)/             # login, signup, invite, forgot-password
│           │   ├── (blog)/             # blog listing + posts
│           │   ├── (dashboard)/        # the CRM app (customers, jobs, invoices…)
│           │   ├── (superadmin)/       # platform admin console
│           │   ├── book/[slug]/        # PUBLIC booking portal
│           │   ├── quote/[token]/      # PUBLIC quote acceptance portal
│           │   └── api/chat/route.ts   # AI chatbot streaming endpoint
│           ├── actions/           # Server Actions (the ONLY caller of the API)
│           ├── components/
│           │   ├── ui/                 # shadcn primitives
│           │   ├── dashboard/          # entity-scoped (customers/, jobs/, …) + reusable/
│           │   ├── reusable/           # cross-cutting (bulk bars, pagination, empty state)
│           │   ├── booking-portal/ quote-portal/ landing/ superadmin/ animate-ui/
│           ├── hooks/
│           │   └── queries/            # TanStack Query hooks, one file per domain
│           └── lib/
│               ├── auth-client.ts / auth-server.ts
│               ├── query-keys.ts       # centralized query keys
│               ├── chatbot/            # AI tools, engine, knowledge-base, action-executor
│               ├── constants/ format.ts storage-url.ts supabase-client.ts
│
├── packages/
│   ├── database/src/
│   │   ├── client.ts          # Drizzle + postgres.js client
│   │   ├── supabase.ts        # Supabase service client
│   │   ├── schema/            # 30+ Drizzle table modules + enums + relations
│   │   └── drizzle.config.ts
│   ├── types/src/             # inferred domain types (customer, job, invoice…)
│   ├── email/src/
│   │   ├── components/        # brand-button, email-layout, data-table…
│   │   └── templates/         # e01–e13 + team-invitation (React Email)
│   ├── ui/  config/           # shared (minimal)
│
├── supabase/migrations/       # ordered SQL migrations (idempotent)
├── docs/                      # Obsidian vault: rules, lessons, api-docs, REPO_MAP…
└── scripts/memory/            # agent memory store
```

---

## 3. Core Components

### Backend route modules (registered in `server.ts`)
All mounted under a prefix; each is a `FastifyPluginAsyncZod` module. Auth via `requireAuth` + `requireTenant` preHandlers.

| Prefix | Module | Responsibility |
|--------|--------|----------------|
| `/tenants` | tenants/ | tenant init, settings, slug, logo, impersonation |
| `/customers` | customers/ | customer CRUD, notes, activities, tags |
| `/jobs` | jobs/ | Kanban jobs, line items, checklists, photos, assignees |
| `/pipelines`, `/pipeline-stages` | multi-pipeline + custom stages |
| `/invoices`, `/quotes` | invoices/, quotes/ | billing docs, PDF, payments, send/accept |
| `/catalog`, `/tags`, `/checklists` | reference data |
| `/bookings`, `/availability`, `/calendar-events` | scheduling |
| `/equipment`, `/maintenance-contracts` | assets + service agreements |
| `/dashboard`, `/reports` | analytics (cached) |
| `/conversations`, `/notifications` | messaging + alerts |
| `/admin/*` | super-admin: tenants, analytics, audit, search, system, impersonation |
| `/public/booking`, `/public/quote` | **unauthenticated**, rate-limited public flows |
| `/api/auth/*` | Better Auth handler (custom Fetch bridge) |

**Service layer** (`services/`): business logic lives here, never in routes. Analytics is the richest — `dashboard.service.ts` + `reports.service.ts` aggregate over `queries/*` (revenue, jobs, customers, quotes-invoices, bookings), validated with Zod (`schemas.ts`) and served through an in-memory TTL `cache.ts` (REALTIME 30s / TRENDS 5m / REPORTS 10m).

### Frontend page structure
Each list/detail page follows: `page.tsx` (server, prefetch) → `*-page-client.tsx` (client, hooks) → entity components. Route groups separate concerns:
- **(dashboard)** — full CRM: customers, jobs (Kanban + table), invoices, quotes, catalog, bookings, schedule, assets, service-agreements, checklists, conversations, reports, notifications, and a multi-page **settings/** area.
- **(superadmin)** — tenant management, analytics, support, system health, admins, affiliates, impersonation.
- **book/[slug]** and **quote/[token]** — public portals with their own component sets.

### Shared database schema (`packages/database/src/schema/`)
30+ table modules — `tenants`, `customers`, `jobs`, `invoices`, `quotes`, `bookings`, `catalog`, `equipment`, `maintenance`, `pipelines`, `pipeline-stages`, `checklists`, `conversations`, `notifications`, `subscriptions`, `calendar-events`, `schedule`, plus `auth`/`users`/`admin` and activity tables — wired together in `relations.ts` and `enums.ts`. **Every tenant table carries `tenant_id`.**

---

## 4. Data & File Flow

### The golden rule of data flow
```
Client Component
   └─(calls)→ Server Action  (apps/web/src/actions/*.ts)
                  └─(fetch)→ Fastify API  (apps/api/src/routes/*)
                                 └─(validate Zod)→ Service (services/*)
                                        └─(Drizzle + tenantFilter)→ Supabase Postgres
```
**Client components never call the Fastify API directly.** TanStack Query hooks (`hooks/queries/*`) wrap server actions for caching, optimistic updates, and invalidation. Query keys are centralized in `lib/query-keys.ts`. (Per project rules: server actions are passed to `mutationFn` only via arrow wrappers to preserve serialization.)

### Authentication flow
```
Better Auth client (web) ──→ /api/auth/* (Fastify custom handler) ──→ Better Auth (lib/auth.ts)
                                                                          └─→ session + organization (= tenant)
```
- Better Auth **organizations map to tenants**. Session is verified server-side (`auth-server.ts` on web, `auth-middleware.ts` on api).
- `requireTenant` resolves the active tenant; **`tenantFilter()`** (`lib/db/tenant-scope.ts`) injects `tenant_id` into every tenant-scoped query — the application-level isolation boundary (shared DB, shared schema).

### Multi-tenancy & security boundaries
- Every `SELECT/UPDATE/DELETE` on tenant tables must filter by `tenantId` (not just record id).
- Public endpoints (`/public/*`) and auth endpoints are rate-limited; strict auth paths (sign-in/up, password reset) get tighter caps.
- Security headers set in `next.config.mjs`; Swagger disabled in production; LLM prompts and email subjects sanitized.

### Async / background flows
- **Realtime:** Supabase Realtime channels drive in-app notifications and the conversations thread (`use-conversation-realtime.ts`, `use-desktop-notifications.ts`).
- **Cron emails:** `lib/cron/email-cron.ts` sends overdue invoice, contract renewal, and trial-expiring emails using `@hvac-saas/email` templates via Resend.
- **AI chatbot:** Web `app/api/chat/route.ts` streams from Groq via Vercel AI SDK; `lib/chatbot/ai-tools.ts` + `action-executor.ts` let the assistant create customers, jobs, invoices, quotes, etc., through the same server actions. Knowledge base in `lib/chatbot/knowledge-base.ts`.
- **PDFs:** Generated server-side in `apps/api/src/lib/pdf/` (`@react-pdf/renderer`) for invoices and quotes.

### Conversion flows (cross-entity)
- **Booking → Customer → Job:** public booking submit → links/creates customer → atomic conversion to a job (`SELECT FOR UPDATE` row lock).
- **Quote → Job:** `lib/quote-to-job.ts` converts an accepted quote into a job.
- **Job → Invoice:** invoices generated from completed jobs (with line items and photos).

---

## 5. Feature Status — Gaps & Stubs

Verified against source (routes, schema enums, pages), not docs. Most features are fully wired; the items below are **partially built, schema-only, or placeholders**.

### Not yet functional (deferred)
| Feature | Evidence in code | State |
|---------|------------------|-------|
| **Billing / Subscriptions** | `subscription_status` enum + `subscriptions` table exist; **no Lemon Squeezy webhook routes**; `settings/billing/` is a `.gitkeep` stub | Schema-only — payment provider not integrated |
| **Affiliate Program** | Superadmin `affiliates/` page + `referral_source` enum + `app/ref/[code]/` route stub (`.gitkeep`) | Placeholder UI — no referral tracking logic; needs Lemon Squeezy |
| **SMS Conversations** | `conversation_channel` enum includes SMS; `message_direction`/`message_status` support it | Schema supports it; UI shows "Coming Soon" — only email is functional |

### Stub / placeholder files & paths
- `apps/web/src/app/(dashboard)/settings/billing/.gitkeep` — billing settings page not implemented.
- `apps/web/src/app/ref/[code]/.gitkeep` — affiliate referral landing route not implemented.
- `apps/web/src/app/api/webhooks/.gitkeep` + `apps/api/src/routes/webhooks/.gitkeep` — webhook handlers (e.g. Lemon Squeezy) not implemented.
- `apps/web/src/components/under-development.tsx` — generic "under development" placeholder component.
- Empty test scaffolding: `apps/api/tests/unit/.gitkeep`, `apps/api/tests/integration/.gitkeep` — no API tests yet.

### Deferred email templates
- `e01-welcome` (needs org-creation refactor) and `e11-welcome-paid` (needs Lemon Squeezy webhook) exist as templates but are **not yet triggered** in code.

### Manual setup steps still required
- Supabase Storage buckets are referenced in code but must be created manually: **`quotes`** (public quote PDFs) and **`job-attachments`** (job photos/documents).

> Net: the CRM core (customers → bookings → jobs → quotes/invoices → payments-as-records, scheduling, equipment/maintenance, conversations, AI assistant, analytics, super-admin) is functional. The main unfinished pieces are **external-integration dependent**: billing (Lemon Squeezy), affiliates, SMS sending, and the two welcome emails gated on those.

---

## Build & Run Quick Reference
```bash
pnpm dev          # all apps (turbo --parallel)
pnpm dev:api      # Fastify only (4000)
pnpm dev:web      # Next.js only (3000)
pnpm db:generate  # Drizzle: generate SQL migration from schema
pnpm db:migrate   # apply migrations
pnpm seed:admin   # create super-admin user
```

---

*Generated 2026-06-23. For finer-grained file-by-file detail see `docs/project_docs/REPO_MAP.md` and `docs/claude/api-docs/`.*
