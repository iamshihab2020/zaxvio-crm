"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth-client";
import { getTenant } from "@/actions/tenants";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notifications";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

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

  // Subscribe to real-time notifications
  useEffect(() => {
    let mounted = true;

    async function subscribe() {
      const { data: tenant } = await getTenant();
      if (!tenant?.id || !mounted) return;

      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`notifications:${tenant.id}`)
        .on("broadcast", { event: "new_notification" }, ({ payload }) => {
          if (!mounted) return;

          // Skip if this user is the actor
          if (payload.actorId && payload.actorId === currentUserId) return;

          const newNotif: NotificationItem = {
            id: payload.id,
            tenantId: payload.tenantId,
            type: payload.type,
            title: payload.title,
            description: payload.description,
            entityType: payload.entityType,
            entityId: payload.entityId,
            actorId: payload.actorId,
            metadata: payload.metadata,
            createdAt: payload.createdAt,
            isRead: false,
          };

          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            console.log("[notifications] Realtime channel subscribed");
          } else if (status === "CHANNEL_ERROR") {
            console.error("[notifications] Realtime channel error");
          }
        });

      channelRef.current = channel;
    }

    void subscribe();

    return () => {
      mounted = false;
      if (channelRef.current) {
        const supabase = getSupabaseBrowserClient();
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [currentUserId]);

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
