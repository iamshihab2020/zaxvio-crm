"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { IconBell } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "@/components/dashboard/notifications/notification-item";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notifications";
import { queryKeys } from "@/lib/query-keys";
import type { NotificationWithReadStatus } from "@hvac-saas/types";

interface NotificationsPageClientProps {
  initialNotifications: NotificationWithReadStatus[];
  initialNextCursor?: string | null;
}

export function NotificationsPageClient({
  initialNotifications,
  initialNextCursor = null,
}: NotificationsPageClientProps) {
  const queryClient = useQueryClient();

  // Use TanStack Query for the initial page of notifications
  const notificationsQuery = useQuery({
    queryKey: queryKeys.notifications.list({ limit: 50 }),
    queryFn: () => getNotifications({ limit: 50 }),
    initialData: {
      data: initialNotifications,
      nextCursor: initialNextCursor,
      error: null,
    },
  });

  // Additional pages loaded via "Load more" are appended here
  const [extraNotifications, setExtraNotifications] = useState<
    NotificationWithReadStatus[]
  >([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );

  // Combine query data with manually-loaded extras
  const notifications = useMemo(() => {
    const base = (notificationsQuery.data?.data ??
      []) as NotificationWithReadStatus[];
    return [...base, ...extraNotifications];
  }, [notificationsQuery.data, extraNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Optimistic mark-as-read via TanStack mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: async (id: string) => {
      // Optimistically update the query cache
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list({ limit: 50 }),
      });
      queryClient.setQueryData(
        queryKeys.notifications.list({ limit: 50 }),
        (old: typeof notificationsQuery.data | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: (old.data as NotificationWithReadStatus[]).map((n) =>
              n.id === id ? { ...n, isRead: true } : n,
            ),
          };
        },
      );
      // Also update extras
      setExtraNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notifications.list({ limit: 50 }),
      });
      queryClient.setQueryData(
        queryKeys.notifications.list({ limit: 50 }),
        (old: typeof notificationsQuery.data | undefined) => {
          if (!old?.data) return old;
          return {
            ...old,
            data: (old.data as NotificationWithReadStatus[]).map((n) => ({
              ...n,
              isRead: true,
            })),
          };
        },
      );
      setExtraNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true })),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
    },
  });

  const markAsRead = useCallback(
    (id: string) => {
      markReadMutation.mutate(id);
    },
    [markReadMutation],
  );

  const markAllAsRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await getNotifications({ limit: 50, cursor: nextCursor });
    if (result.data) {
      setExtraNotifications((prev) => [
        ...prev,
        ...(result.data as NotificationWithReadStatus[]),
      ]);
      setNextCursor(result.nextCursor ?? null);
    }
    setLoadingMore(false);
  }, [nextCursor, loadingMore]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="rounded-lg border border-border bg-card">
        {/* Card header — "Mark all as read" acts on this list, so it belongs on
            the list rather than up in the navbar. */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <span className="font-body text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You're all caught up"}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
              <IconBell className="h-8 w-8 text-brand" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
              No notifications
            </h3>
            <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground font-body">
              You'll see activity here when things happen in your account.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notif) => (
              <NotificationItem
                key={notif.id}
                id={notif.id}
                type={notif.type}
                title={notif.title}
                description={notif.description}
                entityType={notif.entityType}
                entityId={notif.entityId}
                createdAt={
                  notif.createdAt instanceof Date
                    ? notif.createdAt.toISOString()
                    : notif.createdAt
                }
                isRead={notif.isRead}
                onMarkRead={markAsRead}
              />
            ))}
            {nextCursor && (
              <div className="flex justify-center p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
