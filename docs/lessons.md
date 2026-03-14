# Lessons Learned

Non-obvious insights, patterns, and mistakes worth remembering.

- **Scaffold packages need placeholder `.ts` files** — TypeScript errors with `TS18003` if a `tsconfig.json` includes a dir with no `.ts` files. Add empty `export {};` index files to empty packages.
- **Root-level `typescript` and `@types/node` are required** — pnpm monorepo scaffold didn't include these as devDeps. Without them, `tsc` command not found and `process` is undefined.
- **Drizzle `generatedAlwaysAs` for computed columns** — use `sql` template tag for `GENERATED ALWAYS AS (quantity * unit_price) STORED` columns.
- **Drizzle-kit uses CJS internally** — schema imports must use extensionless paths (`"./enums"` not `"./enums.js"`), otherwise drizzle-kit push/generate fails with `Cannot find module './enums.js'`.
- **Supabase pooler URL matters** — `aws-0` vs `aws-1` in the pooler hostname causes "Tenant or user not found" errors. Always copy the exact URL from the Supabase dashboard.
- **Password URL-encoding for DATABASE_URL** — special chars in DB passwords (`!`, `&`, `@`) must be percent-encoded (`%21`, `%26`, `%40`) in connection strings.
- **drizzle.config.ts needs dotenv** — `process.env.DATABASE_URL` is undefined without explicitly loading `.env`. Use `import { config } from "dotenv"` with `path: "../../.env"` to load from monorepo root.
- **FK name auto-truncation** — Postgres truncates identifiers over 63 chars. Long FK names like `job_checklist_completions_checklist_item_id_checklist_items_id_fk` get truncated. Harmless but produces a NOTICE.
