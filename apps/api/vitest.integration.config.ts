import { defineConfig } from "vitest/config";

/**
 * Integration tests — real Neon, every test wrapped in a transaction that is
 * always rolled back (see src/test/db.ts).
 *
 * SERIAL, deliberately. One database, one connection pool, and several of these
 * tests assert on concurrency (two workers claiming the same queue rows, a goal
 * exit racing a delay pause). Running them in parallel would make them fight
 * each other rather than the thing under test.
 *
 * These are the tests that cover what unit tests cannot: durable pause and
 * resume, compare-and-set transitions, unique-index enrollment, and the
 * cross-tenant assertions that matter because there is no row-level security
 * underneath them.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
    // A hung transaction against a remote database is the likeliest failure
    // mode here, and a default 5s timeout would report it as a logic error.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
