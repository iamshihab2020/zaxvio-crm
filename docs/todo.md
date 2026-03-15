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
  - shadcn components: Button, Input, Label, Card, Separator, Accordion, Badge
  - Auth pages: login, signup, forgot-password (all functional, using AuthShell wrapper)
  - Better Auth React client (useSession, signIn, signUp, signOut)
  - Server-side auth helper (auth-server.ts)
  - Route protection middleware (session cookie check)
  - Placeholder dashboard + superadmin pages
- [x] **Landing page** — hero, features, how-it-works, pricing, testimonials, FAQ, CTA, footer
  - Components in `src/components/landing/` (navbar, hero-section, features-section, etc.)
  - SectionReveal for IntersectionObserver scroll animations
  - Theme toggle (light/dark via next-themes)
- [x] **Back/forward navigation fix** — Next.js 14 Router Cache stale popstate
  - `staleTimes: { dynamic: 0, static: 0 }` in next.config.mjs (forward nav fix)
  - `RefreshOnNav` component with popstate listener + router.refresh() (back/forward fix)
  - Removed competing `(auth)/layout.tsx` — auth pages use `AuthShell` component directly
  - Clean route groups: `(landing)/`, `(auth)/`, `(dashboard)/`, `(superadmin)/` — no layout conflicts
- [x] Fastify server entry point with CORS, Swagger, health check, graceful shutdown
- [x] Environment validation with Zod (apps/api/src/lib/env.ts)
- [x] Database foundation: Drizzle ORM schema, types package, database client
- [x] Install core dependencies (drizzle-orm, postgres, better-auth, next, tailwindcss, shadcn/ui)
- [x] Connect Supabase: pushed schema (31 tables including auth tables)
- [x] Set up .env with Supabase credentials + Better Auth secret
- [x] Set up root package.json with all convenience scripts (db:*, dev:*, test:*, seed:admin)
