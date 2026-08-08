# Lessons: Backend Stack (Fastify, Drizzle, Supabase, Zod)

> Related: [[api-rules]] | [[architecture]] | [[API_DOCUMENTATION_1|API Docs]] | [[lessons]]

## Drizzle ORM

- **`pnpm db:migrate` only applies migrations listed in `meta/_journal.json`** — `supabase/migrations/` holds 42 `.sql` files but the journal tracks only the 10 drizzle-kit *generated* ones. Every hand-written migration (triggers, the number-generation race fix, RLS changes) is invisible to `db:migrate` and is silently skipped — no error, no warning. Note the duplicate numbering (`0004_add_default_tax_rate.sql` alongside `0004_skinny_sentinel.sql`) as the tell. For a fresh database: run `db:push` for the schema, then apply the hand-written SQL by hand.
- **`db:push` creates tables but never functions or triggers** — Drizzle's schema has no way to express them. After a push to a brand-new database you get 50 tables with **0 functions and 0 triggers**, which means `job_number`/`invoice_number`/`quote_number` stay empty on insert and `updated_at` never advances. Always follow a fresh push with `20260315000002_triggers.sql` then `20260412000001_fix_number_generation_race.sql` (in that order — the second replaces the first's three functions with advisory-lock versions). Both are idempotent.
- **Scaffold packages need placeholder `.ts` files** — TypeScript errors with `TS18003` if a `tsconfig.json` includes a dir with no `.ts` files. Add empty `export {};` index files to empty packages.
- **NEVER interpolate a Drizzle column into a correlated subquery — write the outer column out in full.** Drizzle renders an embedded column inside a `` sql`…` `` template as a **bare quoted name** (`"id"`), not a qualified one (`"pipelines"."id"`). Inside a scalar subquery, Postgres resolves a bare name against the *subquery's own* table first, so `` sql`(SELECT count(*) FROM jobs WHERE jobs.pipeline_id = ${pipelines.id})` `` silently becomes `jobs.pipeline_id = jobs.id`. It compiles, it runs, it returns a number — the wrong one, forever. Three shipped instances were found this way in 2026-07: `/pipelines` `stageCount` and `jobCount` and `/checklists` `itemCount` all returned **0 for every row** (measured: a tenant with 4 stages and 1 job read as 0 and 0), and the stage `jobCount` had the opposite failure — `jobs.pipeline_id = "pipeline_id"` bound to the inner table and was **always true**, so the count silently ignored the pipeline. **Write it as `WHERE j.pipeline_id = pipelines.id` and alias the inner table.** The tell is a count that is suspiciously 0 or suspiciously large; `query.toSQL()` shows the bare `"id"` immediately.
- **Verify a count query by making the number change, not by reading it once.** All three of the above returned a plausible value. What exposed them was asserting an *expected* number against known data (4 stages, 1 job) — and for the archived-filter fix, archiving a row inside a rolled-back transaction and watching the two formulas diverge. A single reading of a correlated aggregate proves nothing.

## Neon (Postgres)

- **`prepare: false` in `packages/database/src/client.ts` carries over from Supabase unchanged** — Neon's pooled endpoint rejects prepared statements the same way Supabase's transaction pooler does; the direct endpoint tolerates the flag. No driver change was needed for the migration.
- **A dead Supabase project fails as a DNS error, not an auth error** — `<ref>.supabase.co` stops resolving entirely once a project is deleted (paused projects still resolve). The pooler host keeps resolving and returns `XX000 Tenant or user not found`, which reads like a credentials problem. Resolve the project subdomain first to tell the two apart.

## Zod

- **`KEY=` in a .env file parses as `""`, not `undefined`** — so `z.string().min(1).optional()` *rejects* a deliberately blank optional var and the process refuses to boot. Any optional env var whose `.env.example` ships it empty needs `z.preprocess(v => v === "" ? undefined : v, ...)`. Both `apps/api/src/lib/env.ts` and `apps/web/src/lib/env.ts` use an `optionalString` helper for this.

## Storage & Realtime (post-Supabase)

- **Supabase `broadcast` and `postgres_changes` are completely different dependencies** — `postgres_changes` tails the Postgres WAL and only works against Supabase's own database; `broadcast` is a plain websocket relay that never touches the DB. All six of our usages were `broadcast`, which is why moving Postgres to Neon didn't break Realtime *conceptually* and why replacing it needed nothing database-aware. Check which one you're on before planning a migration — the answer changes the work by an order of magnitude.
- **Supabase Realtime channels had no authorization** — any authenticated user could `.channel("notifications:<any-tenant-id>")` and receive another tenant's events. Nothing enforced ownership. The SSE replacement scopes to the session's tenant and requires an admin role to pass `?tenantId=`. Worth remembering if any other "just works" Supabase primitive is still trusted.
- **R2 public-vs-private is per bucket, not per object** — so a single bucket can't hold both browser-served job photos and private invoice PDFs. Two buckets, with the old logical bucket name kept as a key prefix (`job-attachments/…`, `invoices/…`), keeps stored `storagePath` values in the database valid and unchanged.
- **SSE needs `reply.hijack()` in Fastify** — otherwise Fastify tries to serialise a response body and the stream never forms. Also send a periodic comment frame (`: ping`) — proxies commonly drop an idle stream at ~60s — and set `X-Accel-Buffering: no` so buffering proxies don't hold frames back.

## Analytics & caching

