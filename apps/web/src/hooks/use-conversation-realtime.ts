"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
 * Subscribes to Supabase Realtime for new messages on a tenant's conversations.
 * Mirrors the pattern used in use-notifications.ts.
 */
export function useConversationRealtime(
  tenantId: string | null | undefined,
  onNewMessage: (payload: NewMessagePayload) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbackRef = useRef(onNewMessage);
  callbackRef.current = onNewMessage;

  useEffect(() => {
    if (!tenantId) return;

    let mounted = true;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversations:${tenantId}`)
      .on("broadcast", { event: "new_message" }, ({ payload }) => {
        if (!mounted) return;
        callbackRef.current(payload as NewMessagePayload);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[conversations] Realtime channel subscribed");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[conversations] Realtime channel error");
        }
      });

    channelRef.current = channel;

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [tenantId]);
}
