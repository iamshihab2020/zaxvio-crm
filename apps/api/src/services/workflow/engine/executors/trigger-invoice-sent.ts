/**
 * `trigger.invoice.sent`.
 *
 * **The filters are not evaluated here.** They are declared on the definition's
 * properties (`filter: { path, operator }`) and evaluated by the trigger matcher
 * *before* a run is created. Matching at execution time would mean creating a
 * run, loading its context and writing log rows for every record in the tenant,
 * then throwing almost all of them away.
 *
 * By the time this executes the decision is already made, so it only has to hand
 * the next step something to reference.
 *
 * `dueDate` is on the output because the useful automation here anchors a Wait
 * on it — a nudge two days *before* the due date, rather than a chase after.
 */

import type { Executor } from "./types.js";

const triggerInvoiceSent: Executor = async ({ ctx }) => ({
  output: {
    invoiceId: ctx.invoice?.id ?? null,
    invoiceNumber: ctx.invoice?.number ?? null,
    total: ctx.invoice?.total ?? null,
    dueDate: ctx.invoice?.dueDate ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerInvoiceSent;
