# Todo

Task tracking for in-progress and upcoming work.

## In Progress

## Upcoming

- [ ] Customer CRUD API routes
- [ ] Job management API routes + Kanban
- [ ] Invoice generation + PDF
- [ ] Booking portal (public)
- [ ] Quote builder + convert-to-job
- [ ] Organization creation flow (post-signup onboarding)
- [ ] Settings page (profile, org management)

## Done

- [x] **Better Auth migration** — replaced Supabase Auth + bcrypt/JWT with Better Auth (unified auth system)
  - Better Auth server config with drizzle adapter, organization + admin plugins
  - Auth schema: 7 tables (user, session, account, verification, organization, member, invitation)
  - Fastify integration using auth.handler() with reconstructed Request (not toNodeHandler)
  - Auth middleware: requireAuth, requireAdmin, requireTenant preHandlers
  - Seed admin script using Better Auth signUpEmail + direct DB role update
  - Removed old admin-auth plugin, admin auth routes, @fastify/jwt, bcryptjs
  - Dropped RLS policies, switched to application-level tenant isolation via tenantFilter()
  - Added organizationId FK on tenants table linking to Better Auth organizations
- [x] **Next.js 14 + Tailwind + shadcn/ui frontend** — full foundation
  - Root layout, globals.css, Tailwind v3 + shadcn CSS variables
  - shadcn components: Button, Input, Label, Card, Separator
  - Auth pages: login, signup, forgot-password (all functional)
  - Better Auth React client (useSession, signIn, signUp, signOut)
  - Server-side auth helper (auth-server.ts)
  - Route protection middleware (session cookie check)
  - Placeholder dashboard + superadmin pages
- [x] Fastify server entry point with CORS, Swagger, health check, graceful shutdown
- [x] Environment validation with Zod (apps/api/src/lib/env.ts)
- [x] Database foundation: Drizzle ORM schema, types package, database client
- [x] Install core dependencies (drizzle-orm, postgres, better-auth, next, tailwindcss, shadcn/ui)
- [x] Connect Supabase: pushed schema (31 tables including auth tables)
- [x] Set up .env with Supabase credentials + Better Auth secret
- [x] Set up root package.json with all convenience scripts (db:*, dev:*, test:*, seed:admin)