- **`void promise.then(...)` with no `.catch()` is a process killer, not a lint nit.** The analytics cache's stale-while-revalidate branch fired a detached background refetch with no rejection handler. Node ≥15 terminates on an unhandled rejection, so one dropped Neon connection during a revalidate would take down the whole API — and because the triggering request had already returned `200`, the crash would look random and unattributable. Any fire-and-forget promise in a long-lived server needs a `.catch()` that at minimum logs.
- **An in-memory cache without in-flight deduping doesn't protect a cold start.** `getOrFetch` checked the map, missed, and ran the fetcher — so N concurrent requests on a cold key each ran the full 21-query fan-out. SSR prefetch plus client hydration produces two on every page load by itself. Store the *promise*, not just the resolved value.
- **Postgres `CURRENT_DATE` is the session timezone, which is UTC on Neon.** Every "today" boundary in analytics was therefore UTC while `tenants.timezone` (default `America/Chicago`) sat unused — the dashboard rolled over at 6-7 PM local. Fix is `(now() AT TIME ZONE ${tz})::date` in SQL and `Intl.DateTimeFormat("en-CA", { timeZone })` in JS (`en-CA` formats as `YYYY-MM-DD`, so no manual assembly). **Both sides must agree**: the agenda window is computed in JS and the "jobs today" count in SQL, so if they disagree the two widgets contradict each other.
- **`date_trunc` buckets overhang the requested range in both directions.** `generate_series(date_trunc('week', from), …)` starts up to 6 days *before* `from`, and each bucket spans a full interval past `to`. Joining payments only on the bucket meant the chart summed to a different total than the headline `getRevenueTotal`. Clamp the join to `[from, to]` *as well as* to the bucket.
- **A stored status column and a live `due_date` comparison are two different definitions of "overdue".** The banner used `status = 'overdue'` (only correct after a cron run) while the aging widget computed buckets from `due_date`, so an invoice ten days late but still `sent` appeared in one and not the other. Derive read-side state from the date; keep the stored status for triggering emails.
- **Drizzle `sql` fragments nest, so a shared filter can be a constant.** `const NOT_ARCHIVED = sql\`AND archived_at IS NULL\`` interpolated as `${NOT_ARCHIVED}` composes correctly and keeps the filter from drifting across a dozen queries — which is exactly how the dashboard ended up counting archived jobs in KPIs while excluding them from the agenda.
- **A `LEFT JOIN` through a UUID FK still needs its own `tenant_id`.** `getDashboardPipeline` joined jobs on `pipeline_id` alone. Not exploitable in practice (the pipeline was already tenant-scoped), but it was the only query on the page without the guard and the next person to edit that join would not have known.

### From the /reports pass (2026-07-27)

- **When you change shared code, grep for every caller — not just the page you are on.** Four `/reports` defects (`REP-05`, `REP-06`, `REP-07`, and half of `REP-04`) were *created* by the `/dashboard` remediation the same day: the shared analytics layer gained tenant timezone, `archived_at` filters, cache `onError` and a `tz` cache key, and the report service simply did not move with it. The Jobs tab excluded archived rows while the Bookings tab did not — one page, two rules. The queries live in `services/analytics/queries/`, shared by both surfaces; touching one is touching both.
- **Never zip two `generate_series` results by array index.** Both `date_trunc`-bucketed series looked symmetrical, but a range inside one calendar month yields *one* current bucket while an equal-length previous range straddling a month boundary yields *two*. `2026-03-01..2026-03-31` paired March with January and silently dropped February — and it is the "Last month" preset, the most natural choice on the page. If two series must be paired positionally, **construct** them so the counts are provably equal: shift the whole range back by its own bucket count (`compareFrom`/`compareTo` in `analytics/types.ts`). Shifting both endpoints by whole buckets preserves the count for day, week and month; verified 48 range × granularity combinations against Neon.
- **`pFloat(undefined)` returns `0`, which reads as a real number on a chart.** The reverse misalignment case failed silently: a missing comparison bucket became a £0 point, so the line dropped to the floor instead of ending. Model "no counterpart" as `null` and let the chart break the line.
- **`timestamptz` compared against a bare `::date` resolves in the session timezone.** `created_at >= ${from}::date AND created_at <= ${to}::date + INTERVAL '1 day'` looks range-safe but the boundary is UTC, so a customer created at 8pm Central on the last day of a range landed in the next one. Use `(created_at AT TIME ZONE ${tz})::date` — the timestamptz sibling of the `CURRENT_DATE` lesson above.
- **A closed enum can select a *pre-built* `sql` fragment safely — that is not `sql.raw`.** Parameterising `date_trunc` and the step interval by granularity looked like it needed string concatenation. It does not: a `Record<Granularity, SQL>` of literal `sql\`INTERVAL '1 week'\`` fragments composes with zero request data in the SQL text, and `to_char` format strings pass fine as ordinary bind params. That is all `queries/buckets.ts` is.
- **Decide once whether archiving erases money.** It does not. Entity counts (jobs, bookings, customers, invoices, quotes) exclude `archived_at IS NOT NULL` so they match the list pages; anything sourced from `invoice_payments` does *not* filter, because archiving a document cannot un-collect cash. Both rules are stated in a header comment in `revenue.ts` and `quotes-invoices.ts` so nobody has to re-derive them per query.
- **An exhaustive `switch` that builds each union member needs no cast.** `getReportBySection` originally returned `null` from a `default` branch that Zod made unreachable, and the route turned that into a **200** carrying an error string — which the client rendered as an empty report. Constructing `{ ...meta, section, data: await getX() }` inside each `case` narrows `section` to the literal, so the compiler matches the discriminant to the payload and a `default: { const _: never = section }` makes a new section a compile error.

