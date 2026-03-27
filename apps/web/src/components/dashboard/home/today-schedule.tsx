"use client";

import {
  IconCalendarOff,
  IconFlame,
  IconUsers,
  IconCalendarPlus,
} from "@tabler/icons-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { DashboardTodayJob, DashboardKpis } from "@hvac-saas/types";

interface TodayScheduleProps {
  jobs: DashboardTodayJob[];
  activeCustomers: number;
  upcomingBookings: number;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  // time is in HH:MM:SS format, convert to 12h
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; classes: string }> = {
    scheduled: {
      label: "Scheduled",
      classes: "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400",
    },
    in_progress: {
      label: "In Progress",
      classes: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
    },
    completed: {
      label: "Done",
      classes: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
    },
    cancelled: {
      label: "Cancelled",
      classes: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
    },
  };
  const s = statusMap[status] ?? {
    label: status.replace(/_/g, " "),
    classes: "bg-muted text-muted-foreground",
  };
  return s;
}

export function TodaySchedule({
  jobs,
  activeCustomers,
  upcomingBookings,
}: TodayScheduleProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-semibold">
          Today&apos;s Schedule
        </CardTitle>
        <div className="mt-1 flex items-center gap-3">
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-body">
            <IconUsers className="h-3 w-3" />
            {activeCustomers} active
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-body">
            <IconCalendarPlus className="h-3 w-3" />
            {upcomingBookings} bookings
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {jobs.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-6 pb-6">
            <div className="text-center">
              <IconCalendarOff className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground font-body">
                No jobs scheduled today
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[380px]">
            <div className="space-y-0">
              {jobs.map((job, idx) => {
                const statusBadge = getStatusBadge(job.status);
                return (
                  <Link
                    key={job.id}
                    href={`/jobs/${job.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50 cursor-pointer",
                      idx < jobs.length - 1 && "border-b border-border",
                    )}
                  >
                    {/* Time */}
                    <div className="w-16 shrink-0 text-xs text-muted-foreground font-body">
                      {job.scheduledStart ? formatTime(job.scheduledStart) : (
                        <span className="italic">No time</span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground font-body">
                        {job.jobNumber}
                      </p>
                      <p className="truncate text-xs text-muted-foreground font-body">
                        {job.customerName}
                      </p>
                    </div>

                    {/* Status + Priority */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {job.priority === "emergency" && (
                        <IconFlame className="h-3.5 w-3.5 text-red-500" />
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          statusBadge.classes,
                        )}
                      >
                        {statusBadge.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
