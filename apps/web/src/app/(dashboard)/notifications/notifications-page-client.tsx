"use client";

import { useState, useCallback } from "react";
import { IconBell } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/reusable/page-header";
import { NotificationItem } from "@/components/dashboard/notifications/notification-item";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/actions/notifications";
import type { NotificationWithReadStatus } from "@hvac-saas/types";

interface NotificationsPageClientProps {
  initialNotifications: NotificationWithReadStatus[];
  initialNextCursor?: string | null;
}

export function NotificationsPageClient({
  initialNotifications,
  initialNextCursor = null,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] =
    useState<NotificationWithReadStatus[]>(initialNotifications);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    await markNotificationRead(id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await markAllNotificationsRead();
    setMarkingAll(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await getNotifications({ limit: 50, cursor: nextCursor });
    if (result.data) {
      setNotifications((prev) => [
        ...prev,
        ...(result.data as NotificationWithReadStatus[]),
      ]);
      setNextCursor(result.nextCursor ?? null);
    }
    setLoadingMore(false);
  }, [nextCursor, loadingMore]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Notifications"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
            : "You're all caught up"
        }
        action={
          <Button
            variant="outline"
            size="sm"
            disabled={unreadCount === 0 || markingAll}
            onClick={markAllAsRead}
          >
            Mark all as read
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card">
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
                createdAt={notif.createdAt}
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
