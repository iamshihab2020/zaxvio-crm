/**
 * Every producer, one per event.
 *
 * Import from here, never from a domain file directly — the barrel is what
 * makes "is there already a producer for this?" a one-file question.
 *
 * ## The rule, restated because it is the whole point
 *
 * > **No object spread in this directory.** Every payload field is written out
 * > by name.
 *
 * Enforced by `src/test/workflow-producers.test.ts`, which reads every file in
 * this directory with comments stripped and fails on a single `...`. It is a
 * test rather than a lint rule because this repo has no ESLint configuration at
 * all, and introducing one to the whole codebase as a side effect of a workflow
 * phase is not a trade worth making.
 *
 * The alternative — a `...row` that compiles fine — is how the reference
 * implementation shipped a payload keyed `pipeline_stage_id` to a consumer
 * reading `stageId` and lost every stage-filtered automation for months.
 */

export * from "./shared.js";
export * from "./customer.js";
export * from "./job.js";
export * from "./booking.js";
export * from "./quote.js";
export * from "./invoice.js";
export * from "./misc.js";
export * from "./assets.js";
export * from "./schedule.js";