## Fastify

- **A global `onResponse` hook beats sprinkling cache invalidation across handlers.** Busting the analytics cache on write needed to happen in ~30 mutating endpoints across 5 route files. One hook keyed on `request.authUser?.tenantId` + a mutating method + `statusCode < 400` covers all of them and cannot drift as routes are added.
- **Response schemas must be Zod, never raw JSON Schema** — `server.ts` registers `fastify-type-provider-zod`'s `serializerCompiler` globally, so a route with a hand-written `{ type: "object", properties: {...} }` response schema returns `500 FST_ERR_INVALID_SCHEMA` at request time, not at boot. `/health` shipped broken this way. Put the schema in `lib/schemas/<domain>.ts` and reference it (`response: { 200: healthResponse }`).
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

## Zod Schema Migration (2026-04-05)

- **`fastify-type-provider-zod` needs `withTypeProvider<ZodTypeProvider>()` per-plugin for TypeScript inference** — The compiler is set globally in `server.ts`, but each route plugin receives an untyped `FastifyInstance`. To get full type inference on `request.body`/`request.params`/`request.query`, do `const f = fastify.withTypeProvider<ZodTypeProvider>()` inside the plugin and register all routes on `f` instead of `fastify`. Without this, the schema validates at runtime but TypeScript doesn't narrow the types.
- **Zod `z.coerce.number()` is required for all querystring numeric params** — HTTP query strings always arrive as strings (e.g., `page="1"`). Plain `z.number()` will fail validation. Use `z.coerce.number().int().min(1).default(1)` for pagination params.
- **Keep post-catalog-lookup validation guards** — For line item routes that auto-fill `description`/`unitPrice`/`itemType` from a catalog item, the Zod schema marks those fields as optional. The `if (!description || !unitPrice || !itemType)` check AFTER the catalog lookup must stay — it's business logic, not input validation.
- ~~**Drizzle enum column casts (`as never`) are safe to keep**~~ — **Wrong; corrected 2026-07-29.** `as never` was never a Drizzle limitation. It appeared wherever the Zod schema typed a field as `z.string()` while the column was a `pgEnum` — the cast was silencing a genuine mismatch, and an unvalidated string reaching a Postgres enum fails at the driver as a 500 instead of at the edge as a 400. `jobs.serviceType` accepted any string for four months behind one of these. **Mirror the pgEnum as a Zod enum (api-rules §4) and the cast disappears on its own.** If `as never` is needed, the schema is wrong.
- **Override `limit` per-endpoint when bulk loading is needed** — `paginationQuery` caps `limit` at 100 (good for list pages), but Kanban boards need to bulk-load all pipeline jobs at once (e.g., `limit=150`). Override `limit` in the domain-specific query schema: `jobListQuery` extends `paginationQuery` and sets `.max(500)`. Never raise the global `paginationQuery` max — raise it only where the use case requires it.
- **Schema files belong to one domain** — `apps/api/src/lib/schemas/<domain>.ts` is the standard location. Maintenance contracts went into `equipment.ts` (same asset domain). Pipeline stages went into `pipelines.ts`. Co-location by domain beats file-per-table.

## Fastify body limits (2026-07-29)

- **Fastify's `bodyLimit` defaults to 1 MB and rejects *before* the handler runs.** A handler that checks its own 20 MB ceiling never executes and never returns its friendly 400 — the client gets `FST_ERR_CTP_BODY_TOO_LARGE` (413) from the content-type parser. Two endpoints shipped this way for months: job attachments (handler said 20 MB / 50 MB, modal said "Max 20MB") and the tenant logo (handler said 2 MB). Both had a real ceiling of ~786 KB, because base64 inflates by 4/3. **Set `bodyLimit` per-route, derived from the advertised limit, and never raise it globally** — a global raise hands every one of the ~200 JSON endpoints a bigger DoS surface to fix two.
- **When two numbers must agree, compute one from the other.** `bodyLimitFor(UPLOAD_LIMITS.photo)` cannot drift from the ceiling the handler enforces; `bodyLimit: 28_000_000` next to `if (len > 20 * 1024 * 1024)` will. The original bug was not that someone picked the wrong limit — it was that the second number didn't exist at all, so nothing looked wrong on the line that mattered.
- **`fastify.inject()` proves body-size behaviour without a server, a port, or a session.** The parser rejects oversize bodies before `preHandler`, so **413 vs 401 is the whole signal**: a 401 means the body was parsed and auth ran. Keep an ordinary endpoint in the same test as a control, to show the global default is still in force.

## Invoices audit — money, transactions and cron (2026-07-29)

