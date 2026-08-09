/**
 * `trigger.job.assigned`.
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
 * `assigneeId` may be null: this fires on *un*assignment too, which the event
 * schema calls out and which is worth automating on.
 */

import type { Executor } from "./types.js";

const triggerJobAssigned: Executor = async ({ ctx }) => ({
  output: {
    jobId: ctx.job?.id ?? null,
    jobNumber: ctx.job?.number ?? null,
    assigneeId: ctx.assignee?.id ?? null,
    assigneeName: ctx.job?.assigneeName ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerJobAssigned;
