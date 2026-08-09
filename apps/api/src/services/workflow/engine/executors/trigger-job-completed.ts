/**
 * `trigger.job.completed`.
 *
 * **The filters on this node are not evaluated here.** They are declared on the
 * definition's properties (`filter: { path, operator }`) and evaluated by the
 * trigger matcher *before* a run is created — P4. Matching at execution time
 * would mean creating a run, loading its context and writing log rows for every
 * completed job in the tenant, then discarding almost all of them.
 *
 * So this is the same no-op the manual trigger is: by the time it executes, the
 * decision has already been made.
 */

import type { Executor } from "./types.js";

const triggerJobCompleted: Executor = async ({ ctx }) => ({
  output: {
    jobId: ctx.job?.id ?? null,
    jobNumber: ctx.job?.number ?? null,
    completedAt: ctx.job?.completedAt ?? null,
    total: ctx.job?.total ?? null,
  },
});

export default triggerJobCompleted;
