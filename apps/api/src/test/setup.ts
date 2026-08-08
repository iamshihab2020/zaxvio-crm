import { config } from "dotenv";
import { resolve } from "node:path";

/**
 * Test bootstrap. Runs before every suite in both configs.
 *
 * Deliberately does NOT import `lib/env.ts`: that module calls
 * `process.exit(1)` on a validation failure, which inside a test runner kills
 * the whole run with no useful output. Unit tests need no environment at all,
 * and integration tests need exactly one variable — so we load the same file
 * `lib/env.ts` loads and check that one thing ourselves.
 */

config({ path: resolve(import.meta.dirname, "../../../../.env") });

process.env.NODE_ENV ??= "test";

/**
 * Guard rails for tests that reach the database.
 *
 * Call from a suite's `beforeAll`. Skipping loudly beats failing with
 * "connect ECONNREFUSED" forty times.
 */
export function requireDatabase(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Integration tests run against the real Neon " +
        "database inside a transaction that is always rolled back — see " +
        "src/test/db.ts. Set it in the repo root .env.",
    );
  }
}

/**
 * A fixed instant every time-sensitive test sits at, unless it says otherwise.
 *
 * 2026-11-01T13:00:00Z is 8:00 AM in America/Chicago — inside business hours,
 * on the day *before* US daylight saving ends. Delay maths, quiet hours and
 * "tomorrow at 9am" all have a DST boundary within 24 hours of here, which is
 * exactly where those calculations go wrong.
 */
export const TEST_NOW = new Date("2026-11-01T13:00:00.000Z");
