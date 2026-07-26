"use client";

import { useEventStream } from "./use-event-stream";

export interface RealtimeMessage {
  id: string;
  conversationId: string;
  tenantId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  subject: string | null;
  status: string;
  externalId: string | null;
  senderId: string | null;
  createdAt: string;
}

interface NewMessagePayload {
  conversationId: string;
  message: RealtimeMessage;
}

/**
 * Subscribes to new messages on a tenant's conversations via the API's SSE
 * stream. The stream is already scoped to the caller's tenant server-side, so
 * `tenantId` only gates whether we subscribe at all.
 */
export function useConversationRealtime(
  tenantId: string | null | undefined,
  onNewMessage: (payload: NewMessagePayload) => void,
) {
  useEventStream<NewMessagePayload>(
    "conversations",
    "new_message",
    onNewMessage,
    Boolean(tenantId),
  );
}
