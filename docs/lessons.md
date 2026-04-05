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

- **Use `FastifyPluginAsyncZod` not `FastifyInstance` for route plugins** — `FastifyInstance` does not carry the `ZodTypeProvider` generics, so `request.body`, `request.params`, and `request.query` are typed as `unknown` even with `fastify-type-provider-zod` installed and configured. **Fix:** change route plugin signatures from `export default async function routes(fastify: FastifyInstance)` to `const routes: FastifyPluginAsyncZod = async (fastify) => { ... }; export default routes;`. Import from `"fastify-type-provider-zod"`, not `"fastify"`. This must be applied to every route file — all 29 in this project.
- **`z.enum(readonlyArray)` fails with `ZodTypeProvider`** — When a `const` array is passed to `z.enum()`, TypeScript types it as `readonly [...]` which doesn't match `z.enum`'s expected `[string, ...string[]]`. Fix: spread it — `z.enum([...VALID_VALUES])`.
- **`z.transform()` in querystring schemas breaks ZodTypeProvider strict checking** — Using `.transform()` in route querystring schemas (e.g., `z.string().transform(v => v === "true")`) causes TS overload errors under `FastifyPluginAsyncZod`. Replace with `z.coerce.boolean()` or parse manually in the handler.
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

## react-big-calendar Integration

- **Use react-big-calendar ONLY as layout engine** — Strip ALL default styles (toolbar, event colors, grid lines) via CSS overrides. Replace toolbar with custom shadcn components (Button, Popover, Calendar). Replace event cells with custom components using project color tokens. Hide default toolbar with `display: none`. Reset events with `background: transparent; border: none`.
- **`withDragAndDrop` generic types are broken** — Cast `withDragAndDrop(BigCalendar as any) as any` to avoid impossible TypeScript generic constraints. Use `eslint-disable` for the `any` casts. Type the event handlers manually in your wrapper.
- **`overflow: overlay` is deprecated, don't use it** — For fixing header/grid column alignment caused by scrollbar width, disable rbc's internal scroll entirely (`overflow-y: visible` on `.rbc-time-content`) and wrap the whole calendar in shadcn `ScrollArea`. This way there's no scrollbar width mismatch between header and body.
- **Month view needs `height: 100%`, week/day needs `height: auto`** — Month view fills the container (no time grid). Week/day views render at natural height (all 24h) and scroll via external ScrollArea. Conditionally render different wrappers based on `currentView`.
- **`resizable={false}` but also hide resize anchors via CSS** — Setting `resizable={false}` isn't enough, the DnD addon still renders resize handles. Hide `.rbc-addons-dnd-resize-ns-anchor` and `.rbc-addons-dnd-resize-ew-anchor` with `display: none`. Do NOT hide `.rbc-addons-dnd-resizable` — that's the event content wrapper, hiding it hides all events.
- **Events overlay blocks hover on time slots** — `.rbc-events-container` is absolutely positioned over `.rbc-timeslot-group`, intercepting all pointer events. Fix: `pointer-events: none` on `.rbc-events-container`, `pointer-events: auto` on `.rbc-event` inside it. This lets hover pass through to time slots while keeping events clickable/draggable.
- **Light vs dark mode need different border opacities** — Use full `hsl(var(--border))` for main grid lines (the CSS variable already adapts). Only reduce opacity for subtle secondary lines (half-hour marks), and use `:is(.dark)` selector for theme-specific overrides. Don't use a global `* { border-color }` reset — it kills visibility in one mode.
- **CSS animations don't trigger on rbc date changes** — react-big-calendar updates content in-place without remounting. CSS `animation` on `.rbc-month-view` only runs once on mount. Fix: use `useEffect` watching a `transitionKey` (view + date), imperatively set `opacity: 0` + `transform`, force reflow with `void el.offsetHeight`, then set end state with `transition`. The reflow forces the browser to paint the start state before transitioning.
- **"+N more" popup overlay needs explicit styling** — The default popup has a white background that clashes with dark mode. Override `.rbc-overlay` with `background: hsl(var(--popover))`, proper border-radius, shadow, and `z-index: 50`.

