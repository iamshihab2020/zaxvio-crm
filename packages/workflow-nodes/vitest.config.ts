import { defineConfig } from "vitest/config";

/**
 * Registry invariants only. No database, no network, no environment — these
 * tests read the node registry and the variable table and assert the rules in
 * docs/workflow-automation/wf-04-node-catalog.md §4.3.
 *
 * They must stay fast enough to run on every save, because their whole value is
 * catching a renamed node id or a filter path that resolves to nothing *before*
 * it reaches a saved automation.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
