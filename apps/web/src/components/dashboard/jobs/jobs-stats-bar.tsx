"use client";

import {
  IconBriefcase,
  IconCalendarEvent,
  IconCurrencyDollar,
  IconAlertTriangle,
} from "@tabler/icons-react";

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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-body text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <IconBriefcase className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
        <span className="font-medium text-foreground">{totalJobs}</span>
        {totalJobs === 1 ? "job" : "jobs"}
      </span>

      {todayJobs > 0 && (
        <>
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1">
            <IconCalendarEvent className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
            <span className="font-medium text-foreground">{todayJobs}</span>
            today
          </span>
        </>
      )}

      {pipelineValue > 0 && (
        <>
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1">
            <IconCurrencyDollar className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span className="font-medium text-foreground">
              {formatCurrency(pipelineValue)}
            </span>
          </span>
        </>
      )}

      {urgentCount > 0 && (
        <>
          <span className="text-border">|</span>
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <IconAlertTriangle className="h-3.5 w-3.5" />
            <span className="font-medium">{urgentCount}</span>
            urgent
          </span>
        </>
      )}
    </div>
  );
}
