/**
 * `trigger.invoice.paid`.
 *
 * Fires off `invoice.paid`, which is emitted from `recalculateInvoice()` — the
 * one place the *derived* status is written. That is what makes this trigger
 * trustworthy: status used to be assignable, so an invoice could read Paid with
 * money outstanding (INV-01/02/03), and an automation on that would have
 * thanked a customer who had not paid.
 *
 * Filters are evaluated by the matcher before enrolment (P4), not here.
 */

import type { Executor } from "./types.js";

const triggerInvoicePaid: Executor = async ({ ctx }) => ({
  output: {
    invoiceId: ctx.invoice?.id ?? null,
    invoiceNumber: ctx.invoice?.number ?? null,
    total: ctx.invoice?.total ?? null,
    amountPaid: ctx.invoice?.amountPaid ?? null,
  },
});

export default triggerInvoicePaid;
