/** Customer producers. Every field written out; see `./shared.ts` for why. */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import { isoDateTime, type CustomerArgs, type ProducerContext } from "./shared.js";

export interface CustomerCreatedArgs extends ProducerContext {
  customer: CustomerArgs & {
    city: string | null;
    state: string | null;
    zipCode: string | null;
    createdAt: Date | string;
  };
  source: "manual" | "booking" | "quote" | "import" | "api";
}

export function customerCreated(db: EmitDb, args: CustomerCreatedArgs) {
  const c = args.customer;
  return emitWorkflowEvent(db, {
    type: "customer.created",
    tenantId: args.tenantId,
    subject: { type: "customer", id: c.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      source: args.source,
      city: c.city,
      state: c.state,
      zipCode: c.zipCode,
      createdAt: isoDateTime(c.createdAt),
    },
  });
}

export interface CustomerUpdatedArgs extends ProducerContext {
  customer: CustomerArgs;
  changedFields: string[];
}

export function customerUpdated(db: EmitDb, args: CustomerUpdatedArgs) {
  const c = args.customer;
  return emitWorkflowEvent(db, {
    type: "customer.updated",
    tenantId: args.tenantId,
    subject: { type: "customer", id: c.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      changedFields: args.changedFields,
    },
  });
}

export interface CustomerTagArgs extends ProducerContext {
  customer: CustomerArgs;
  tag: { id: string; name: string };
}

export function customerTagAdded(db: EmitDb, args: CustomerTagArgs) {
  const c = args.customer;
  return emitWorkflowEvent(db, {
    type: "customer.tag_added",
    tenantId: args.tenantId,
    subject: { type: "customer", id: c.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      tagId: args.tag.id,
      tagName: args.tag.name,
    },
  });
}

export function customerTagRemoved(db: EmitDb, args: CustomerTagArgs) {
  const c = args.customer;
  return emitWorkflowEvent(db, {
    type: "customer.tag_removed",
    tenantId: args.tenantId,
    subject: { type: "customer", id: c.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      tagId: args.tag.id,
      tagName: args.tag.name,
    },
  });
}
