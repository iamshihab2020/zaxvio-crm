# Lessons Learned

Non-obvious insights, patterns, and mistakes worth remembering.

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

## Drizzle ORM

- **Scaffold packages need placeholder `.ts` files** — TypeScript errors with `TS18003` if a `tsconfig.json` includes a dir with no `.ts` files. Add empty `export {};` index files to empty packages.
- **Root-level `typescript` and `@types/node` are required** — pnpm monorepo scaffold didn't include these as devDeps. Without them, `tsc` command not found and `process` is undefined.
- **Drizzle `generatedAlwaysAs` for computed columns** — use `sql` template tag for `GENERATED ALWAYS AS (quantity * unit_price) STORED` columns.
- **Drizzle-kit uses CJS internally** — schema imports must use extensionless paths (`"./enums"` not `"./enums.js"`), otherwise drizzle-kit push/generate fails with `Cannot find module './enums.js'`.
- **drizzle-kit push crashes on GENERATED ALWAYS AS columns** — When the DB already has tables with computed columns, `drizzle-kit push` hits `TypeError: Cannot read properties of undefined (reading 'replace')`. Workaround: drop and recreate the schema.
- **drizzle-orm version conflicts in pnpm** — When importing `eq` from `drizzle-orm` in a package that depends on another package also using `drizzle-orm`, pnpm may resolve two different copies (e.g., one with `kysely` peer, one without). This causes type errors like "Types have separate declarations of a private property 'shouldInlineParams'". Solution: re-export operators (`eq`, `and`, etc.) from `@hvac-saas/database` so all consumers use the same copy. For queries in Better Auth hooks, use `getDb()` from the database package instead of the local `authDb` instance.
- **drizzle.config.ts needs dotenv** — `process.env.DATABASE_URL` is undefined without explicitly loading `.env`. Use `import { config } from "dotenv"` with `path: "../../.env"` to load from monorepo root.
- **FK name auto-truncation** — Postgres truncates identifiers over 63 chars. Long FK names get truncated. Harmless but produces a NOTICE.

## Supabase

- **Supabase pooler URL matters** — `aws-0` vs `aws-1` in the pooler hostname causes "Tenant or user not found" errors. Always copy the exact URL from the Supabase dashboard.
- **Password URL-encoding for DATABASE_URL** — special chars in DB passwords (`!`, `&`, `@`) must be percent-encoded (`%21`, `%26`, `%40`) in connection strings.
- **`prepare: false` is required for Supabase transaction pooler** — postgres.js uses prepared statements by default, which don't work with PgBouncer transaction mode. Always set `prepare: false`.

## Fastify

- **Fastify namespaced JWT type augmentation** — `@fastify/jwt` with `namespace: "admin"` creates `request.adminJwtVerify()` and `reply.adminJwtSign()`, but TypeScript doesn't auto-infer these. Must manually augment `FastifyRequest` and `FastifyReply` with the namespaced methods.
- **Fastify response schema constrains status codes** — If you define `response: { 200: {...} }` in route schema, Fastify's type system only allows `.status(200)`. Must also define `400` and `401` response schemas to use those status codes without type errors.
- **`decorateRequest` with null fails in strict mode** — Use `undefined as unknown as T` instead of `null` when decorating a request property with a typed value in Fastify.
- **`import.meta.dirname` for dotenv** — Node 21+ supports `import.meta.dirname` (ESM equivalent of `__dirname`). Avoids the `fileURLToPath(import.meta.url)` + `dirname()` boilerplate.

## Auth Flow (Better Auth + Next.js)

- **Better Auth sessions start with `activeOrganizationId: null`** — After `signIn.email()`, the session has no active org. Must call `authClient.organization.list()` then `authClient.organization.setActive()` before redirecting to dashboard, otherwise the dashboard layout sees null and fails.
- **Dashboard layout can't hard-redirect on missing org** — A returning user's session may briefly have no active org. Instead of `redirect("/signup")`, render a client-side `OrgResolver` that lists orgs, sets one active, then calls `router.refresh()` to re-run the server layout.
- **Middleware must redirect logged-in users from auth pages** — Without this, logged-in users can visit `/login` or `/signup`. Check session cookie before the public-path bypass and redirect to `/dashboard`.

## Next.js 14

