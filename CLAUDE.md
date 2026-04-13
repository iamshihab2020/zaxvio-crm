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

## Knowledge Base (Obsidian MCP — `obsidian-brain`)

The project knowledge base lives in an Obsidian vault (`docs/` folder). An MCP server (`obsidian-brain`) is connected. **Use it as your first step** when you need context — it's faster and cheaper than loading entire files.

### How to use it

1. **Before planning or coding**, search the vault for relevant context:
   - Starting a feature? Search for the entity name (e.g., "bookings", "invoices")
   - Debugging? Search for the library/pattern (e.g., "Drizzle", "Better Auth")
   - Frontend work? Search for "design" or the component type
   - Check deferred fixes? Search for "deferred" + the feature name

2. **Search first, then read selectively.** Don't load entire files into context. Use vault search to find the relevant note, then read only what you need.

3. **Only fall back to `Read` tool** for files outside the vault (e.g., `docs/project_docs/`) or when Obsidian is unavailable.

### What's in the vault

| Folder | Contents |
|--------|----------|
| `rules/` | Strict rules, API rules, security rules — coding constraints |
| `reference/` | Architecture, design system, repo map (REPO_MAP_1, REPO_MAP_2) |
| `api-docs/` | Full API documentation (5 parts, by domain) |
| `lessons/` | Hard-won lessons by topic (backend, auth, frontend, bookings, security, jobs, misc) |
| `workflow/` | Workflow orchestration, planner methodology, memory system |
| `deferred-fixes/` | Known bugs deferred until features are live |
| `todo.md` | Current task tracking |

### When to search (MUST do)

- **Before implementing any feature**: search for the entity name + "deferred" to catch known bugs
- **Before planning**: search for the domain to find architecture notes, API docs, and lessons
- **After a user correction**: search for existing lessons on the topic before adding a new one
- **Before frontend work**: search "design" to find component patterns, color tokens, layout rules

### Files outside the vault (use `Read` tool)
| File | When to Read |
|------|-------------|
| `docs/project_docs/HVAC_SaaS_Phase1_PRD_v2.md` | Product requirements, business logic |
| `docs/project_docs/HVAC_SaaS_System_Diagrams_and_Unified_Auth.md` | System diagrams, auth flow |
