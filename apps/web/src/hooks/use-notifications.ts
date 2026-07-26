"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notifications";
import { useEventStream } from "./use-event-stream";

interface NotificationItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  isRead: boolean;
}

/** Broadcast payload — the notification row without the per-user read flag. */
type NotificationPayload = Omit<NotificationItem, "isRead">;

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = session?.user?.id;

  // Load initial data
  useEffect(() => {
    let mounted = true;

    async function load() {
      const [notifResult, countResult] = await Promise.all([
        getNotifications({ limit: 20 }),
        getUnreadNotificationCount(),
      ]);

      if (!mounted) return;

      if (notifResult.data) {
        setNotifications(notifResult.data);
      }
      setUnreadCount(countResult.count);
      setIsLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to real-time notifications. The SSE stream is scoped to the
  // caller's tenant server-side, so no tenant lookup is needed here.
  useEventStream<NotificationPayload>("notifications", "new_notification", (payload) => {
    // Skip if this user is the actor
    if (payload.actorId && payload.actorId === currentUserId) return;

    setNotifications((prev) => [{ ...payload, isRead: false }, ...prev]);
    setUnreadCount((prev) => prev + 1);
  });

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    await markAllNotificationsRead();
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
  };
}