- **Derived state must be derived on write, not just on read.** `recalculateInvoiceTotals` recomputed `subtotal`, `taxAmount`, `totalAmount` and `balanceDue` and never touched `status` — so an invoice that took a payment and was then edited upward read **Paid** on the list, in the stat cards, on the PDF and to every consumer of `status` while money was still owed. If a column is a function of other columns, the function has to run everywhere they change; the fix is one `recalculateInvoice()` that writes all of them together, not a status update bolted onto each call site.
- **A status value that can be *chosen* will eventually be chosen wrongly.** `PATCH /:id/status` wrote any of six enum values with no rules: `void → draft` un-voided a cancelled invoice, and `draft → paid` recorded money as received with **zero payment rows** while `amountPaid` and `balanceDue` stayed put. Splitting the enum into *chosen* statuses (draft/sent/void, through a transition table) and *derived* ones (partially_paid/paid, only from the payment rows) makes the second class unreachable by hand — a stronger guarantee than validating the transition into them.
- **A transaction is not a lock.** Wrapping "INSERT payment, SELECT SUM, UPDATE invoice" in `db.transaction()` fixes the crash-in-the-middle case but not the concurrency case: at READ COMMITTED both requests still read the same sum and the later `UPDATE` wins. `SELECT … FOR UPDATE` on the invoice row is what serialises them. Same lesson as the booking→job conversion, on a table where it costs money.
- **Deriving the resulting state kills a whole family of bugs at once.** `DELETE /payments/:id` set `status = "sent"` whenever `amountPaid <= 0`, which resurrected **voided** invoices into the dunning cron and marked never-sent **drafts** as sent. Both disappear the moment the status is computed from the rows rather than assigned — you cannot express them.
- **Three copies of a predicate will disagree, and the one that disagrees is the one nobody looks at.** The list and the stats endpoint both derived "overdue" from `due_date` in the tenant's timezone. The *cron* used `now().toISOString().split("T")[0]` — server UTC — and restricted to `status IN ('sent','overdue')`. Consequence: a `partially_paid` invoice past its due date was counted as overdue everywhere in the UI and **never chased**. A customer who paid half and then stopped was silently dropped. One exported `overdueCondition()` now backs all three.
- **`UPDATE … RETURNING` is the cheapest distributed lock you already have.** The email crons ran on every API instance with only a "last reminded at" column narrowing the window, so two instances could both read "not yet reminded" and both send. Claiming the rows — stamp and return in one statement, then send to whatever came back — makes N instances split the work instead of duplicating it, and makes a crash-loop stop being a mailing-loop. No queue, no leader election.
- **`setTimeout` is not a scheduler.** The E-12 review request was a two-hour in-memory timer inside the payment handler: every deploy, crash or scale event dropped every pending one, with no record that one had ever been intended. Any delay longer than a request belongs in a column plus a sweep.
- **A settings field nothing reads is worse than a missing one.** `invoicePaymentTerms` was collected, validated, and *printed on the customer's PDF* — while `dueDate` was only ever whatever the caller passed, and `from-job` never passed one. So every invoice raised from a job (the primary flow) printed "Terms: Net 30" above a blank due date, was never overdue, never aged and never dunned. The setting looked implemented from every angle except the one that mattered.
- **`@react-pdf/renderer` fetches remote `<Image src>` from the API process.** `logoUrl` was `z.string().url()`, so any syntactically valid URL — including `http://169.254.169.254/latest/meta-data/` — was fetched server-side with no timeout, from an endpoint that had no rate limit. Untrusted input reaching a new interpreter, same class as the LLM-prompt and email-header rules. A tenant asset must be constrained to *our* bucket under *that tenant's* prefix, not merely to "a URL".
- **CPU-bound endpoints need their own rate limit, not the global one.** Two endpoints ran a synchronous PDF render under the shared 100 req/min bucket; 100 concurrent renders stall the event loop for every tenant on the instance. The global limit is sized for JSON handlers and says nothing about work per request.
- **Index what the WHERE clause actually filters on.** `invoices` had indexes on `(tenant_id, invoice_number)` and `(tenant_id, status)` while the list filtered on `customer_id`, `job_id` and `due_date`, and `invoice_line_items` / `invoice_payments` had **no index on `invoice_id` at all** — so every detail fetch and every recalculation was a sequential scan of a tenant-shared table. Indexes tend to get written when the table is created and never revisited when the filters are added.

## Seeding a tenant (2026-07-31)

- **Job, invoice and quote numbers come from `BEFORE INSERT` database triggers, not application code.**
  `generate_job_number()` / `generate_invoice_number()` / `generate_quote_number()` fire only when the
  column `IS NULL OR = ''`, take a tenant-scoped `pg_advisory_xact_lock`, and issue
  `JOB-<year>-NNNN` per tenant. `POST /jobs` inserts `jobNumber: ""` for exactly this reason. Any seed
  or script that invents its own number silently bypasses the sequence and can collide with the next
  real insert — always insert the empty string and let the trigger do it.
- **Invoice status is derived, never asserted.** `deriveStatus()` in
  `services/invoices/status.service.ts` computes it from the payment rows: no payments → `draft` or
  `sent`, partial → `partially_paid`, full → `paid`; `void` is terminal. A seed that writes
  `status: "paid"` with no payment rows produces a row the application will silently re-derive to
  `sent` on the first edit. Import the real function rather than restating the rule — same for
  `splitPayment()` (overpayment becomes `credit_amount`, it is not clamped away) and
  `dueDateFromTerms()`.
- **Never write a literal money figure next to the line items that produce it.** Seed payments as
  *intent* — "settle the rest", "overpay by 50" — and resolve them against the total computed from the
  lines. Hardcoded amounts made three invoices land one cent-to-a-few-dollars off, which silently
  turned "paid in full" into `partially_paid`, because status follows the money.
- **`total` on every `*_line_items` table is `GENERATED ALWAYS AS (quantity * unit_price)`.** Inserting
  it is a hard error. Read it back to reconcile the parent's `subtotal` — that is the cheapest possible
  check that a seed's arithmetic agrees with the database's.
