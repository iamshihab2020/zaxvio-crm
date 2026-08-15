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
 *     or:  pnpm db:apply supabase/migrations/20260815000001_....sql
 *
 * ## Why it takes the basename
 *
 * The argument used to be joined onto `supabase/migrations/` as given, so
 * passing the path — which is what shell tab-completion produces, every time —
 * resolved to `supabase/migrations/supabase/migrations/...` and died with a raw
 * ENOENT stack that named the doubled path but not the reason. Every one of
 * these files lives in that one directory, so the directory is the invariant and
 * the basename is the only part of the argument that carries information.
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "../../../.env") });

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: pnpm db:apply <filename.sql>");
  console.error("Files live in supabase/migrations/");
  process.exit(1);
}

const dir = resolve(here, "../../../supabase/migrations");
const name = basename(arg);
const path = resolve(dir, name);

let text: string;
try {
  text = await readFile(path, "utf8");
} catch {
  // A stack trace here says "open failed" and buries which file was wanted. The
  // question the reader has is "is it named what I think it is", so answer that.
  console.error(`No such migration: ${name}`);
  console.error(`Looked in: ${dir}`);
  process.exit(1);
}

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
