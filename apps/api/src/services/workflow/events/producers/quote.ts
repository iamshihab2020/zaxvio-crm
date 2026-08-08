/**
 * Quote producers.
 *
 * `quoteSent` is called at the **end** of the send path, after the access token
 * and the PDF exist. A `draft → sent` flip without them leaves a quote the
 * portal cannot open and that `/send`, `PATCH` and `DELETE` all then refuse
 * (QUO-01) — an automation firing there would email a link to a 404.
 *
 * `quoteAccepted` and `quoteDeclined` are called from inside the
 * `SELECT … FOR UPDATE` that claims the response, so an accept racing a decline
 * produces exactly one event, matching the one outcome recorded.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import {
  isoDate,
  isoDateTime,
  money,
  type CustomerArgs,
  type ProducerContext,
} from "./shared.js";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

export interface QuoteArgs {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  totalAmount: string | number | null;
  subtotal: string | number | null;
  issuedDate: Date | string | null;
  expiryDate: Date | string | null;
}

interface QuoteBaseFields {
  customerId: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  quoteId: string;
  quoteNumber: string;
  status: QuoteStatus;
  totalAmount: string;
  subtotal: string;
  issuedDate: string | null;
  expiryDate: string | null;
}

function quoteBase(q: QuoteArgs, customer: CustomerArgs): QuoteBaseFields {
  return {
    customerId: customer.id,
    customerFirstName: customer.firstName,
    customerLastName: customer.lastName,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    quoteId: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    totalAmount: money(q.totalAmount),
    subtotal: money(q.subtotal),
    issuedDate: isoDate(q.issuedDate),
    expiryDate: isoDate(q.expiryDate),
  };
}

export interface QuoteCreatedArgs extends ProducerContext {
  quote: QuoteArgs & { createdAt: Date | string };
  customer: CustomerArgs;
  lineItemCount: number;
}

export function quoteCreated(db: EmitDb, args: QuoteCreatedArgs) {
  const b = quoteBase(args.quote, args.customer);
  return emitWorkflowEvent(db, {
    type: "quote.created",
    tenantId: args.tenantId,
    subject: { type: "quote", id: args.quote.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      quoteId: b.quoteId,
      quoteNumber: b.quoteNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      subtotal: b.subtotal,
      issuedDate: b.issuedDate,
      expiryDate: b.expiryDate,
      lineItemCount: args.lineItemCount,
      createdAt: isoDateTime(args.quote.createdAt),
    },
  });
}

export interface QuoteSentArgs extends ProducerContext {
  quote: QuoteArgs;
  customer: CustomerArgs;
  onlineAcceptanceEnabled: boolean;
  sentAt: Date | string;
}

export function quoteSent(db: EmitDb, args: QuoteSentArgs) {
  const b = quoteBase(args.quote, args.customer);
  return emitWorkflowEvent(db, {
    type: "quote.sent",
    tenantId: args.tenantId,
    subject: { type: "quote", id: args.quote.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      quoteId: b.quoteId,
      quoteNumber: b.quoteNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      subtotal: b.subtotal,
      issuedDate: b.issuedDate,
      expiryDate: b.expiryDate,
      onlineAcceptanceEnabled: args.onlineAcceptanceEnabled,
      sentAt: isoDateTime(args.sentAt),
    },
  });
}

export interface QuoteAcceptedArgs extends ProducerContext {
  quote: QuoteArgs;
  customer: CustomerArgs;
  acceptedAt: Date | string;
  requestedDate: Date | string | null;
  requestedTime: string | null;
  convertedToJobId: string | null;
}

export function quoteAccepted(db: EmitDb, args: QuoteAcceptedArgs) {
  const b = quoteBase(args.quote, args.customer);
  return emitWorkflowEvent(db, {
    type: "quote.accepted",
    tenantId: args.tenantId,
    subject: { type: "quote", id: args.quote.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      quoteId: b.quoteId,
      quoteNumber: b.quoteNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      subtotal: b.subtotal,
      issuedDate: b.issuedDate,
      expiryDate: b.expiryDate,
      acceptedAt: isoDateTime(args.acceptedAt),
      requestedDate: isoDate(args.requestedDate),
      requestedTime: args.requestedTime,
      convertedToJobId: args.convertedToJobId,
    },
  });
}

export interface QuoteDeclinedArgs extends ProducerContext {
  quote: QuoteArgs;
  customer: CustomerArgs;
  reason: string | null;
  declinedAt: Date | string;
}

export function quoteDeclined(db: EmitDb, args: QuoteDeclinedArgs) {
  const b = quoteBase(args.quote, args.customer);
  return emitWorkflowEvent(db, {
    type: "quote.declined",
    tenantId: args.tenantId,
    subject: { type: "quote", id: args.quote.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      quoteId: b.quoteId,
      quoteNumber: b.quoteNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      subtotal: b.subtotal,
      issuedDate: b.issuedDate,
      expiryDate: b.expiryDate,
      reason: args.reason,
      declinedAt: isoDateTime(args.declinedAt),
    },
  });
}

export interface QuoteExpiredArgs extends ProducerContext {
  quote: QuoteArgs;
  customer: CustomerArgs;
  expiredAt: Date | string;
}

export function quoteExpired(db: EmitDb, args: QuoteExpiredArgs) {
  const b = quoteBase(args.quote, args.customer);
  return emitWorkflowEvent(db, {
    type: "quote.expired",
    tenantId: args.tenantId,
    subject: { type: "quote", id: args.quote.id },
    actorUserId: args.actorUserId,
    // The sweep runs hourly and re-selects on a date predicate, so without a
    // key a quote could be enqueued on two consecutive ticks if the status
    // write and the emit ever came apart. One event per quote, ever.
    dedupKey: `quote.expired:${args.quote.id}`,
    payload: {
      customerId: b.customerId,
      customerFirstName: b.customerFirstName,
      customerLastName: b.customerLastName,
      customerEmail: b.customerEmail,
      customerPhone: b.customerPhone,
      quoteId: b.quoteId,
      quoteNumber: b.quoteNumber,
      status: b.status,
      totalAmount: b.totalAmount,
      subtotal: b.subtotal,
      issuedDate: b.issuedDate,
      expiryDate: b.expiryDate,
      expiredAt: isoDateTime(args.expiredAt),
    },
  });
}