## UI/UX Design Patterns

- **Customer table card pattern is the standard** — All list/table pages should use a single `rounded-lg border border-border bg-card overflow-hidden` div wrapping both the filters (as a `border-b border-border px-4 py-3` header) and the table. Don't wrap filters and tables separately. Reference: `customers-page-client.tsx`.
- **Sidebar cards should NOT have special backgrounds** — Don't add `bg-muted/50` or other background overrides to sidebar summary cards. They should use the same default `<Card>` background as all other cards on the page.
- **Use shadcn Table components, not raw `<table>`** — Always use `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table` for consistency. Never write raw `<table>` elements.
- **Never use raw `<button>`, always use `<Button>`** — Use shadcn's `Button` component with appropriate `variant` and `size` props. For icon-only buttons: `<Button variant="ghost" size="icon">`. For eye toggles in password fields: `<Button variant="ghost" size="icon" className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2">`.
- **3-panel detail page layout** — Entity detail pages (customer, invoice, job) use a consistent pattern: page header with breadcrumb + actions, then a grid with info panel (left), tabs panel (center), sidebar panel (right). Components: `*-detail-header.tsx`, `*-info-panel.tsx`, `*-tabs-panel.tsx`, `*-sidebar-panel.tsx`.
- **EntityDetailShell eliminates sidebar/dialog boilerplate** — The shell in `components/dashboard/reusable/entity-detail-shell/` handles all shared logic (mode toggle, drag-resize, Sheet/Dialog wrapping, skeleton, toolbar). Entity-specific files only provide render callbacks for title, badges, actions, and tab content. Reduced 4 files from ~1,850 total lines to ~500. Always use this shell for new entity detail views instead of copy-pasting the pattern.
- **Lazy tab rendering for performance** — Only the active tab's content should be mounted. Previous pattern mounted all tabs simultaneously, causing unnecessary fetches and renders. The shell uses `{activeTab === tab.value && tab.content}` to defer rendering.
- **Reusable settings components** — Use `SettingsSection` (Card with icon + title), `SettingsFormMessage` (success/error with icons), `SettingsPageHeader` (description + action) from `components/dashboard/settings/` instead of hand-rolling Card boilerplate.
- **Dual-view pages (Kanban + Table)** — Job page supports both Kanban board and table view with a toggle. Stats bar shows KPI summary above the content.
- **Dark mode: always add `dark:` variants** — Badge colors, success/error messages, and any hardcoded light-mode colors need explicit `dark:` variants. Invoice preview paper stays `bg-white dark:bg-white` (it's a PDF preview, not a UI element).
- **All status badges must use shadcn `<Badge>`** — Never use raw `<span>` for status/priority indicators. Use `<Badge>` with subtle-fill pattern (no borders). The `outline` variant with visible borders looks AI-generated.
- **Settings sidebar > horizontal tabs for enterprise** — Grouped sidebar scales to 10+ items, horizontal tabs break at 6+. Groups: Account, Organization, Documents, Scheduling.
- **Catalog and Checklists are operational tools, not settings** — They belong as top-level sidebar items, not buried in Settings. They're core business data managed daily.
- **Better Auth `getInvitation` returns 403 for non-members** — Can't fetch invitation details for users who aren't org members yet. The invite acceptance page should show generic "accept/decline" without fetching details.
- **Better Auth org plugin method names differ from docs** — `createInvitation` → `inviteMember`, `memberId` → `memberIdOrEmail`, `getInvitation` takes `{ query: { id } }` not `{ invitationId }`. Always check TypeScript errors for correct parameter shapes.
- **Better Auth `invitation` table needs `createdAt`** — The Drizzle schema was missing `createdAt` on the invitation table. Better Auth requires it for the `inviteMember` endpoint. Always match the exact schema Better Auth expects.

## Equipment/Assets & Service Agreements (2026-03-31)

- **DB schema was already ahead** — equipment, refrigerant_logs, and maintenance_contracts tables existed from initial migration but had no API routes, actions, or frontend. Lesson: always check what schema already exists before planning.
- **refrigerantLogs.jobId was NOT NULL without FK** — had to fix with migration to make nullable + add FK constraint. Check FK integrity when building on existing schemas.
- **General service industry naming** — DB tables stay as `equipment` / `maintenanceContracts` but UI labels use "Assets" / "Service Agreements". Route paths use `/assets` and `/service-agreements`. Component folders match DB names (`equipment/`, `service-agreements/`).
- **Standalone page vs customer tab** — Agreement dialog needs a CustomerPicker when opened from standalone /service-agreements page but should skip it when opened from customer detail tab (customerId pre-filled). Use a `customerId` prop to control this.
- **Pagination component requires `total` prop** — Don't forget to pass it; the reusable Pagination component renders total count text.
- **Sidebar scaling** — With 12+ nav items, collapsible groups with localStorage persistence prevents visual overload. ScrollArea wrapping ensures collapsed sidebar scrolls on small screens. Hide scrollbar in collapsed mode to avoid overlapping icons.
- **Sliding indicator + ScrollArea** — The sidebar's sliding hover indicator breaks when nav items scroll because `getBoundingClientRect()` returns visual position but the indicator is absolutely positioned on the aside. Fix: listen to the ScrollArea viewport's scroll event and recalculate indicator position. Also clip indicator opacity when item scrolls outside visible bounds.

## Security Hardening (2026-04-02)

- **`requireTenant` middleware does NOT verify resource ownership** — It only confirms the user belongs to a tenant. You must still query with `and(eq(table.tenantId, tenantId), eq(table.id, id))` in every endpoint that reads/modifies a specific resource. Without this, any authenticated user can access any tenant's records by guessing IDs (IDOR).
- **Rate limiting is two-tiered — global vs route-level** — Global rate limit (100 req/min) is set in `server.ts` via `@fastify/rate-limit`. Auth endpoints need stricter limits (10 req/min) set via `config.rateLimit` on the route definition. If you forget to add `config.rateLimit` to new auth routes, they silently fall back to the permissive global limit.
- **Zod validation absence is silent** — Adding `fastify-type-provider-zod` globally enables schema validation, but only for routes that define `schema: { params, body }`. Routes without schema definitions accept any input without error. There's no warning that validation is missing.
- **Sanitize user input before injecting into AI prompts** — The chatbot route was directly interpolating user params into system prompts (`${k}: ${v}`), allowing prompt injection. Use `sanitizeForPrompt()` to strip control chars and cap length. This applies to any route that builds LLM prompts from user data.

## Multi-Pipeline (2026-04-03)

- **Data backfill migrations need IS NULL guards on UPDATE** — The pipeline migration creates a default pipeline per tenant via `INSERT ... ON CONFLICT DO NOTHING` (idempotent), but the UPDATE that sets `pipeline_id` on existing jobs must use `WHERE pipeline_id IS NULL` to avoid overwriting data on re-run. INSERT idempotency alone isn't enough if the migration also does UPDATEs.
- **`isDefault` flag without unique constraint is a race condition** — The UI enforces "one default pipeline per tenant" but the DB has no partial unique index like `CREATE UNIQUE INDEX ... WHERE is_default = true`. Concurrent API calls can create multiple defaults. The job creation endpoint picks the first one arbitrarily.
- **Filtering by pipelineId returns empty, not error** — List endpoints that filter by `pipelineId` return 0 results if the param is missing or wrong, instead of erroring. This causes silent data loss on the frontend if you forget to pass it.

## Performance Optimization (2026-04-04)

- **Server-side `Promise.all()` is all-or-nothing** — If any prefetch action fails in `Promise.all([getJobs(), getPipelines(), getTenant()])`, the entire page fails with no graceful degradation. Consider wrapping individual calls in try-catch with fallback defaults for non-critical data.
- **Initial props are snapshots, not live data** — `initialJobs` passed from server to client is stale after any user action. The client must re-fetch via server actions after mutations. If the server prefetch logic diverges from the client action logic (different filters, different fields), you get inconsistent state.
- **Batch stats endpoints (`/stats`) are fast but not cached** — `COUNT(*) FILTER (WHERE ...)` queries are efficient, but no HTTP cache headers or `revalidateTag` calls were added. The browser/CDN doesn't know it can serve stale, causing redundant API calls on every navigation.

## Kanban & Animation (2026-04-04)

- **`motion/react` stagger is per-card, not batched** — Each kanban card gets its own `transition={{ delay: index * 0.04 }}`. With 50+ cards, that's 50 separate animation tasks. Unlike CSS `@keyframes` with `animation-delay`, motion/react doesn't batch these. Consider limiting stagger to the first ~10 cards.
- **Removing priority border-left breaks light mode scannability** — The old kanban card used `border-l-[3px]` with dynamic priority colors. The redesign removed this for a cleaner look with shadow/ring, but subtle shadows are nearly invisible in light mode. Priority is only visible via badge text now.

## Recharts & Reports (2026-04-03)

- **Chart config objects must be memoized with `useMemo`** — Recharts compares config object identity (not deep equality). Inline config objects cause re-initialization every render, resulting in animation jank. Always wrap dynamic `ChartConfig` in `useMemo`.
- **Y-axis `tickFormatter` rounds aggressively** — `v >= 1000 ? \`$${(v/1000).toFixed(0)}k\` : \`$${v}\`` turns $1,800 into "$2k". Users may perceive inaccurate revenue. Use `.toFixed(1)` for "$1.8k" or switch to full numbers below $10k.

## Vercel AI SDK v6 + Groq (2026-04-02)

- **AI SDK v6 uses `inputSchema` not `parameters` for tool definitions** — Old Vercel AI SDK used `parameters` (Zod schema). v6 renamed it to `inputSchema`. Both compile but `parameters` is silently ignored in v6, making tools accept no input.
- **`maxOutputTokens` not `maxTokens`** — v6 renamed the token limit parameter. Using `maxTokens` may be silently ignored depending on the provider adapter.
- **LLM tool call inputs are not validated against schema by default** — The LLM may return wrong field names or types. The SDK validates structure but not semantic correctness. Always validate tool inputs before execution, especially for DB mutations.

## Frontend Architecture (2026-04-04)

- **Page titles are decentralized after navbar cleanup** — Titles moved from a central `pageTitles` map in `navbar.tsx` to individual `<PageHeader>` components per page. New pages can easily miss adding a header. No compile-time check catches this.
- **EditableField state is local, not synced to parent** — `EditableText`, `EditableSelect` etc. manage their own `draft` state. If the parent re-fetches data after a save, the editable field doesn't re-sync unless the `value` prop changes. Two tabs editing the same field can show stale drafts.
- **`docs/design.md` is the frontend source of truth** — Extracted from CLAUDE.md (2026-04-04) to reduce CLAUDE.md size. All frontend patterns, component APIs, layout rules, and performance rules live there. Update `docs/design.md` when changing frontend conventions.

## Zod Schema Migration (2026-04-05)

- **`fastify-type-provider-zod` needs `withTypeProvider<ZodTypeProvider>()` per-plugin for TypeScript inference** — The compiler is set globally in `server.ts`, but each route plugin receives an untyped `FastifyInstance`. To get full type inference on `request.body`/`request.params`/`request.query`, do `const f = fastify.withTypeProvider<ZodTypeProvider>()` inside the plugin and register all routes on `f` instead of `fastify`. Without this, the schema validates at runtime but TypeScript doesn't narrow the types.
- **Zod `z.coerce.number()` is required for all querystring numeric params** — HTTP query strings always arrive as strings (e.g., `page="1"`). Plain `z.number()` will fail validation. Use `z.coerce.number().int().min(1).default(1)` for pagination params.
- **Keep post-catalog-lookup validation guards** — For line item routes that auto-fill `description`/`unitPrice`/`itemType` from a catalog item, the Zod schema marks those fields as optional. The `if (!description || !unitPrice || !itemType)` check AFTER the catalog lookup must stay — it's business logic, not input validation.
- **Drizzle enum column casts (`as never`) are safe to keep** — Passing a Zod-typed enum string to Drizzle still requires `as never` for some pgEnum columns. This is a Drizzle type limitation, not an unsafe cast on user input. It's expected and harmless.
- **Override `limit` per-endpoint when bulk loading is needed** — `paginationQuery` caps `limit` at 100 (good for list pages), but Kanban boards need to bulk-load all pipeline jobs at once (e.g., `limit=150`). Override `limit` in the domain-specific query schema: `jobListQuery` extends `paginationQuery` and sets `.max(500)`. Never raise the global `paginationQuery` max — raise it only where the use case requires it.
- **Schema files belong to one domain** — `apps/api/src/lib/schemas/<domain>.ts` is the standard location. Maintenance contracts went into `equipment.ts` (same asset domain). Pipeline stages went into `pipelines.ts`. Co-location by domain beats file-per-table.

## File Uploads (2026-04-05)

- **Use base64 JSON transport for file uploads through Fastify** — The codebase has no multipart middleware (`@fastify/multipart`). Logo upload already uses base64 JSON. Follow the same pattern: client reads `File` → `arrayBuffer()` → `Buffer.from(...).toString("base64")` → sends JSON `{ data, filename, mimeType }`. Don't install multipart for one feature.
- **`storagePath` in DB is NOT a URL** — `job_photos.storage_path` stores the relative path inside the bucket (e.g., `{tenantId}/jobs/{jobId}/photo.jpg`). To get a public URL, construct it as `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/job-attachments/${storagePath}`. The `getStorageUrl()` helper in `apps/web/src/lib/storage-url.ts` does this.
- **Supabase Storage bucket must be created manually** — Unlike DB tables (migrations), Supabase Storage buckets are created via the Supabase dashboard or Management API. The `job-attachments` bucket is NOT auto-created by migrations. Add this to deployment checklist.
- **ZodError has `.issues` not `.errors`** — When using `parsed.error` from `z.safeParse()`, the flat list of validation issues is at `parsed.error.issues` (array of `ZodIssue`), not `.errors`. TypeScript will catch this but worth noting since the docs sometimes use `.errors`.
- **`photo_tag` Postgres enum needs `::photo_tag` cast in raw SQL** — Drizzle handles enum comparisons natively in query builder. But if using `sql\`...\`` with raw interpolation to filter by tag, cast the value: `${tag}::photo_tag`. Otherwise Postgres may reject it as an untyped string.
- **File-size validation must run client-side too** — Even though the API validates file size, validate client-side first. A 50MB file sent base64-encoded becomes ~67MB JSON — that hits the Fastify body size limit before reaching the file size check. Set `bodyLimit` in Fastify config if needed, or keep client-side validation as the primary guard.

## Conversations / Realtime Messaging (2026-04-06)

- **Supabase Realtime broadcast for custom events uses the same pattern as notifications** — See `use-notifications.ts` for the exact subscribe/cleanup pattern. Use `.channel('channel-name').on("broadcast", { event: "event-name" }, handler).subscribe()`. Always clean up with `supabase.removeChannel(channel)` in the `useEffect` return.
- **Realtime broadcast requires `getSupabaseAdmin()` on the API side** — The `getSupabaseAdmin()` from `@hvac-saas/database` uses the service role key and is allowed to send broadcasts. The browser client with the anon key can only receive. Don't mix them up.
- **Browser Notification API needs `useEffect` to sync permission state** — `Notification.permission` is a static property that's not reactive. Read it on mount with `useEffect(() => setPermission(Notification.permission), [])`. Calling `Notification.requestPermission()` returns a Promise — `await` it and update state with the result.
- **SMS placeholder pattern** — When a feature is "Coming Soon", disable it in the UI (channel selector Popover, radio buttons) with a `<Badge variant="secondary">Coming Soon</Badge>` and the `disabled` attribute. The API returns HTTP 501 for the endpoint. No Twilio package needed until the feature is built.
- **Conversations upsert on `(tenantId, customerId, channel)` unique index** — This means one email thread and one SMS thread per customer per tenant. Each has its own message history. If you want multiple independent email threads per customer, you'd need a different data model.
- **Optimistic updates must be reconciled** — When appending an optimistic message, give it a temporary `id` like `optimistic-${Date.now()}`. When the real response arrives, replace it by matching on the temp id. On failure, remove it and restore the input text.
