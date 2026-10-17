/**
 * Browser reads for conversations: the TanStack Query side of
 * `@/actions/conversations`. Mirrors the server actions exactly, including their
 * `Conversation[]` / `Message[]` typing; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/conversations";
import type { Conversation, Message } from "@/actions/conversations";
import { pickQuery, readJson } from "@/lib/api-client";

const CONVERSATION_LIST_KEYS = ["page", "limit", "channel", "status", "customerId"] as const;

export async function getConversations(params?: Parameters<typeof actions.getConversations>[0]) {
  const r = await readJson(
    `/conversations${pickQuery(params, CONVERSATION_LIST_KEYS)}`,
    "Failed to load conversations",
  );
  // The action says this for any refusal and never shows the API's own message;
  // only a failed request (status 0) reads differently.
  if (!r.ok) {
    return { data: null, error: r.status === 0 ? r.error : "Failed to load conversations" };
  }
  return {
    data: r.json.data as Conversation[],
    pagination: r.json.pagination,
    error: null,
  };
}

export async function getConversationMessages(conversationId: string, cursor?: string) {
  const qs = new URLSearchParams({ limit: "50" });
  if (cursor) qs.set("cursor", cursor);

  const r = await readJson(
    `/conversations/${conversationId}/messages?${qs}`,
    "Failed to load messages",
  );
  if (!r.ok) return { data: null, error: r.status === 0 ? r.error : "Failed to load messages" };
  return { data: r.json.data as Message[], error: null };
}
