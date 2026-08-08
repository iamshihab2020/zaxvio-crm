/**
 * The remaining P2 producers: equipment creation and inbound messages.
 *
 * The other asset events (`equipment.warranty_expiring`, `contract.visit_due`,
 * `contract.expiring`) are **derived** — nothing writes them, a daily sweep
 * notices a date has arrived — so their producers land with the schedule worker
 * in P9 rather than here. Writing them now would mean writing them against a
 * worker that does not exist, which is how a producer ends up emitting a shape
 * nothing ever consumes.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import {
  isoDate,
  isoDateTime,
  type CustomerArgs,
  type ProducerContext,
} from "./shared.js";

export interface EquipmentCreatedArgs extends ProducerContext {
  equipment: {
    id: string;
    equipmentType: string;
    brand: string | null;
    model: string | null;
    serialNumber: string | null;
    location: string | null;
    installDate: Date | string | null;
    warrantyExpiry: Date | string | null;
    createdAt: Date | string;
  };
  customer: CustomerArgs;
}

export function equipmentCreated(db: EmitDb, args: EquipmentCreatedArgs) {
  const e = args.equipment;
  const c = args.customer;
  return emitWorkflowEvent(db, {
    type: "equipment.created",
    tenantId: args.tenantId,
    subject: { type: "equipment", id: e.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      equipmentId: e.id,
      equipmentType: e.equipmentType,
      brand: e.brand,
      model: e.model,
      serialNumber: e.serialNumber,
      location: e.location,
      installDate: isoDate(e.installDate),
      warrantyExpiry: isoDate(e.warrantyExpiry),
      createdAt: isoDateTime(e.createdAt),
    },
  });
}

/** Matches the payload's cap. Enforced here so the parse never has to refuse. */
const PREVIEW_LIMIT = 2000;

export interface MessageReceivedArgs extends ProducerContext {
  customer: CustomerArgs;
  conversationId: string;
  message: {
    id: string;
    channel: "email" | "sms";
    subject: string | null;
    body: string;
    receivedAt: Date | string;
  };
}

export function messageReceived(db: EmitDb, args: MessageReceivedArgs) {
  const c = args.customer;
  const m = args.message;
  const body = m.body ?? "";
  const truncated = body.length > PREVIEW_LIMIT;
  return emitWorkflowEvent(db, {
    type: "message.received",
    tenantId: args.tenantId,
    // The subject is the **customer**, not the conversation: the automation a
    // tenant writes here is about the person ("if they reply, stop chasing
    // them"), and a conversation id is not something any other node can act on.
    subject: { type: "customer", id: c.id },
    actorUserId: args.actorUserId,
    payload: {
      customerId: c.id,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone,
      conversationId: args.conversationId,
      messageId: m.id,
      channel: m.channel,
      subject: m.subject,
      // The full body is already in `conversation_messages`. A queue row is not
      // a message store, and an unbounded inbound email — signatures, quoted
      // history, base64 that survived a parser — would land in a jsonb column
      // that fans out per subscriber.
      preview: truncated ? body.slice(0, PREVIEW_LIMIT) : body,
      truncated,
      receivedAt: isoDateTime(m.receivedAt),
    },
  });
}
