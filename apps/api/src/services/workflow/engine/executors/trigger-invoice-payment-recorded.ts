/**
 * `trigger.invoice.paymentRecorded`.
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
 * `balanceDue` comes from the re-read invoice, so it is what is owed **after**
 * this payment. A receipt saying "still outstanding" needs the figure as it is
 * now, not as it was when the payment arrived.
 */

import type { Executor } from "./types.js";

const triggerInvoicePaymentRecorded: Executor = async ({ ctx }) => ({
  output: {
    invoiceId: ctx.invoice?.id ?? null,
    invoiceNumber: ctx.invoice?.number ?? null,
    total: ctx.invoice?.total ?? null,
    balanceDue: ctx.invoice?.balanceDue ?? null,
    customerId: ctx.customer?.id ?? null,
  },
});

export default triggerInvoicePaymentRecorded;
