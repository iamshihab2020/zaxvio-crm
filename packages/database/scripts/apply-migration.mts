/**
 * Apply one hand-written migration file.
 *
 * ## Why this exists rather than `pnpm db:migrate`
 *
 * `db:migrate` is `drizzle-kit migrate`, which applies what is listed in
 * `supabase/migrations/meta/_journal.json` — and 32 of the files in that folder
 * are not listed, because they were written by hand. Worse, drizzle's own
 * tracking table (`drizzle.__drizzle_migrations`) is **empty**, so `db:migrate`
 * tries to replay the journal from the very beginning and dies on
 * `CREATE TYPE booking_status` — a type that has existed for months. The whole
 * run is one transaction, so it rolls back and changes nothing, but it also
 * never applies anything, ever.
 *
 * Running `db:generate` first makes it worse: drizzle diffs the schema against
 * the journal rather than against the database, so it emits a 28 KB migration
 * recreating everything already applied by hand.
 *
 * So hand-written migrations are applied here, one named file at a time.
 *
 * ## Why `.simple()`
 *
 * Without it postgres.js uses the extended protocol, which permits exactly one
 * statement per call — and a migration file is many. The trade-off is worth
 * naming: a multi-statement simple query is an *implicit transaction*, so the
 * file is all-or-nothing (good), but a new enum value added in the file cannot
 * be used by a later statement in the same file.
 *
 * Usage:  pnpm db:apply 20260815000001_workflow_webhooks_and_schedules.sql
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

const name = process.argv[2];
if (!name) {
  console.error("Usage: pnpm db:apply <filename.sql>");
  console.error("Files live in supabase/migrations/");
  process.exit(1);
}

const path = resolve(here, "../../../supabase/migrations", name);
const text = await readFile(path, "utf8");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. It lives in the repo-root .env, not in any package.");
  process.exit(1);
}

const notices: string[] = [];
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  // Re-running an idempotent migration should be NOTICE-only. Capturing them is
  // how that is proven rather than assumed.
  onnotice: (n) => notices.push(`${n.severity}: ${n.message}`),
});

console.log(`Applying ${name} (${text.length} bytes)...`);

try {
  await sql.unsafe(text).simple();
  console.log("Applied.");
  if (notices.length) {
    console.log(`\n${notices.length} notice(s):`);
    for (const n of notices) console.log("  ", n);
  } else {
    console.log("No notices (first application).");
  }
} catch (err) {
  // The cause is the half that matters: DrizzleQueryError-style messages carry
  // the statement, and the PostgresError underneath carries the code and the
  // actual reason. Logging only the outer message is how `last_error` ended up
  // recording what failed and never why.
  const cause = (err as { cause?: unknown }).cause ?? err;
  console.error("FAILED — nothing was applied (the file runs as one implicit transaction).");
  console.error(cause);
  process.exitCode = 1;
} finally {
  await sql.end();
}