- **`jobs.status` is the stage's `name` denormalised; `jobs.stage_id` is the real pointer.** Write both,
  from the same resolved stage, or the board and the list disagree. `completed_at` must be set iff the
  stage's `lifecycle` is `completed`.
- **`bookings.converted_to_job_id` and `jobs.booking_id` are two halves of one link** and both must be
  written. They also form a cycle, so a tenant-scoped wipe has to null one side before deleting either.
- **`as const` on a seed dataset makes optional fields unreachable.** It turns each array into a tuple
  of literal object types, so a property only some members carry (`notes`, `catalog`, `convertedJob`)
  is absent from the union and `TS2339`s at every call site. Declare an explicit interface instead —
  it still checks every enum string against the schema, and keeps optional fields optional.
- **A payload field outlives the component that read it.** `weeklyJobVolume` and `weeklyRevenue`
  stayed in the dashboard fan-out for months after the KPI sparkline that consumed them was deleted —
  two queries per dashboard load, parsed, mapped and read by nobody. When you delete a UI element,
  grep the field it consumed across `packages/types` and the service that builds it.
- **"Invoiced" must exclude drafts, not just voids.** `getCollectionRate` counted every non-void
  invoice, so unsent drafts sat in the denominator and the reported collection rate was lower than
  the business had actually failed to collect. Measured on the demo tenant: one draft worth
  $12,669.58 against $19,079.08 genuinely billed — a 66% overstatement. Keep the filter in one `sql`
  fragment shared by every query that says "billed".
- **`db.execute()` returns the rows array directly, not `{ rows }`.** The project uses
  `drizzle-orm/postgres-js`, whose `execute` resolves to a `Result` that *is* an array —
  `res.rows` is `undefined` and every `.rows.length` on it throws. The `node-postgres`
  shape (`{ rows: [...] }`) is what most Drizzle examples show, so any harness copied
  from the docs fails on the first raw query. Destructure with `const [row] = await
  db.execute(sql\`…\`)`.
- **`SUM(quantity * unit_price)` is not the number the user is looking at.** Where line
  items store `total` as a `GENERATED` `numeric(10,2)` column, Postgres rounds *per row*,
  so the UI's column sums rounded values while a recalculation that re-multiplies sums the
  raw ones. Two lines of `1.5 × 10.33` render as $15.50 each above a subtotal of $30.99
  (measured on quotes). Sum the stored `total`, or round each product, but never mix the
  two in one document.

## Job costing

- **Joining two child tables to one parent multiplies them.** Aggregating
  `job_line_items` *and* `job_expenses` against `jobs` in one query is a
  cartesian product: a job with 4 line items and 3 expenses counts each line
  item 3 times and each expense 4. The failure is silent and plausible —
  nothing about $2,400 looks like $800 counted three times. Use one correlated
  `LEFT JOIN LATERAL` per child, or one query per child.
- **A margin is a *difference* of two sums, so float error is doubled.** Parse
  every `numeric` string to integer cents, do the arithmetic there, and format
  once on the way out. `services/costing/money.ts` is the implementation. The
  quotes audit had already found a subtotal a cent off the lines that produced
  it (QUO-08); a margin lands on the number a contractor prices their work with.
- **A percentage of zero revenue is `null`, not `0`.** Returning 0 files a job
  that cost $300 and billed nothing next to one that broke even exactly. Every
  `marginPct` in this codebase is `number | null` for that reason.
- **`z.coerce.boolean()` is `Boolean(value)`, so the string `"false"` is
  `true`.** I nearly shipped a `configured: z.coerce.boolean()` on a raw-SQL row.
  It is the same defect as `?showArchived=false` returning archived-only rows
  (CUST-29). When a raw query wants a yes/no, `SELECT COUNT(*)` and compare in
  TypeScript — a count has no coercion edge.
- **Roll a report up in TypeScript when the definition already lives there.**
  The profitability section groups per-job rows in `profitability.service.ts`
  rather than in a SQL `GROUP BY`, because `summarise()` is the one definition of
  what a job's margin is — including when it is too incomplete to state.
  Re-expressing that in SQL gives the report a second opinion that will
  eventually disagree with the job's own Costs tab, and the user has no way to
  tell which is lying. Bound the row set instead, and report when the bound bites.
- **An unknown cost makes a total incomplete, not lower.** Nothing about the
  arithmetic distinguishes "this line costs nothing" from "nobody costed this
  line" — both add 0. So the sum travels with a count of what was skipped
  (`CostCoverage`), and jobs with gaps are *excluded* from report aggregates
  rather than averaged in, which would drag every group's margin toward 100% and
  make a losing segment look healthy.
- **Snapshot a rate onto the row, don't join it.** `jobs.labor_cost_rate` is
  copied at the moment hours are saved, so giving somebody a raise does not
  retroactively rewrite last year's margins. Same reasoning as `unit_price` on
  line items, which the codebase had done since the beginning.

## Test harness against Neon (2026-08-07)

- **`withRollback` is the whole integration-test story: run against the real database, commit
  nothing.** Every test body runs inside a transaction that is unconditionally rolled back, so
  tests exercise real foreign keys, real partial unique indexes and real generated columns, and
  leave the database exactly as they found it — no truncate step, no fixture cleanup, no ordering
  dependency between suites. This is only possible because the services here already accept a
  transaction handle (`Omit<ReturnType<typeof getDb>, "$client">`, added for the quote→job
  conversion). That decision paid for itself twice.
