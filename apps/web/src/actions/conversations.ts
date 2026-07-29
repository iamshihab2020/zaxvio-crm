"use server";

import { cookies } from "next/headers";

import { API_URL } from "@/lib/api-url";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  tenantId: string;
  customerId: string;
  channel: "sms" | "email";
  subject: string | null;
  status: string;
  lastMessageAt: string | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string | null;
  customerPhone: string | null;
}

export interface Message {
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

// ── Actions ────────────────────────────────────────────────────────────────

export async function getConversations(params?: {
  page?: number;
  limit?: number;
  channel?: "sms" | "email";
  status?: "active" | "archived";
  customerId?: string;
}) {
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.channel) qs.set("channel", params.channel);
    if (params?.status) qs.set("status", params.status);
    if (params?.customerId) qs.set("customerId", params.customerId);

    const res = await fetch(
      `${API_URL}/conversations${qs.toString() ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );
    if (!res.ok) return { data: null, error: "Failed to load conversations" };
    const json = await res.json();
    return {
      data: json.data as Conversation[],
      pagination: json.pagination,
      error: null,
    };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getOrCreateConversation(
  customerId: string,
  channel: "sms" | "email",
  subject?: string,
) {
  try {
    const res = await fetch(`${API_URL}/conversations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ customerId, channel, subject }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: (err as { error?: string }).error ?? "Failed to create conversation",
      };
    }
    const json = await res.json();
    return { data: json.data as Conversation, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getConversationMessages(
  conversationId: string,
  cursor?: string,
) {
  try {
    const qs = new URLSearchParams({ limit: "50" });
    if (cursor) qs.set("cursor", cursor);

    const res = await fetch(
      `${API_URL}/conversations/${conversationId}/messages?${qs}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );
    if (!res.ok) return { data: null, error: "Failed to load messages" };
    const json = await res.json();
    return { data: json.data as Message[], error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function sendMessage(
  conversationId: string,
  body: string,
  subject?: string,
) {
  try {
    const res = await fetch(
      `${API_URL}/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: await getCookieHeader(),
        },
        body: JSON.stringify({ body, subject }),
      },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: (err as { error?: string }).error ?? "Failed to send message",
      };
    }
    const json = await res.json();
    return { data: json.data as Message, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function markConversationRead(conversationId: string) {
  try {
    const res = await fetch(`${API_URL}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ action: "read" }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}

export async function archiveConversation(conversationId: string) {
  try {
    const res = await fetch(`${API_URL}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ action: "archive" }),
    });
    return { success: res.ok };
  } catch {
    return { success: false };
  }
}
