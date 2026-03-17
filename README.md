<p align="center">
  <img src="https://ibb.co/zHxTW4c7.png" alt="Zaxvio" width="280">
</p>

# Zaxvio CRM

HVAC Field Service Management SaaS for solo HVAC contractors (1-3 person teams). Multi-tenant platform replacing phone + paper workflows with digital scheduling, invoicing, and customer management.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Frontend | Next.js 14 (App Router) |
| Backend | Fastify |
| Database | Supabase (PostgreSQL 15) |
| ORM | Drizzle ORM |
| Auth | Better Auth (email/password, org + admin plugins) |
| Email | Resend + React Email |
| Billing | Lemon Squeezy |
| Maps | Mapbox GL JS |
| PDF | pdfkit |
| Realtime | Supabase Realtime |
| Testing | Vitest + Playwright |

## Monorepo Structure

```
apps/
  api/            # Fastify REST API (port 4000)
  web/            # Next.js 14 app (port 3000)

packages/
  database/       # @hvac-saas/database - Drizzle schema & clients
  types/          # @hvac-saas/types - TypeScript types from Drizzle
  ui/             # @hvac-saas/ui - Shared React components
  email/          # @hvac-saas/email - React Email templates
  config/         # @hvac-saas/config - Shared ESLint + TS config
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 10.20.0+
- Supabase project (or local instance)

### Setup

```bash
# Install dependencies
pnpm install

# Copy env file and fill in values
cp .env.example .env

# Push schema to database
pnpm db:push

# Seed admin user
pnpm seed:admin

# Start development
pnpm dev
```

The API runs on `http://localhost:4000` and the web app on `http://localhost:3000`.

## Commands

```bash
# Development
pnpm dev                # Start all apps
pnpm dev:api            # Fastify only
pnpm dev:web            # Next.js only

# Build & Quality
pnpm build              # Build all packages
pnpm lint               # Lint all packages
pnpm typecheck          # TypeCheck all packages
pnpm format             # Prettier format

# Database
pnpm db:generate        # Generate migrations from schema
pnpm db:push            # Push schema to DB (dev)
pnpm db:studio          # Open Drizzle Studio
pnpm db:migrate         # Run pending migrations
pnpm seed:admin         # Create admin user

# Testing
pnpm test               # Run all tests
pnpm test:unit          # API unit tests
pnpm test:integration   # API integration tests
pnpm test:e2e           # Playwright e2e tests
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler) |
| `BETTER_AUTH_SECRET` | Session signing secret (min 32 chars) |
| `API_BASE_URL` | API URL (default `http://localhost:4000`) |
| `FRONTEND_URL` | Frontend URL (default `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | API URL for frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `ADMIN_SEED_EMAIL` | Admin seed email |
| `ADMIN_SEED_PASSWORD` | Admin seed password |

## License

Proprietary - All rights reserved.
