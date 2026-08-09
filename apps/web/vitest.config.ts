import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Web unit tests — pure functions only.
 *
 * The builder's correctness that is worth testing is not visual: the node
 * constructor seeding defaults, the graph validator's error set, relink-on-
 * delete, `displayOptions` evaluation, variable pill round-tripping. All of it
 * is plain TypeScript.
 *
 * Deliberately no canvas snapshot tests. They are brittle and they test React
 * Flow rather than us.
 *
 * Playwright owns `test:e2e` and is not touched here.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules/**", "tests/**", ".next/**"],
    environment: "node",
    // Builder tests arrive in P5. See the note in apps/api/vitest.config.ts.
    passWithNoTests: true,
  },
});
