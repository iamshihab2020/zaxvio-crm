# Lessons: Backend Stack (Fastify, Drizzle, Supabase, Zod)

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

## Zod Schema Migration (2026-04-05)

- **`fastify-type-provider-zod` needs `withTypeProvider<ZodTypeProvider>()` per-plugin for TypeScript inference** — The compiler is set globally in `server.ts`, but each route plugin receives an untyped `FastifyInstance`. To get full type inference on `request.body`/`request.params`/`request.query`, do `const f = fastify.withTypeProvider<ZodTypeProvider>()` inside the plugin and register all routes on `f` instead of `fastify`. Without this, the schema validates at runtime but TypeScript doesn't narrow the types.
- **Zod `z.coerce.number()` is required for all querystring numeric params** — HTTP query strings always arrive as strings (e.g., `page="1"`). Plain `z.number()` will fail validation. Use `z.coerce.number().int().min(1).default(1)` for pagination params.
- **Keep post-catalog-lookup validation guards** — For line item routes that auto-fill `description`/`unitPrice`/`itemType` from a catalog item, the Zod schema marks those fields as optional. The `if (!description || !unitPrice || !itemType)` check AFTER the catalog lookup must stay — it's business logic, not input validation.
- **Drizzle enum column casts (`as never`) are safe to keep** — Passing a Zod-typed enum string to Drizzle still requires `as never` for some pgEnum columns. This is a Drizzle type limitation, not an unsafe cast on user input. It's expected and harmless.
- **Override `limit` per-endpoint when bulk loading is needed** — `paginationQuery` caps `limit` at 100 (good for list pages), but Kanban boards need to bulk-load all pipeline jobs at once (e.g., `limit=150`). Override `limit` in the domain-specific query schema: `jobListQuery` extends `paginationQuery` and sets `.max(500)`. Never raise the global `paginationQuery` max — raise it only where the use case requires it.
- **Schema files belong to one domain** — `apps/api/src/lib/schemas/<domain>.ts` is the standard location. Maintenance contracts went into `equipment.ts` (same asset domain). Pipeline stages went into `pipelines.ts`. Co-location by domain beats file-per-table.
