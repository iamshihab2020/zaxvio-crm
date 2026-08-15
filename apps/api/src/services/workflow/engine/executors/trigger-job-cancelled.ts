/**
 * `trigger.job.cancelled`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every record in the tenant,
 * then throwing almost all of them away.
 *
 * By the time this executes the decision is already made, so it only has to hand
 * the next step something to reference.
 */

import type { Executor } from "./types.js";

const triggerJobCancelled: Executor = async ({ ctx }) => ({
  output: {
    jobId: ctx.job?.id ?? null,
    jobNumber: ctx.job?.number ?? null,
    title: ctx.job?.title ?? null,
    serviceType: ctx.job?.serviceType ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerJobCancelled;
