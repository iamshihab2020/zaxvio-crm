"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconArrowUp,
  IconArrowDown,
  IconArrowsSort,
} from "@tabler/icons-react";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPE_LABELS,
  type JobPriority,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import { cn } from "@/lib/utils";
import type { JobCardData } from "./kanban-card";

interface Stage {
  name: string;
  label: string;
  color: string;
}

interface JobTableProps {
  jobs: JobCardData[];
  stages: Stage[];
  onRowClick: (jobId: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  compact?: boolean;
}

function formatCurrency(val: string | null) {
  const num = parseFloat(val ?? "0");
  if (num < 0) return `\u2212$${Math.abs(num).toFixed(2)}`;
  return `$${num.toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "\u2014";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface SortableHeaderProps {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  align?: "left" | "right";
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
  compact = false,
}: SortableHeaderProps & { compact?: boolean }) {
  const isActive = sortBy === column;
  return (
    <TableHead
      className={cn(
        "font-body cursor-pointer select-none hover:text-foreground transition-colors",
        align === "right" && "text-right",
        compact && "h-9 px-3 text-xs",
      )}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive ? (
          sortOrder === "asc" ? (
            <IconArrowUp className="h-3.5 w-3.5" />
          ) : (
            <IconArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <IconArrowsSort className="h-3.5 w-3.5 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}

export function JobTable({
  jobs,
  stages,
  onRowClick,
  sortBy,
  sortOrder,
  onSort,
  compact,
}: JobTableProps) {
  function getStageInfo(statusName: string) {
    const stage = stages.find((s) => s.name === statusName);
    if (!stage) return { label: statusName, colors: getStageColors("gray") };
    return { label: stage.label, colors: getStageColors(stage.color) };
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHeader label="Job #" column="jobNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} />
            <TableHead className={cn("font-body", compact && "h-9 px-3 text-xs")}>Title</TableHead>
            <TableHead className={cn("font-body", compact && "h-9 px-3 text-xs")}>Customer</TableHead>
            <SortableHeader label="Status" column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} />
            <SortableHeader label="Priority" column="priority" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} />
            <TableHead className={cn("font-body", compact && "h-9 px-3 text-xs")}>Service Type</TableHead>
            <SortableHeader label="Scheduled" column="scheduledDate" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} />
            <SortableHeader label="Total" column="totalAmount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} align="right" compact={compact} />
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const stageInfo = getStageInfo(job.status);
            const priorityColors = JOB_PRIORITY_COLORS[job.priority as JobPriority];
            const customerName =
              job.customerFirstName || job.customerLastName
                ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
                : "No customer";

            const cellClass = compact ? "py-1.5 px-3 text-xs" : "";

            return (
              <TableRow
                key={job.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onRowClick(job.id)}
              >
                <TableCell className={cn("font-medium font-body", cellClass)}>
                  {job.jobNumber}
                </TableCell>
                <TableCell className={cn("max-w-[200px] truncate font-body", cellClass)}>
                  {job.title}
                </TableCell>
                <TableCell className={cn("font-body", cellClass)}>
                  {customerName}
                </TableCell>
                <TableCell className={cellClass}>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full font-medium font-body",
                      compact ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5 text-xs",
                      stageInfo.colors.bg,
                      stageInfo.colors.text,
                    )}
                  >
                    <span className={cn("rounded-full", stageInfo.colors.dot, compact ? "h-1 w-1" : "h-1.5 w-1.5")} />
                    {stageInfo.label}
                  </span>
                </TableCell>
                <TableCell className={cellClass}>
                  {priorityColors && (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full font-medium font-body",
                        compact ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5 text-xs",
                        priorityColors.bg,
                        priorityColors.text,
                      )}
                    >
                      {JOB_PRIORITY_LABELS[job.priority as JobPriority]}
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn("text-muted-foreground font-body", cellClass)}>
                  {SERVICE_TYPE_LABELS[job.serviceType] ?? job.serviceType}
                </TableCell>
                <TableCell className={cn("text-muted-foreground font-body", cellClass)}>
                  {formatDate(job.scheduledDate)}
                </TableCell>
                <TableCell className={cn("text-right font-medium font-body", cellClass)}>
                  {formatCurrency(job.totalAmount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