- **A constraint violation aborts the whole transaction, so a schema test cannot assert twice.**
  Postgres returns `25P02 current transaction is aborted` for every statement after an error, which
  means a test that deliberately triggers a `23505` and then wants to check that a *legitimate*
  second row is still accepted will fail on the second half. The fix is a SAVEPOINT: Drizzle's
  nested `db.transaction()` emits one, so `expectViolation()` in `src/test/db.ts` rolls back only
  the failing statement and the outer transaction survives. Without this, half of what a schema test
  is for is unexpressible.
- **`ON DELETE RESTRICT` raises `23001`, not `23503`.** `restrict_violation` and
  `foreign_key_violation` are different SQLSTATEs, and the difference is real: RESTRICT is checked
  immediately and can never be deferred, while NO ACTION is checked at end-of-statement and could be
  deferred by `SET CONSTRAINTS`. Assert the precise code when the immediacy is the guarantee you
  care about.
- **Drizzle names every schema column in an `INSERT`, so an unapplied migration breaks writes to
  that table entirely — not just the new columns.** `20260806000001_job_costing.sql` had never been
  run against Neon, and the effect was that *every* insert into `tenants`, `jobs`, `job_line_items`
  and `catalog_items` failed with `42703 column "default_labor_cost_rate" does not exist`. Onboarding,
  job creation, line items and the catalog were all broken against the live database while the code
  looked fine. There is no partial-application mode: schema and migration must move together, and
  "the migration is written" is not the same as "the migration is applied".

## Event instrumentation across the domain routes (2026-08-07)

- **`Omit<ReturnType<typeof getDb>, "$client">` is the only correct `db` type for anything a route
  might call inside a transaction — and this repo has now got it wrong three times.**
  `job-stages.service.ts` had it (QUO-02), `recalculateJobTotals` in `routes/jobs/index.ts` had it,
  and both were found the same way: a handler that needed to become transactional couldn't, because
  one helper in the middle refused a transaction handle. A Drizzle transaction has every query
  method and no `$client`. Type new helpers this way from the start; the alternative is discovering
  it at the moment you can least afford a refactor.
- **Emit the event *inside* the caller's transaction, and emit it after the money.** Two separate
  rules, both learned here. A queue row that commits apart from the domain write is either an
  automation firing for work that rolled back, or a committed change whose automation silently
  vanished. And a row written by `INSERT` starts at `0.00` — emitting `invoice.created` or
  `quote.created` before the recalculation means a workflow gating on "over $2,000" never matches
  anything, which reads as "the trigger is broken" rather than "the payload was early".
- **One emitter per concept, not per route.** `booking.cancelled` is written by `PATCH`, `DELETE`
  and `bulk-status-update`; `invoice.voided` by `/void`, `PATCH /:id/status` and the bulk path.
  Each of those pairs has already diverged once in this codebase (JOB-22: the bulk job path sent no
  completion email at all). A shared `emit*StatusEvents(transitions)` that filters `from === to`
  itself makes the divergence unexpressible instead of findable.
- **A no-op write must not emit.** Re-sending an invoice, re-saving a confirmed booking, re-adding
  a tag that is already there, PATCHing a customer with identical values — all of these reach the
  same handler as the real thing. `onConflictDoNothing().returning()` returning nothing, and a
  `from !== to` filter, are what separate them. Without that, "when a tag is added" fires every time
  someone opens the tag picker.
- **`.returning()` on a DELETE is how you tell "removed" from "was not there".**
  `DELETE /customers/:id/tags/:tagId` was idempotent by accident — it deleted unconditionally and
  logged an activity either way. Idempotent responses are fine; an event that fires when nothing
  changed is not.

## Workflow engine (2026-08-08)

- **Pauses have to be exceptions, not return values.** A wait node five frames
  deep inside a loop body must suspend the whole run. As a discriminated return
  every frame between it and the traverser has to check, and one missed check is
  a "pause" that quietly carries on. As a throw, control flow reads top to
  bottom and a missing handler is loud.
- **Compare-and-set on every transition out of `running`.** `UPDATE … WHERE id =
  ? AND status = 'running'`. A delay pause and a concurrent goal exit can both
  believe they own the row; without the guard the later write wins silently and
  the run is `waiting` or `completed` depending on which column you read.
- **A unique-constraint violation can be the success path.** `23505` on the
  execution table's `idempotency_key` means "this event was already handled" and
  on `active_dedup_key` means "this subject is already mid-run" — both are
  answers, not errors. That is the structural version of a query-then-insert
  race, and it is why the indexes are partial.
- **Resolve variables through a closed map, never by walking the context.**
  Prototype-chain access then isn't reachable at all, and the `env`/`__proto__`
  deny-list becomes defence in depth rather than the mechanism. The four
  namespaces that *must* walk an object (`previous`, `vars`, `trigger`, `loop`)
  walk **their own** object with `hasOwnProperty` checks — `in` and bare bracket
  access both traverse the prototype, so `{{vars.toString}}` would resolve to a
  function.
- **Format by declaration, never by the value's shape.** The reference system
  sniffed values and rendered a ten-digit Google Ads campaign id as
  `(123) 456-7890`. `format: "phone"` lives on the variable, not in a heuristic.
- **Declare what a node mutates and let the engine re-read it — including the
  analytics cache.** The server invalidates that cache on an `onResponse` hook,
  and an engine write has no request, so nothing fires for it. Without one line
  in `refreshAfterNode`, a workflow that records a payment leaves the dashboard
  wrong for ten minutes and nothing says why. It is the easiest thing in the
  engine to forget and the hardest to notice.
