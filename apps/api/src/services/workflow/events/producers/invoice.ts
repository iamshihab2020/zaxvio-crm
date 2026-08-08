/**
 * Invoice producers.
 *
 * `invoicePaid` is called from `services/invoices/status.service.ts`, which
 * *derives* status from the payment rows rather than assigning it. That is what
 * makes the event trustworthy: status used to be assignable, so an invoice
 * could read Paid with money outstanding (INV-01/02/03), and an automation
 * firing on that would have thanked a customer who had not paid.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import {
  daysBetween,
  isoDate,
  isoDateTime,
  money,
  type CustomerArgs,
  type ProducerContext,
} from "./shared.js";

type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "partially_paid"
  | "overdue"
  | "void";

export interface InvoiceArgs {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: string | number | null;
  amountPaid: string | number | null;
  balanceDue: string | number | null;
  issuedDate: Date | string | null;
  dueDate: Date | string | null;
  jobId: string | null;
}

interface InvoiceBaseFields {
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  invoiceId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  issuedDate: string | null;
  dueDate: string | null;
  jobId: string | null;
}

function invoiceBase(inv: InvoiceArgs, customer: CustomerArgs): InvoiceBaseFields {
  return {
    customerId: customer.id,
    customerFirstName: customer.firstName,
    customerLastName: customer.lastName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status,
    totalAmount: money(inv.totalAmount),
    amountPaid: money(inv.amountPaid),
    balanceDue: money(inv.balanceDue),
    issuedDate: isoDate(inv.issuedDate),
    dueDate: isoDate(inv.dueDate),
    jobId: inv.jobId,
  };
}

export interface InvoiceCreatedArgs extends ProducerContext {
  invoice: InvoiceArgs & { createdAt: Date | string };
  customer: CustomerArgs;
  origin: "manual" | "job" | "api";
}

export function invoiceCreated(db: EmitDb, args: InvoiceCreatedArgs) {
  const b = invoiceBase(args.invoice, args.customer);
  return emitWorkflowEvent(db, {
    type: "invoice.created",
    tenantId: args.tenantId,
    subject: { type: "invoice", id: args.invoice.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      invoiceId: b.invoiceId,
      invoiceNumber: b.invoiceNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      balanceDue: b.balanceDue,
      issuedDate: b.issuedDate,
      dueDate: b.dueDate,
      jobId: b.jobId,
      origin: args.origin,
      createdAt: isoDateTime(args.invoice.createdAt),
    },
  });
}

export interface InvoiceSentArgs extends ProducerContext {
  invoice: InvoiceArgs;
  customer: CustomerArgs;
  sentAt: Date | string;
}

export function invoiceSent(db: EmitDb, args: InvoiceSentArgs) {
  const b = invoiceBase(args.invoice, args.customer);
  return emitWorkflowEvent(db, {
    type: "invoice.sent",
    tenantId: args.tenantId,
    subject: { type: "invoice", id: args.invoice.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      invoiceId: b.invoiceId,
      invoiceNumber: b.invoiceNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      balanceDue: b.balanceDue,
      issuedDate: b.issuedDate,
      dueDate: b.dueDate,
      jobId: b.jobId,
      sentAt: isoDateTime(args.sentAt),
    },
  });
}

export interface InvoicePaymentRecordedArgs extends ProducerContext {
  invoice: InvoiceArgs;
  customer: CustomerArgs;
  payment: {
    id: string;
    amount: string | number;
    method:
      | "cash"
      | "check"
      | "credit_card"
      | "bank_transfer"
      | "other"
      | null;
    date: Date | string;
  };
  /** Whether this payment closed the invoice out. */
  settlesInvoice: boolean;
}

export function invoicePaymentRecorded(db: EmitDb, args: InvoicePaymentRecordedArgs) {
  const b = invoiceBase(args.invoice, args.customer);
  const paymentDate = isoDate(args.payment.date);
  return emitWorkflowEvent(db, {
    type: "invoice.payment_recorded",
    tenantId: args.tenantId,
    subject: { type: "invoice", id: args.invoice.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      invoiceId: b.invoiceId,
      invoiceNumber: b.invoiceNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      balanceDue: b.balanceDue,
      issuedDate: b.issuedDate,
      dueDate: b.dueDate,
      jobId: b.jobId,
      paymentId: args.payment.id,
      amount: money(args.payment.amount),
      paymentMethod: args.payment.method,
      // `payment_date` is a NOT NULL `date` column, so this cannot really be
      // null; the fallback keeps the payload valid rather than throwing on a
      // row that predates the constraint.
      paymentDate: paymentDate ?? isoDateTime(new Date()).slice(0, 10),
      settlesInvoice: args.settlesInvoice,
    },
  });
}

export interface InvoicePaidArgs extends ProducerContext {
  invoice: InvoiceArgs;
  customer: CustomerArgs;
  creditAmount: string | number | null;
  paidAt: Date | string;
}

export function invoicePaid(db: EmitDb, args: InvoicePaidArgs) {
  const b = invoiceBase(args.invoice, args.customer);
  return emitWorkflowEvent(db, {
    type: "invoice.paid",
    tenantId: args.tenantId,
    subject: { type: "invoice", id: args.invoice.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      invoiceId: b.invoiceId,
      invoiceNumber: b.invoiceNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      balanceDue: b.balanceDue,
      issuedDate: b.issuedDate,
      dueDate: b.dueDate,
      jobId: b.jobId,
      creditAmount: money(args.creditAmount),
      paidAt: isoDateTime(args.paidAt),
      daysToPayment: daysBetween(args.invoice.issuedDate, args.paidAt),
    },
  });
}

export interface InvoiceVoidedArgs extends ProducerContext {
  invoice: InvoiceArgs;
  customer: CustomerArgs;
  voidedAt: Date | string;
}

export function invoiceVoided(db: EmitDb, args: InvoiceVoidedArgs) {
  const b = invoiceBase(args.invoice, args.customer);
  return emitWorkflowEvent(db, {
    type: "invoice.voided",
    tenantId: args.tenantId,
    subject: { type: "invoice", id: args.invoice.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      invoiceId: b.invoiceId,
      invoiceNumber: b.invoiceNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      amountPaid: b.amountPaid,
      balanceDue: b.balanceDue,
      issuedDate: b.issuedDate,
      dueDate: b.dueDate,
      jobId: b.jobId,
      voidedAt: isoDateTime(args.voidedAt),
    },
  });
}
