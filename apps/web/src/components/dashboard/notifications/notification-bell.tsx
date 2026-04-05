"use client";

import Link from "next/link";
import { IconBell } from "@tabler/icons-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationHeader } from "./notification-header";
import { NotificationItem } from "./notification-item";
import { NotificationEmpty } from "./notification-empty";

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <IconBell className="h-[18px] w-[18px]" stroke={1.5} />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <NotificationHeader
          unreadCount={unreadCount}
          onMarkAllRead={markAllAsRead}
        />
        <Separator />
        {isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <NotificationEmpty />
        ) : (
          <ScrollArea className="max-h-[400px]">
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
            </div>
          </ScrollArea>
        )}
        <Separator />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            asChild
          >
            <Link href="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
