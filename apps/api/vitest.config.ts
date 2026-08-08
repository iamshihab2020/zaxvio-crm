import { defineConfig } from "vitest/config";

/**
 * Unit tests — no database, no network, no environment.
 *
 * Pure functions only: graph traversal, the filter matcher, variable
 * interpolation, delay maths, guards. Fast enough to run on every save, which
 * is the whole point — the engine's correctness lives in exactly these places
 * and none of it is visible on a screen.
 *
 * Anything that needs Postgres goes in vitest.integration.config.ts.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    // Deterministic by construction: a test that reaches for the real clock is
    // a test that fails at midnight in one timezone.
    fakeTimers: { toFake: ["Date"] },
    // The engine's unit tests arrive in P3. Until then `pnpm test` should
    // report "nothing to run" rather than failing the whole turbo pipeline —
    // a red build for a suite that does not exist yet trains people to ignore
    // red builds.
    passWithNoTests: true,
  },
});
