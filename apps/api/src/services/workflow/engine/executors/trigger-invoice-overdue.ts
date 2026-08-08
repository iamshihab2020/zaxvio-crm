/**
 * `trigger.invoice.overdue`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every matching record in the
 * tenant, then discarding almost all of them.
 *
 * So by the time this executes the decision is already made, and it only has to
 * hand the next step something to reference.
 */

import type { Executor } from "./types.js";

const triggerInvoiceOverdue: Executor = async ({ ctx }) => ({
  output: {
    subjectId: ctx.subject?.id ?? null,
    subjectType: ctx.subject?.type ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerInvoiceOverdue;
