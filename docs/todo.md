# Todo

Task tracking for in-progress and upcoming work.

## In Progress

## Upcoming

- [ ] Implement Fastify server entry point (apps/api/src/server.ts)
- [ ] Implement Next.js root layout + auth pages
- [ ] Seed admin user script (apps/api/src/scripts/seed-admin.ts)
- [ ] Set up middleware.ts (route protection: /superadmin/* vs /dashboard/*)
- [ ] Implement unified login flow (admin + tenant)
- [ ] Customer CRUD API routes
- [ ] Job management API routes + Kanban
- [ ] Invoice generation + PDF
- [ ] Booking portal (public)
- [ ] Quote builder + convert-to-job

## Done

- [x] Database foundation: Drizzle ORM schema (26 tables), RLS migration, types package, database client
- [x] Install core dependencies (drizzle-orm, postgres, @supabase/supabase-js, typescript, @types/node)
- [x] Update PRD and CLAUDE.md with Drizzle ORM info
- [x] Connect Supabase: pushed schema (26 tables, 13 enums, 13 triggers, 23 RLS-enabled tables)
- [x] Set up .env with Supabase credentials (URL, anon key, service role key, DATABASE_URL)
- [x] Set up root package.json with all convenience scripts (db:*, dev:*, test:*, seed:admin)
