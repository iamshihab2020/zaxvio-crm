/**
 * `trigger.job.stage_changed`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every matching record in the
 * tenant, then discarding almost all of them.
 *
 * So by the time this executes the decision is already made, and it only has to
 * hand the next step something to reference.
 *
 * Reads the stage off the **loaded job**, not off the event, so a downstream
 * step referencing it sees where the job is now rather than where it was when
 * the move was recorded.
 */

import type { Executor } from "./types.js";

const triggerJobStageChanged: Executor = async ({ ctx }) => ({
  output: {
    jobId: ctx.job?.id ?? null,
    jobNumber: ctx.job?.number ?? null,
    stageName: ctx.job?.stageName ?? null,
    lifecycle: ctx.job?.stageLifecycle ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerJobStageChanged;
