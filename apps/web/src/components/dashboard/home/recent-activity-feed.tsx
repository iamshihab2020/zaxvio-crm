"use client";

import {
  IconTool,
  IconFileDescription,
  IconActivity,
} from "@tabler/icons-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { DashboardActivityItem } from "@hvac-saas/types";
import { formatRelativeTime } from "@/lib/format";
import { WidgetHeader } from "./widget-header";
import { WidgetWindowBadge } from "./widget-window-badge";
import { cn } from "@/lib/utils";

interface RecentActivityFeedProps {
  activities: DashboardActivityItem[];
}

/**
 * A job is orange wherever it appears (DESIGN.md), and a quote is not a
 * schedule kind, so it takes the neutral disc. The glyph differs too, so the
 * kind never rides on colour alone. These were raw `blue-*` and `purple-*`
 * classes, two hues the design system does not have.
 */
function getActivityIcon(type: "job" | "quote") {
  if (type === "job") {
    return {
      Icon: IconTool,
      bg: "bg-brand/10",
      text: "text-brand",
    };
  }
  return {
    Icon: IconFileDescription,
    bg: "bg-muted",
    text: "text-muted-foreground",
  };
}

function getActivityHref(activity: DashboardActivityItem): string {
  if (activity.type === "job") return `/jobs/${activity.entityId}`;
  return `/quotes/${activity.entityId}`;
}

export function RecentActivityFeed({ activities }: RecentActivityFeedProps) {
  return (
    /* `h-full` + an internal scroll: this now shares a grid row with Top
       Customers, and ten activity rows against five customer rows would
       otherwise set the row height and leave its neighbour half empty.
       The list takes the card's padding back with a negative margin so each
       row's hover and hairline run edge to edge, which is why the card clips. */
    <Card className="flex h-full flex-col overflow-hidden p-4 sm:p-6">
      <WidgetHeader
        title="Recent Activity"
        badge={<WidgetWindowBadge label="Latest 10" />}
      />
      <div className="-mx-4 mt-3 min-h-0 flex-1 overflow-y-auto sm:-mx-6">
        {activities.length === 0 ? (
          <div className="flex h-24 items-center justify-center px-4 sm:px-6">
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
                    "flex min-h-10 items-center gap-2.5 px-4 py-2 transition-colors hover:bg-muted/50 sm:min-h-0 sm:px-6",
                    idx < activities.length - 1 && "border-b border-border",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      bg,
                    )}
                  >
                    <Icon className={cn("h-3.5 w-3.5", text)} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Two lines on a phone, where one line of a 343px row
                        leaves about 35 characters; one line from `sm`. */}
                    <p className="line-clamp-2 text-xs font-body text-foreground sm:line-clamp-1">
                      <span className="font-medium">{activity.entityLabel}</span>
                      {" "}
                      {activity.description}
                    </p>
                  </div>
                  <span className="tnum shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
