/**
 * Browser reads for notifications: the TanStack Query side of
 * `@/actions/notifications`. Same signatures, query keys, error text and return
 * shapes as the server actions; see lib/api-client.ts for why.
 */
import type * as actions from "@/actions/notifications";
import { pickQuery, readJson } from "@/lib/api-client";

const NOTIFICATION_LIST_KEYS = ["limit", "cursor"] as const;

export async function getNotifications(params?: Parameters<typeof actions.getNotifications>[0]) {
  const r = await readJson(
    `/notifications${pickQuery(params, NOTIFICATION_LIST_KEYS)}`,
    "Failed to fetch notifications",
  );
  if (!r.ok) return { data: null, nextCursor: null, error: r.error };
  return { data: r.json.data, nextCursor: r.json.nextCursor, error: null };
}

export async function getUnreadNotificationCount() {
  const r = await readJson("/notifications/unread-count", "Failed to fetch unread count");
  if (!r.ok) return { count: 0, error: "Failed to fetch unread count" };
  return { count: r.json.count, error: null };
}

export async function getNotificationPreferences() {
  const r = await readJson("/notifications/preferences", "Failed to fetch preferences");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
