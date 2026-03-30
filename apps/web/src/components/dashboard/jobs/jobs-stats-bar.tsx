"use client";

import { IconBriefcase, IconCalendarEvent, IconCurrencyDollar, IconAlertTriangle } from "@tabler/icons-react";

interface JobsStatsBarProps {
  totalJobs: number;
  todayJobs: number;
  urgentCount: number;
  pipelineValue: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function JobsStatsBar({
  totalJobs,
  todayJobs,
  urgentCount,
  pipelineValue,
}: JobsStatsBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-body">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground">
        <IconBriefcase className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        {totalJobs} {totalJobs === 1 ? "job" : "jobs"}
      </span>

      {todayJobs > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground">
          <IconCalendarEvent className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
          {todayJobs} today
        </span>
      )}

      {pipelineValue > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 font-medium text-foreground">
          <IconCurrencyDollar className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          {formatCurrency(pipelineValue)} pipeline
        </span>
      )}

      {urgentCount > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-1 font-medium text-red-600 dark:text-red-400">
          <IconAlertTriangle className="h-3.5 w-3.5" />
          {urgentCount} urgent
        </span>
      )}
    </div>
  );
}
