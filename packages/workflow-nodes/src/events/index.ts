/**
 * The event taxonomy.
 *
 * Explicit re-exports, not a glob — same rule as the node registry. A glob
 * means the set of events depends on what happens to be on disk, and "why is
 * this trigger missing in production" is not a question anyone should have to
 * answer by comparing directory listings.
 */

export * from "./shared.js";
export * from "./customer.js";
export * from "./job.js";
export * from "./booking.js";
export * from "./quote.js";
export * from "./invoice.js";
export * from "./assets.js";
export * from "./messaging.js";
export * from "./system.js";
export * from "./registry.js";
export * from "./fixtures.js";
