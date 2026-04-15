import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getConversations,
  getConversationMessages,
  sendMessage,
  markConversationRead,
  archiveConversation,
} from "@/actions/conversations";

// ── Queries ──────────────────────────────────────────────────

export function useConversations(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.conversations.list(params),
    queryFn: () => getConversations(params as Parameters<typeof getConversations>[0]),
    staleTime: 0, // conversations are real-time
  });
}

export function useConversationMessages(
  conversationId: string,
  cursor?: string,
) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(conversationId, cursor ? { cursor } : undefined),
    queryFn: () => getConversationMessages(conversationId, cursor),
    enabled: !!conversationId,
    staleTime: 0,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      body,
      subject,
    }: {
      conversationId: string;
      body: string;
      subject?: string;
    }) => sendMessage(conversationId, body, subject),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: () => toast.error("Failed to send message"),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markConversationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archiveConversation(id),
    onSuccess: () => {
      toast.success("Conversation archived");
      qc.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
    onError: () => toast.error("Failed to archive conversation"),
  });
}
