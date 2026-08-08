/**
 * @hvac-saas/workflow-nodes — the contract the builder and the engine share.
 *
 * Raw TypeScript, no build step, matching the repo convention (`"." :
 * "./src/index.ts"`, run by tsx on the API and transpiled by Next on the web).
 *
 * It lives outside `@hvac-saas/types` on purpose: that package is inferred from
 * the Drizzle schema and imported by nearly every page, and a node registry
 * does not belong in a module you reach for to get a `Customer` type.
 */

export * from "./node-definition.js";
export * from "./categories.js";
export * from "./limits.js";
export * from "./active-nodes.js";
export * from "./catalog.js";
export * from "./events/index.js";
export * from "./format/index.js";
export * from "./execution-context.js";
export * from "./variables/index.js";
export * from "./triggers/operators.js";
export * from "./triggers/match.js";
export * from "./graph/validate.js";
export * from "./naming.js";
export * from "./conditions.js";
export * from "./templates/index.js";