- **next.config.ts not supported in Next.js 14** — Must use `.mjs` or `.js` extension. TypeScript config support was added in Next.js 15.
- **Tailwind CSS v3 required for classic PostCSS plugin** — Tailwind v4 moved the PostCSS plugin to `@tailwindcss/postcss`. Use `tailwindcss@3` with `postcss.config.mjs` + `tailwind.config.ts` pattern.
- **React 18 required for Next.js 14** — `pnpm add react react-dom` defaults to React 19, but Next.js 14 needs React 18. Explicitly install `react@18 react-dom@18`.
- **`staleTimes` does NOT fix back/forward navigation** — `experimental.staleTimes: { dynamic: 0, static: 0 }` only disables Router Cache for forward navigations (link clicks). Back/forward (popstate) still serves stale cached RSC payloads. Fix: add a client component that listens for `popstate` and calls `router.refresh()` to force a server re-fetch. See `src/components/refresh-on-nav.tsx`.
- **Never use `template.tsx` for route group layouts** — `template.tsx` remounts on every navigation, destroying browser history state and breaking back/forward. Always use `layout.tsx` for route groups. Only use `template.tsx` for rare cases like per-page entry animations.
- **Route groups for organization only, not competing layouts** — Auth pages (`(auth)/`) should NOT have their own `layout.tsx` if there's already a root layout. Competing layout trees cause rendering conflicts. Use a shared wrapper component (e.g., `AuthShell`) instead.

## Booking Portal

- **Auto-create customer at booking submission, not at convert-to-job** — When a customer submits a public booking, immediately match by email or phone to an existing customer record, or create a new one. This way the contractor sees a linked customer from day one (can view history, previous bookings). The convert-to-job flow just uses the already-linked `customerId`. Match priority: email first (most reliable), then phone. Split `customerName` into `firstName`/`lastName` on first space.
- **Pre-fetch all availability data on page load** — Fetch 3 months of available dates + all time slots for every date while the user is on the service selection step. By the time they reach date/time pickers, everything is instant from cache. Batch slot fetches (5 at a time) to avoid overwhelming the API.
- **Lazy-seed default availability for existing tenants** — Tenants created before availability seeding was added have zero `availability_schedules` rows. Both the authenticated `GET /availability` and public `GET /public/booking/:slug/availability` endpoints must lazy-seed Mon-Fri 8am-5pm defaults if no rows exist. Without this, all calendar dates show as unavailable.

## Project Maintenance

- **Always update `docs/project_docs/REPO_MAP.md` when adding/removing/moving files** — The repo map got severely outdated (showed routes as "planned" that were done months ago). Any PR that creates new files, folders, routes, components, schema files, actions, or migrations MUST update the repo map in the same commit. Same discipline as `docs/todo.md` and `docs/lessons.md`.

## UI/UX Design Patterns

- **Customer table card pattern is the standard** — All list/table pages should use a single `rounded-lg border border-border bg-card overflow-hidden` div wrapping both the filters (as a `border-b border-border px-4 py-3` header) and the table. Don't wrap filters and tables separately. Reference: `customers-page-client.tsx`.
- **Sidebar cards should NOT have special backgrounds** — Don't add `bg-muted/50` or other background overrides to sidebar summary cards. They should use the same default `<Card>` background as all other cards on the page.
- **Use shadcn Table components, not raw `<table>`** — Always use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table` for consistency. Never write raw `<table>` elements.
- **Never use raw `<button>`, always use `<Button>`** — Use shadcn's `Button` component with appropriate `variant` and `size` props. For icon-only buttons: `<Button variant="ghost" size="icon">`. For eye toggles in password fields: `<Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2">`.
- **3-panel detail page layout** — Entity detail pages (customer, invoice, job) use a consistent pattern: page header with breadcrumb + actions, then a grid with info panel (left), tabs panel (center), sidebar panel (right). Components: `*-detail-header.tsx`, `*-info-panel.tsx`, `*-tabs-panel.tsx`, `*-sidebar-panel.tsx`.
- **Reusable settings components** — Use `SettingsSection` (Card with icon + title), `SettingsFormMessage` (success/error with icons), `SettingsPageHeader` (description + action) from `components/dashboard/settings/` instead of hand-rolling Card boilerplate.
- **Dual-view pages (Kanban + Table)** — Job page supports both Kanban board and table view with a toggle. Stats bar shows KPI summary above the content.
- **Dark mode: always add `dark:` variants** — Badge colors, success/error messages, and any hardcoded light-mode colors need explicit `dark:` variants. Invoice preview paper stays `bg-white dark:bg-white` (it's a PDF preview, not a UI element).
