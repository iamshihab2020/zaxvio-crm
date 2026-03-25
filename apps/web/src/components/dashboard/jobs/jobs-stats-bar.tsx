"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

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
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-body text-muted-foreground">
      <span className="font-heading text-lg font-bold text-foreground">
        {totalJobs}
      </span>
      <span>{totalJobs === 1 ? "job" : "jobs"}</span>

      {todayJobs > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="font-medium text-foreground">{todayJobs}</span>
          <span>today</span>
        </>
      )}

      {pipelineValue > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="font-medium text-foreground">
            {formatCurrency(pipelineValue)}
          </span>
          <span>pipeline</span>
        </>
      )}

      {urgentCount > 0 && (
        <>
          <span className="text-border">·</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
            )}
          >
            <IconAlertTriangle className="h-3 w-3" />
            {urgentCount} urgent
          </span>
        </>
      )}
    </div>
  );
}
