"use client";

import { useEffect, useRef, useState } from "react";
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
import { replayMotion } from "@/lib/motion";
import { NotificationHeader } from "./notification-header";
import { NotificationItem } from "./notification-item";
import { NotificationEmpty } from "./notification-empty";

/** How long a row that just arrived keeps its highlight class, in ms. */
const FRESH_MS = 1500;

export function NotificationBell() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotifications();

  // The badge pops when the count goes UP after the first load, which is a new
  // notification arriving. The first count, and any decrease (reading one), set
  // the badge without moving it. `replayMotion` rather than a `key`, because the
  // badge is already mounted for every increase after the first.
  const badgeRef = useRef<HTMLSpanElement>(null);
  const previousCount = useRef<number | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const previous = previousCount.current;
    previousCount.current = unreadCount;
    if (previous !== null && unreadCount > previous && badgeRef.current) {
      replayMotion(badgeRef.current, "motion-pop");
    }
  }, [unreadCount, isLoading]);

  // Rows that arrived over the live stream while the page was open. The popover
  // unmounts its content when closed, so the highlight class is dropped after
  // `FRESH_MS`; left on, every reopening would play it again for old rows.
  const knownIds = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (isLoading) return;
    if (knownIds.current === null) {
      knownIds.current = new Set(notifications.map((n) => n.id));
      return;
    }
    const known = knownIds.current;
    const added = notifications.filter((n) => !known.has(n.id)).map((n) => n.id);
    if (added.length === 0) return;
    for (const id of added) known.add(id);
    setFreshIds((prev) => new Set([...prev, ...added]));
    setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        for (const id of added) next.delete(id);
        return next;
      });
    }, FRESH_MS);
  }, [notifications, isLoading]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-10 w-10 sm:h-9 sm:w-9"
        >
          <IconBell className="h-[18px] w-[18px]" stroke={1.5} />
          {unreadCount > 0 && (
            <span
              ref={badgeRef}
              className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-brand-foreground"
            >
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
                // The wrapper carries the highlight: the item is a button with
                // no background of its own, so the wash shows through it.
                <div
                  key={notif.id}
                  className={freshIds.has(notif.id) ? "motion-highlight" : undefined}
                >
                  <NotificationItem
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
                </div>
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
