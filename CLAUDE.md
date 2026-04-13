# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Context Files (auto-loaded every session)

### Rules
@docs/claude/rules/strict-rules.md
@docs/claude/rules/api-rules.md
@docs/claude/rules/security-rules.md

### Workflow & Planning
@docs/claude/workflow/workflow.md
@docs/claude/workflow/planner.md
@docs/claude/todo.md

---

## Project Overview

Zaxvio CRM — multi-industry Service Management SaaS (initial target: solo HVAC contractors, 1-3 person teams). Multi-tenant platform ($49/mo via Lemon Squeezy). **Platform vision**: industry-agnostic — all features must work for any service business.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14 (App Router) — port 3000 |
| Backend | Fastify — port 4000 |
| Database | Supabase (PostgreSQL 15) |
| ORM | Drizzle ORM |
| Auth | Better Auth (email/password, organization + admin plugins) |
| Realtime | Supabase Realtime |
| AI/Chat | Groq (llama-3.3-70b-versatile) + Vercel AI SDK v6 |

Multi-tenancy: shared-database, shared-schema. Every tenant table has `tenant_id`. Application-level isolation via `tenantFilter()` helper. Better Auth organizations map to tenants.

## Commands

```bash
pnpm dev                    # Start all apps (API + web)
pnpm dev:api                # Fastify only (port 4000)
pnpm dev:web                # Next.js only (port 3000)
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages
pnpm typecheck              # TypeCheck all packages
pnpm test                   # Run all tests
pnpm db:generate            # Generate SQL migrations from schema
pnpm db:push                # Push schema directly to DB (dev only)
pnpm db:migrate             # Run pending migrations
pnpm seed:admin             # Create admin user (ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD env vars)
```

## Architecture (quick reference)

```
apps/api/           Fastify REST API — routes/, lib/, services/
apps/web/           Next.js 14 — App Router, server actions in actions/
packages/database/  @hvac-saas/database — Drizzle schema, clients
packages/types/     @hvac-saas/types — inferred from Drizzle schema
packages/email/     @hvac-saas/email — React Email templates
```

**Frontend data flow**: `Component → Server Action (actions/) → Fastify API`. Never call the API directly from client components.

**API route pattern**: Route handlers are thin (validate → call service → respond). Business logic lives in `services/`. All routes use `FastifyPluginAsyncZod` with Zod schemas in `lib/schemas/<domain>.ts`.

## Model Rules

| Task | Model |
|------|-------|
| Default — planning, investigation, complex work | **Opus 4.6 (1M context)** |
| Writing code, implementation, bug fixes | **Sonnet 4.6** |

> **Skill**: Use `docs/claude/workflow/planner.md` **PROACTIVELY** for feature implementation, architectural changes, or complex refactoring. Write the plan to `docs/claude/todo.md` before writing any code.

> **Skill**: If `skills/consolidate-memory.md` exists locally, follow its methodology when consolidating session memory.

---

## On-Demand Files (read with `Read` tool when needed)

**Do not guess from memory — always read the file first.**

### Reference & Architecture
| File | When to Read |
|------|-------------|
| `docs/claude/reference/architecture.md` | Before architectural decisions, understanding data flows |
| `docs/claude/reference/design.md` | Before ANY frontend/UI work (colors, components, layouts) |
| `docs/claude/reference/REPO_MAP_1.md` | Locating files, planning features — **read first before Glob/Grep** |
| `docs/claude/reference/REPO_MAP_2.md` | Packages, DB tables, auth architecture |
| `docs/claude/workflow/memory-system.md` | When consolidating memory or managing session persistence |

### API Documentation
| File | Covers |
|------|--------|
| `docs/claude/api-docs/API_DOCUMENTATION_1.md` | Auth, tenants, dashboard, customers, tags |
| `docs/claude/api-docs/API_DOCUMENTATION_2.md` | Jobs, quotes, line items |
| `docs/claude/api-docs/API_DOCUMENTATION_3.md` | Invoices, catalog, checklists, pipelines |
| `docs/claude/api-docs/API_DOCUMENTATION_4.md` | Bookings, equipment, service agreements, conversations |
| `docs/claude/api-docs/API_DOCUMENTATION_5.md` | Reports, admin panel, enums, errors |

### Lessons Learned (read relevant file before working in that area)
| File | Topics |
|------|--------|
| `docs/claude/lessons/backend-stack.md` | Drizzle, Supabase, Fastify, Zod |
| `docs/claude/lessons/auth-flow.md` | Better Auth, sessions, org plugin |
| `docs/claude/lessons/frontend-nextjs.md` | Next.js, UI components, calendar, charts |
| `docs/claude/lessons/booking-availability.md` | Bookings, availability, public portals |
| `docs/claude/lessons/tenant-security.md` | Tenant init, security, pipelines |
| `docs/claude/lessons/jobs-customers.md` | Jobs, customers, entity conversion flows |
| `docs/claude/lessons/features-misc.md` | Equipment, uploads, conversations, bulk ops |

### Project Documents
| File | When to Read |
|------|-------------|
| `docs/claude/deferred-fixes/README.md` | **Before building any feature** — check for known deferred bugs |
| `docs/project_docs/HVAC_SaaS_Phase1_PRD_v2.md` | Product requirements, business logic |
| `docs/project_docs/HVAC_SaaS_System_Diagrams_and_Unified_Auth.md` | System diagrams, auth flow |
