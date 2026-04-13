# Lessons: Authentication (Better Auth + Next.js)

## Better Auth + Fastify Integration

- **Fastify consumes request body before toNodeHandler** — `toNodeHandler(auth)` hangs on POST requests because Fastify's body parser reads the stream before Better Auth can. Solution: use `auth.handler()` with a manually reconstructed Fetch API `Request` object that includes `JSON.stringify(request.body)`.
- **Better Auth admin plugin setRole requires auth session** — `auth.api.setRole()` returns 401 when called without a session. For seed scripts, update the `role` column directly via SQL instead.
- **Better Auth uses text IDs, not UUIDs** — All auth tables use `text` primary keys (random strings). FKs referencing auth tables must use `text` type, not `uuid`.
- **Better Auth table naming** — Tables must match exact names: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`. The `user` table name conflicts with PostgreSQL's reserved keyword — must always quote it in raw SQL (`"user"`).
- **Dedicated auth DB connection** — Better Auth should get its own `postgres()` connection with `prepare: false` (for Supabase pooler). Don't share the singleton from `getDb()` to avoid lifecycle issues.
- **Cross-origin cookies with Better Auth** — Set `trustedOrigins: [env.FRONTEND_URL]` in the Better Auth config. Fastify CORS must include `credentials: true`.
- **Better Auth `databaseHooks` does NOT support `organization`** — Only `user`, `session`, `account`, `verification` are valid keys. For org lifecycle hooks, use `organizationCreation: { afterCreate }` inside the `organization()` plugin config. The callback receives `{ organization, member, user }`.
- **Better Auth hooks swallow errors silently** — The `organizationCreation.afterCreate` hook does not surface errors. If the callback throws (e.g., DB insert fails), Better Auth catches it internally and the user proceeds as if nothing happened. Always wrap hook bodies in try-catch with explicit logging (`console.error`). Also add a frontend fallback (e.g., call an idempotent initialize endpoint) to recover from hook failures.
- **Signup MUST call setActive() + initializeTenant() before redirect** — After `organization.create()`, the session still has `activeOrganizationId: null`. If signup redirects to `/dashboard` without calling `setActive()`, the dashboard layout sees null, OrgResolver tries to fix it, but `initializeTenant()` needs an active org in the session. The correct flow is: create user → create org → `setActive(orgId)` → `initializeTenant()` → redirect. Login should also call `initializeTenant()` to auto-heal users whose tenant rows were never created.

## Auth Flow (Better Auth + Next.js)

- **Better Auth sessions start with `activeOrganizationId: null`** — After `signIn.email()`, the session has no active org. Must call `authClient.organization.list()` then `authClient.organization.setActive()` before redirecting to dashboard, otherwise the dashboard layout sees null and fails.
- **Dashboard layout can't hard-redirect on missing org** — A returning user's session may briefly have no active org. Instead of `redirect("/signup")`, render a client-side `OrgResolver` that lists orgs, sets one active, then calls `router.refresh()` to re-run the server layout.
- **Middleware must redirect logged-in users from auth pages** — Without this, logged-in users can visit `/login` or `/signup`. Check session cookie before the public-path bypass and redirect to `/dashboard`.
- **Better Auth `getInvitation` returns 403 for non-members** — Can't fetch invitation details for users who aren't org members yet. The invite acceptance page should show generic "accept/decline" without fetching details.
- **Better Auth org plugin method names differ from docs** — `createInvitation` → `inviteMember`, `memberId` → `memberIdOrEmail`, `getInvitation` takes `{ query: { id } }` not `{ invitationId }`. Always check TypeScript errors for correct parameter shapes.
- **Better Auth `invitation` table needs `createdAt`** — The Drizzle schema was missing `createdAt` on the invitation table. Better Auth requires it for the `inviteMember` endpoint. Always match the exact schema Better Auth expects.
