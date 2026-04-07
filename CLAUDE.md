# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Context Files (auto-loaded by Claude Code)

@docs/claude/strict-rules.md
@docs/claude/api-rules.md
@docs/claude/security-rules.md
@docs/claude/architecture.md
@docs/claude/workflow.md
@docs/claude/memory-system.md
@docs/claude/planner.md
@docs/claude/todo.md
@docs/claude/lessons.md
@docs/claude/design.md
@docs/claude/API_DOCUMENTATION.md
@docs/claude/REPO_MAP.md

---

## Reference Documents

| Document | Purpose | When to Read |
|----------|---------|--------------|
| `docs/project_docs/HVAC_SaaS_Phase1_PRD_v2.md` | Product requirements, features, business logic | Before any major feature or architectural task |
| `docs/project_docs/HVAC_SaaS_System_Diagrams_and_Unified_Auth.md` | System diagrams, auth flow, data architecture | Before auth or architecture work |
| `docs/project_docs/HVAC_Saas_Proposal.md` | Business proposal, market strategy, profit projections | Before business-facing decisions |
| `docs/claude/REPO_MAP.md` | **Single source of truth for project structure** — check here first to locate files before using Glob/Grep. **ALWAYS update when files are created, renamed, moved, or deleted** | **READ FIRST** before planning, searching, or exploring |

## Model Rules

| Task | Model | Why |
|------|-------|-----|
| Planning, architecture, design decisions | **Opus** | Better reasoning for complex decisions |
| Coding, implementation, bug fixes | **Sonnet** | Fast, efficient for writing code |

When spawning subagents, use `model: "opus"` for planning/research agents and `model: "sonnet"` for coding agents.

> **Skill**: Use `docs/claude/planner.md` **PROACTIVELY** whenever the user requests feature implementation, architectural changes, or complex refactoring. Enter plan mode, follow the planner format, and write the plan to `docs/claude/todo.md` before writing any code.

> **Skill**: If the file `skills/consolidate-memory.md` exists locally, follow its methodology whenever consolidating session memory.

## File Access Permissions

**You have full read access to all files in this project.** You may read any file at any time without requesting permission. This includes:
- Source code files (`.ts`, `.tsx`, `.js`, `.mjs`, `.json`)
- Configuration files (`.config.ts`, `.config.js`, etc.)
- Documentation files (`.md`)
- Schema and migration files (`.sql`, `.prisma`)
- Any other project files

Use the `Read` tool liberally to understand code structure, patterns, and context. You do NOT need to ask before reading files.

---

## Project Overview

Multi-industry Service Management SaaS platform (initial target: solo HVAC contractors, 1-3 person teams). Multi-tenant platform ($49/mo via Lemon Squeezy) replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

**Platform vision**: Industry-agnostic — all features must work for any service business, not just HVAC.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Monorepo | Turborepo + pnpm@10.20.0 workspaces |
| Frontend | Next.js 14 (App Router) — port 3000 |
| Backend | Fastify — port 4000 |
| Database | Supabase (PostgreSQL 15) |
| ORM | Drizzle ORM (schema-as-code, type-safe queries) |
| Auth | Better Auth (email/password, organization + admin plugins) |
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

## Frontend Design & Performance Rules

> **Full reference**: [`docs/claude/design.md`](docs/claude/design.md) — color system, typography, icons, animations, component library, layout patterns, conventions, performance rules.
>
> Read `docs/claude/design.md` before any frontend work. Update it when design patterns change.
