/**
 * Inbound messaging. Subject is the customer, not the conversation — the
 * automation a tenant writes here is about the person ("if a customer replies,
 * pause the follow-up sequence"), and a conversation id is not something any
 * other node can do anything with.
 */

import { z } from "zod";
import {
  conversationChannelSchema,
  customerRef,
  isoDateTimeField,
  uuidField,
} from "./shared.js";

export const messageReceivedPayload = z
  .object({
    ...customerRef,
    conversationId: uuidField,
    messageId: uuidField,
    channel: conversationChannelSchema,
    subject: z.string().nullable(),
    /**
     * Truncated hard at 2,000 characters.
     *
     * The full body already lives in `conversation_messages`; this copy exists
     * so a filter can say "contains 'cancel'" and so a notification can quote
     * the opening line. A queue row is not a message store, and an unbounded
     * inbound body would put an entire forwarded email thread — signatures,
     * quoted history, attachments-as-text — into a jsonb column that fans out
     * one row per subscriber.
     */
    preview: z.string().max(2000),
    truncated: z.boolean(),
    receivedAt: isoDateTimeField,
  })
  .strict();
