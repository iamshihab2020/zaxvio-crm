/** Invoice events. Subject is always the invoice. */

import { z } from "zod";
import {
  customerRef,
  invoiceStatusSchema,
  isoDateField,
  isoDateTimeField,
  moneyField,
  paymentMethodSchema,
  uuidField,
} from "./shared.js";

const invoiceBase = {
  ...customerRef,
  invoiceId: uuidField,
  invoiceNumber: z.string(),
  status: invoiceStatusSchema,
  totalAmount: moneyField,
  amountPaid: moneyField,
  balanceDue: moneyField,
  issuedDate: isoDateField.nullable(),
  dueDate: isoDateField.nullable(),
  jobId: uuidField.nullable(),
};

export const invoiceCreatedPayload = z
  .object({
    ...invoiceBase,
    /** `job` means it was generated from completed work — the automation that
     *  wants to chase it is usually different from the one for a standalone
     *  invoice someone typed. */
    origin: z.enum(["manual", "job", "api"]),
    createdAt: isoDateTimeField,
  })
  .strict();

export const invoiceSentPayload = z
  .object({ ...invoiceBase, sentAt: isoDateTimeField })
  .strict();

/**
 * A payment landed. Fires for **every** payment, including the one that settles
 * the invoice — `invoice.paid` fires alongside it in that case.
 *
 * Two events rather than one because they answer different questions: "log the
 * deposit" wants every payment, "stop chasing them" wants only the last.
 */
export const invoicePaymentRecordedPayload = z
  .object({
    ...invoiceBase,
    paymentId: uuidField,
    amount: moneyField,
    paymentMethod: paymentMethodSchema.nullable(),
    paymentDate: isoDateField,
    /** True when this payment closed it out. Saves a filter comparing
     *  `balanceDue` to a string zero, which is a comparison people get wrong. */
    settlesInvoice: z.boolean(),
  })
  .strict();

/**
 * Emitted from `services/invoices/status.service.ts`, which **derives** status
 * from the payment rows rather than assigning it.
 *
 * That is what makes this event trustworthy. Status used to be assigned, so
 * "delete the last payment and set it to sent" was expressible and an invoice
 * could read Paid with money outstanding (INV-01/02/03). Deriving it means this
 * fires exactly when the invoice truly becomes paid — and, because derivation
 * is re-run on every mutation, it does *not* fire again when an already-paid
 * invoice is touched.
 *
 * `creditAmount` is here because an overpayment is recorded as a credit rather
 * than clamped to zero, and "you overpaid, here is your credit" is a real
 * message a tenant will want to automate.
 */
export const invoicePaidPayload = z
  .object({
    ...invoiceBase,
    creditAmount: moneyField,
    paidAt: isoDateTimeField,
    /** How long it took, in whole days from `issuedDate`. Null when the invoice
     *  was never issued with a date. Lets "thank fast payers" be one filter. */
    daysToPayment: z.number().int().nullable(),
  })
  .strict();

/**
 * P9 — from the schedule worker, at a **specific** day count the trigger node
 * configures, not once per day forever.
 *
 * Uses the same `overdueCondition()` the list, the stats endpoint and the
 * dunning cron already share. This repo had three definitions of overdue that
 * disagreed, and the disagreement meant a customer who paid half and stopped
 * was shown as overdue everywhere and never chased (INV-06). The automation
 * trigger becomes the fourth consumer of that one predicate, not a fifth
 * definition of it.
 */
export const invoiceOverduePayload = z
  .object({
    ...invoiceBase,
    daysOverdue: z.number().int().min(0),
  })
  .strict();

export const invoiceVoidedPayload = z
  .object({ ...invoiceBase, voidedAt: isoDateTimeField })
  .strict();
