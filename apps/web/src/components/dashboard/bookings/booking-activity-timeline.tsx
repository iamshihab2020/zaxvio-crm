"use client";

import { useBookingActivities } from "@/hooks/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  IconCheck,
  IconX,
  IconBriefcase,
  IconCalendarEvent,
  IconHistory,
} from "@tabler/icons-react";

interface BookingActivity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  performedByName: string | null;
}

interface BookingActivityTimelineProps {
  bookingId: string;
}

/** Icon + accent per activity type. Unknown types fall back to a neutral dot. */
const ACTIVITY_STYLES: Record<
  string,
  { icon: typeof IconCheck; className: string }
> = {
  "booking.status_changed": {
    icon: IconCheck,
    className: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
  },
  "booking.cancelled": {
    icon: IconX,
    className: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
  },
  "booking.converted": {
    icon: IconBriefcase,
    className: "bg-brand/10 text-brand",
  },
  "booking.rescheduled": {
    icon: IconCalendarEvent,
    className: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
  },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The `booking_activities` table has been recording every status change,
 * cancellation and conversion since April. Nothing read it: no endpoint, no
 * hook, no UI — rows accumulating where nobody could see them, while the detail
 * sheet showed a bare notes box (BOOK-18). Jobs, quotes and customers all have
 * a timeline; bookings now do too.
 */
export function BookingActivityTimeline({ bookingId }: BookingActivityTimelineProps) {
  const query = useBookingActivities(bookingId);
  const activities = (query.data?.data ?? []) as BookingActivity[];
  const error = query.data?.error ?? (query.isError ? "Failed to load activity" : null);

  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
        Activity
      </h3>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="text-sm text-muted-foreground font-body">
          {error}
        </p>
      ) : activities.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5">
          <IconHistory className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
          <p className="text-sm text-muted-foreground font-body">
            No activity recorded yet.
          </p>
        </div>
      ) : (
        <ol className="space-y-3">
          {activities.map((activity) => {
            const style = ACTIVITY_STYLES[activity.type];
            const Icon = style?.icon ?? IconHistory;
            return (
              <li key={activity.id} className="flex gap-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    style?.className ?? "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-body text-foreground">
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {formatTimestamp(activity.createdAt)}
                    {activity.performedByName ? ` · ${activity.performedByName}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
