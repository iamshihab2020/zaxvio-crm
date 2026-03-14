# Lessons Learned

Non-obvious insights, patterns, and mistakes worth remembering.

## Better Auth + Fastify Integration

- **Fastify consumes request body before toNodeHandler** — `toNodeHandler(auth)` hangs on POST requests because Fastify's body parser reads the stream before Better Auth can. Solution: use `auth.handler()` with a manually reconstructed Fetch API `Request` object that includes `JSON.stringify(request.body)`.
- **Better Auth admin plugin setRole requires auth session** — `auth.api.setRole()` returns 401 when called without a session. For seed scripts, update the `role` column directly via SQL instead.
- **Better Auth uses text IDs, not UUIDs** — All auth tables use `text` primary keys (random strings). FKs referencing auth tables must use `text` type, not `uuid`.
- **Better Auth table naming** — Tables must match exact names: `user`, `session`, `account`, `verification`, `organization`, `member`, `invitation`. The `user` table name conflicts with PostgreSQL's reserved keyword — must always quote it in raw SQL (`"user"`).
- **Dedicated auth DB connection** — Better Auth should get its own `postgres()` connection with `prepare: false` (for Supabase pooler). Don't share the singleton from `getDb()` to avoid lifecycle issues.
- **Cross-origin cookies with Better Auth** — Set `trustedOrigins: [env.FRONTEND_URL]` in the Better Auth config. Fastify CORS must include `credentials: true`.

## Drizzle ORM

- **Scaffold packages need placeholder `.ts` files** — TypeScript errors with `TS18003` if a `tsconfig.json` includes a dir with no `.ts` files. Add empty `export {};` index files to empty packages.
- **Root-level `typescript` and `@types/node` are required** — pnpm monorepo scaffold didn't include these as devDeps. Without them, `tsc` command not found and `process` is undefined.
- **Drizzle `generatedAlwaysAs` for computed columns** — use `sql` template tag for `GENERATED ALWAYS AS (quantity * unit_price) STORED` columns.
- **Drizzle-kit uses CJS internally** — schema imports must use extensionless paths (`"./enums"` not `"./enums.js"`), otherwise drizzle-kit push/generate fails with `Cannot find module './enums.js'`.
- **drizzle-kit push crashes on GENERATED ALWAYS AS columns** — When the DB already has tables with computed columns, `drizzle-kit push` hits `TypeError: Cannot read properties of undefined (reading 'replace')`. Workaround: drop and recreate the schema.
- **drizzle-orm version conflicts in pnpm** — When importing `eq` from `drizzle-orm` in a package that depends on another package also using `drizzle-orm`, pnpm may resolve two different copies (e.g., one with `kysely` peer, one without). This causes type errors like "Types have separate declarations of a private property 'shouldInlineParams'". Solution: use raw SQL or import from the same package.
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

## Next.js 14

- **next.config.ts not supported in Next.js 14** — Must use `.mjs` or `.js` extension. TypeScript config support was added in Next.js 15.
- **Tailwind CSS v3 required for classic PostCSS plugin** — Tailwind v4 moved the PostCSS plugin to `@tailwindcss/postcss`. Use `tailwindcss@3` with `postcss.config.mjs` + `tailwind.config.ts` pattern.
- **React 18 required for Next.js 14** — `pnpm add react react-dom` defaults to React 19, but Next.js 14 needs React 18. Explicitly install `react@18 react-dom@18`.
