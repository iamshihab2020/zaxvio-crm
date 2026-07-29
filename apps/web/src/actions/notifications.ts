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

export async function getNotifications(params?: {
  limit?: number;
  cursor?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.cursor) searchParams.set("cursor", params.cursor);

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/notifications${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        nextCursor: null,
        error: err.message ?? "Failed to fetch notifications",
      };
    }

    const json = await res.json();
    return { data: json.data, nextCursor: json.nextCursor, error: null };
  } catch {
    return {
      data: null,
      nextCursor: null,
      error: "Failed to fetch notifications",
    };
  }
}

export async function getUnreadNotificationCount() {
  try {
    const res = await fetch(`${API_URL}/notifications/unread-count`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      return { count: 0, error: "Failed to fetch unread count" };
    }

    const json = await res.json();
    return { count: json.count, error: null };
  } catch {
    return { count: 0, error: "Failed to fetch unread count" };
  }
}

export async function markNotificationRead(id: string) {
  try {
    const res = await fetch(`${API_URL}/notifications/${id}/read`, {
      method: "PATCH",
      headers: { cookie: await getCookieHeader() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to mark as read" };
    }

    return { error: null };
  } catch {
    return { error: "Failed to mark as read" };
  }
}

export async function markAllNotificationsRead() {
  try {
    const res = await fetch(`${API_URL}/notifications/read-all`, {
      method: "PATCH",
      headers: { cookie: await getCookieHeader() },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to mark all as read" };
    }

    return { error: null };
  } catch {
    return { error: "Failed to mark all as read" };
  }
}

export async function getNotificationPreferences() {
  try {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch preferences" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Failed to fetch preferences" };
  }
}

export async function updateNotificationPreferences(
  preferences: Array<{
    type: string;
    inApp: boolean;
    email: boolean;
    sms: boolean;
    voice: boolean;
  }>,
) {
  try {
    const res = await fetch(`${API_URL}/notifications/preferences`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ preferences }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to update preferences" };
    }

    return { error: null };
  } catch {
    return { error: "Failed to update preferences" };
  }
}