- **An "already running" at-most-once node should fail loudly, not re-send.** A
  crash mid-send leaves a `running` log row, and the honest answer is "we don't
  know whether the customer got that email". Re-sending to be safe is the wrong
  kind of safe.
- **Fail closed on an unknown ownership kind.** `assertOwnership` returns false
  for a kind it has no checker for, so adding a new one refuses until somebody
  writes the check. A permissive default would make the next `ownership: "…"`
  silently unenforced.
- **Hand-written migrations have no runner in this repo — apply them with
  `postgres.js` `sql.unsafe(file).simple()`.** There is no `psql` on the dev
  machine, and `pnpm db:migrate` is `drizzle-kit migrate`, which only applies
  what is listed in `meta/_journal.json` — 32 of 42 files are not. So every
  audit migration is applied by script or not at all. `.simple()` is the load-
  bearing part: without it postgres.js uses the extended protocol, which allows
  exactly **one** statement per call, and a migration file is many. Note the
  trade-off — a multi-statement simple query is an *implicit transaction*, so
  the whole file is all-or-nothing (good), but `ALTER TYPE … ADD VALUE` is only
  legal in a transaction block on PG 12+ (Neon is 18.4, so fine) and the new
  value cannot be used by a later statement in the same file.
- **A deliberate constraint violation inside a transaction poisons every
  assertion after it — wrap negative tests in a `SAVEPOINT`.** Postgres aborts
  the *entire* transaction on any failed statement; catching the error in
  JavaScript does not un-abort it. A verification script that checks "a bogus FK
  is refused" and then keeps asserting is reading a dead transaction, and the
  errors it reports afterwards are misleading rather than absent — this cost a
  run where a bad `INSERT` was blamed on the FK it had nothing to do with. Use
  `tx.savepoint(async sp => { … })` around the failing probe. Same reason
  `withRollback()` exists, one level down.
- **Verify a migration's *purpose*, not just its shape.** Column-and-index diffs
  prove the DDL ran; they cannot prove `ON DELETE SET NULL` was written where
  `CASCADE` was meant. Deleting the parent and asserting the child **survived**
  is a two-line check that catches a clause which reads correctly and destroys
  data. The structural pass and the behavioural pass find different bugs.
- **The same predicate needs opposite defaults for the engine and the validator
  — decide which caller you are writing for.** `assertOwnership` returns false
  for an ownership kind it has no checker for, which is right at execution time
  (an id you cannot verify must not be used) and wrong at publish time, where it
  would tell the author "you do not own this customer" for the eight of eleven
  kinds nobody has written a checker for yet — untrue, and unfixable from inside
  the product. A shared helper with one fail-closed default silently makes the
  permissive caller wrong. Export the *set of what is checkable* alongside the
  checker so each caller picks its own default explicitly.
- **A rule that must run in the browser and on the server belongs in the pure
  package, whatever the design doc says.** wf-08 §8.7 placed the graph validator
  in `services/workflow/graph/validate.ts` and also said the browser imports it —
  which cannot both be true, because the browser cannot import from `apps/api`.
  The resolution is to split by *purity*, not by layer: structural rules go in
  `packages/workflow-nodes` (zod only, no Drizzle, no I/O), and only the rules
  genuinely needing the database stay server-side and wrap it. Two validators
  would disagree, and the one the user sees would be the wrong one.
- **Two structurally identical interfaces in two packages type-check perfectly
  and drift immediately.** `GraphIssue` was declared in both
  `@hvac-saas/workflow-nodes` and `@hvac-saas/types`; assignment between them
  worked, so nothing complained — while `code` was already a closed union in one
  and a bare `string` in the other. Structural typing hides the duplication
  instead of catching it. Pick the package lowest in the dependency graph as
  canonical and leave a pointer comment in the other; a type-only re-export
  erases at compile time if a real re-export is wanted.
- **A comment claiming two functions cooperate is not the same as them
  cooperating.** `isPropertyVisible` carried a doc comment saying it was "shared
  by the config renderer and the validator so a hidden required field never
  blocks a publish" — and `getMissingRequiredFields` never called it. Choosing
  "Plain text" hides the HTML body field, so Publish would have been blocked
  forever on a control that appears nowhere on screen. When a comment asserts a
  relationship between two functions, grep for the call before trusting it.
- **Two endpoints the client treats as interchangeable must actually be
  interchangeable — and a comment asserting it does not make it so.** `POST
  /publish` returns its problem list in a 422 body, but `api-fetch` nulls `data`
  on any non-2xx, so the client re-reads that list from `GET /:id/validate`. The
  action carried a comment saying the two "return exactly the same thing by
  construction: both call the same validator". That was true when written and
  stopped being true the moment a name check was added to the publish path
  alone: publish refused an unnamed automation, the client re-read a list that
  knew nothing about names, and the dialog rendered **"There are 0 things to fix
  first"** — telling the user their automation was fine while refusing to
  publish it. The fix is to put the rule in the shared validator so the claim is
  structural, not aspirational. The tell was there in the comment: an invariant
  worth writing down is one worth enforcing in code.
- **Guard the impossible state anyway when the consequence is a lie.** Even with
  the rule shared, the client now refuses to open the problem dialog on an empty
  list and falls back to the server's own message. A dialog that says nothing is
  wrong, while the action it is explaining was refused, is worse than a plain
  error toast — it teaches the user the product is broken rather than that their
  input is.
