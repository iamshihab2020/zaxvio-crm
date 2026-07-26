"use client";

import {
  IconTool,
  IconFileDescription,
  IconActivity,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardActivityItem } from "@hvac-saas/types";
import { formatRelativeTime } from "@/lib/format";
import { WidgetWindowBadge } from "./widget-window-badge";
import { cn } from "@/lib/utils";

interface RecentActivityFeedProps {
  activities: DashboardActivityItem[];
}

function getActivityIcon(type: "job" | "quote") {
  if (type === "job") {
    return {
      Icon: IconTool,
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-600 dark:text-blue-400",
    };
  }
  return {
    Icon: IconFileDescription,
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-600 dark:text-purple-400",
  };
}

function getActivityHref(activity: DashboardActivityItem): string {
  if (activity.type === "job") return `/jobs/${activity.entityId}`;
  return `/quotes/${activity.entityId}`;
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="font-heading text-base font-semibold">
              Recent Activity
            </CardTitle>
            <WidgetWindowBadge label="Latest 10" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {activities.length === 0 ? (
          <div className="flex h-24 items-center justify-center px-6 pb-6">
            <div className="text-center">
              <IconActivity className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1.5 text-xs text-muted-foreground font-body">
                No recent activity
              </p>
            </div>
          </div>
        ) : (
          <div>
            {activities.map((activity, idx) => {
              const { Icon, bg, text } = getActivityIcon(activity.type);
              return (
                <Link
                  key={activity.id}
                  href={getActivityHref(activity)}
                  className={cn(
                    "flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-muted/50",
                    idx < activities.length - 1 && "border-b border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      bg,
                    )}
                  >
                    <Icon className={cn("h-3 w-3", text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-body text-foreground">
                      <span className="font-medium">{activity.entityLabel}</span>
                      {" "}
                      {activity.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground font-body">
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