- **A service that types its `db` as `ReturnType<typeof getDb>` cannot be called
  from inside a transaction.** A Drizzle transaction has every query method but
  no `$client`, so the bare handle type excludes it. This has now been the bug
  three times — `job-stages.service.ts` (QUO-02), `recalculateJobTotals`, and
  `availability.service.ts` — and every time it surfaced as a type error at the
  *call* site, which reads as "the caller is doing something wrong" rather than
  "this signature is too narrow". Type every service `db` parameter as
  `Omit<ReturnType<typeof getDb>, "$client">`. A full handle still satisfies it,
  so widening never breaks an existing caller.
- **When a feature needs "when is this business open", it already has an
  answer.** `services/availability.service.ts` resolves the weekly schedule plus
  date overrides and is what the booking portal, the calendar and dashboard
  rescheduling all read. Adding `tenants.quiet_hours_*` columns for workflow
  delays would have created a second definition of the same fact — the exact
  three-way drift that service was written to remove (BOOK-10, BOOK-21), where a
  contractor who closed 25 December had the portal refuse bookings while their
  own calendar showed a normal working day. A public holiday should be entered
  once.
- **A guard that blocks is not the safe choice; a guard that defers is.** The
  ported system's quiet-hours check returns `{ success: false, status:
  "blocked_quiet_hours" }`, so a follow-up due at 2am is never sent at all. The
  customer silently never hears from you, which is worse than hearing from you
  an hour early — and it is invisible, because nothing failed. Push the work to
  the next allowed moment instead. Same shape as the email opt-out gate, which
  returns a *decision with a reason* rather than a boolean.
- **A "ship gate" only gates what it asserts.** `ACTIVE_NODES` is documented as
  the list that stops the palette offering a node which would fail at run time,
  and four tests back it: every active node has a definition, an executor entry,
  an executor module on disk, and no orphans in the other direction. All four
  passed for `trigger.invoice.overdue`, which was in the palette, configurable,
  publishable — and whose event **nothing anywhere raised**. A trigger node is
  only as real as its event's producer. When a gate exists, write down what it
  does *not* cover; the gap is where the next bug lives, and here it was the
  difference between "this node can execute" and "this node can be reached".
- **A metadata field nothing reads is a comment.** The event registry recorded
  `phase: "P9"` for `invoice.overdue` — accurate, and it sat beside an active
  node the whole time. Either enforce a declaration in a test or accept it is
  prose; the dangerous middle is a field that looks authoritative and binds
  nothing.
- **Emit dedup belongs in the database, not the process.** `emitWorkflowEvent`
  has always taken a `dedupKey` enforced by a unique index, and nothing had used
  it. For an hourly sweep raising a once-per-day event, the alternative — a "done
  today" flag in module scope — is wrong on a second instance, lost on every
  deploy, and its failure mode is a customer receiving two chase emails.
- **Don't reuse another feature's claim column as an event trigger.** The E-07
  cron already sweeps overdue invoices and writes `last_overdue_reminder_at`, so
  emitting `invoice.overdue` from it looked free. It would have coupled every
  overdue automation to whether reminder *emails* were enabled — turn those off
  and the automations stop, with nothing to indicate why. Two concerns, two
  sweeps, one shared definition of "overdue".
- **"Refuses loudly" is only true if somebody is listening.** `execute()` rejected
  an over-quota run before writing anything and returned a clear message — which
  the route hands to whoever pressed Run. For an **event-triggered** run there is
  no route and no person: the refusal happened before any `workflow_executions`
  row existed, so it appeared in no run history, no notification and no toast.
  The tenant's automations would simply stop. When an early-return guard fires
  before the record that makes something visible, check every caller — one of
  them has no user attached.
- **Throttle a per-event notification by the thing that caused it, not the event.**
  A tenant over their daily cap refuses every event for the rest of the day; one
  notification per refusal turns one problem into a thousand. Key it on
  `(limit kind, day)` — the same shape as the failure notification's per-run key
  and the overdue sweep's per-invoice-per-day key.
- **`deliverNotification` and `dispatchNotification` are not interchangeable.**
  The fire-and-forget one is right on an error path, where a failing notification
  must not turn one failure into two. It is wrong when the notification is the
  *only* signal the user will get — dropping it on the floor puts you back where
  you started.
- **An index whose comment names a query nobody wrote is a to-do, not an index.**
  `idx_node_logs_started` carried the comment "the retention sweep",
  `RETENTION` had sat in `limits.ts` since P0, and
  `workflow_executions.workflow_version_id` was `ON DELETE restrict` *specifically*
  so the sweep's version check would be enforced rather than polite. All of that
  shipped; the sweep did not, and four tables grew forever. When a schema comment
  describes a component, grep for it — the surrounding design is already relying
  on it existing.
- **Retention order follows the foreign keys.** Executions must be pruned before
  versions, because `ON DELETE restrict` means a version cannot go while a run
  points at it. The other order does not error loudly — it just deletes nothing,
  every time, forever.
- **Never prune a non-terminal row on age alone.** A `waiting` run older than the
  retention window is a three-month delay somebody deliberately set. Deleting it
  cancels their automation as a side effect, with nothing anywhere saying why.
- **`NOT IN (subquery)` is a trap when the subquery can yield NULL** — the
  predicate is never true for any row, so the statement silently deletes nothing.
  `NOT EXISTS` has no such behaviour and reads the same.
