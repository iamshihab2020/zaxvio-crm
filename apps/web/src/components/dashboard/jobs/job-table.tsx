"use client";

import { useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getJob } from "@/lib/client-reads/jobs";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { JobCardData } from "./kanban-card";
import { useStagger } from "@/hooks/use-stagger";

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
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  /**
   * Which rows are on screen: the pipeline, filters, sort and page they were
   * fetched for, `null` while the previous ones are still showing. The rows
   * arrive in sequence when it changes. Never the jobs themselves.
   */
  arrivalKey?: string | null;
  /** A job that was just created or edited, to wear the highlight once. */
  highlightJobId?: string | null;
}

function formatCurrency(val: string | null) {
  const num = parseFloat(val ?? "0");
  if (num < 0) return `−$${Math.abs(num).toFixed(2)}`;
  return `$${num.toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "—";
  const dateStr = val.length > 10 ? val.split("T")[0] : val;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
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
  className?: string;
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
  compact = false,
  className,
}: SortableHeaderProps & { compact?: boolean }) {
  const isActive = sortBy === column;
  return (
    <TableHead
      className={cn(
        "font-body cursor-pointer select-none hover:text-foreground transition-colors",
        align === "right" && "text-right",
        compact && "h-9 px-3 text-xs",
        className,
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
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isIndeterminate,
  arrivalKey,
  highlightJobId,
}: JobTableProps) {
  const queryClient = useQueryClient();
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useStagger(bodyRef, arrivalKey);

  function getStageInfo(statusName: string) {
    const stage = stages.find((s) => s.name === statusName);
    if (!stage) return { label: statusName, colors: getStageColors("gray") };
    return { label: stage.label, colors: getStageColors(stage.color) };
  }

  // Below `md` the table is three columns (checkbox, job, total) and every
  // column it hides is folded into the job cell, as `automations-table` does
  // for its trigger. Six data columns do not fit 343px, and a table that
  // scrolled sideways would hide the amount, the one column a phone is read for.
  // The padding steps down with it; `compact` keeps its own, tighter padding.
  const phonePad = compact ? undefined : "px-3 md:px-4";

  return (
    // Fades in when it replaces the skeleton. A page or sort change that is
    // already cached keeps this mounted and staggers the rows instead.
    <div className="motion-appear overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {selectedIds !== undefined && (
              <TableHead
                className={cn("w-10 md:w-12", compact && "h-9 px-3")}
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                  onCheckedChange={onToggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <SortableHeader label="Job #" column="jobNumber" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} className="hidden md:table-cell" />
            <TableHead className={cn("font-body", phonePad, compact && "h-9 px-3 text-xs")}>Title</TableHead>
            <TableHead className={cn("font-body hidden md:table-cell", compact && "h-9 px-3 text-xs")}>Customer</TableHead>
            <SortableHeader label="Status" column="status" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} className="hidden md:table-cell" />
            <SortableHeader label="Priority" column="priority" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} className="hidden md:table-cell" />
            <TableHead className={cn("font-body hidden md:table-cell", compact && "h-9 px-3 text-xs")}>Service Type</TableHead>
            <SortableHeader label="Scheduled" column="scheduledDate" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} compact={compact} className="hidden md:table-cell" />
            <SortableHeader label="Total" column="totalAmount" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} align="right" compact={compact} className={phonePad} />
          </TableRow>
        </TableHeader>
        <TableBody ref={bodyRef}>
          {jobs.map((job) => {
            const stageInfo = getStageInfo(job.status);
            const priorityColors = JOB_PRIORITY_COLORS[job.priority as JobPriority];
            const customerName =
              job.customerFirstName || job.customerLastName
                ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
                : "No customer";

            const cellClass = compact ? "py-1.5 px-3 text-xs" : "";

            const statusBadge = (
              <Badge
                className={cn(
                  "gap-1.5 font-medium",
                  compact ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5",
                  stageInfo.colors.bg,
                  stageInfo.colors.text,
                )}
              >
                <span className={cn("rounded-full", stageInfo.colors.dot, compact ? "h-1 w-1" : "h-1.5 w-1.5")} />
                {stageInfo.label}
              </Badge>
            );

            return (
              <TableRow
                key={job.id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  job.id === highlightJobId && "motion-highlight",
                )}
                onClick={() => onRowClick(job.id)}
                onMouseEnter={() => {
                  queryClient.prefetchQuery({
                    queryKey: queryKeys.jobs.detail(job.id),
                    queryFn: () => getJob(job.id),
                    staleTime: 30_000,
                  });
                }}
                data-selected={selectedIds?.has(job.id) ? "true" : undefined}
              >
                {selectedIds !== undefined && (
                  <TableCell className={cn(cellClass)} onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(job.id)}
                      onCheckedChange={() => onToggleSelect?.(job.id)}
                      aria-label={`Select job ${job.jobNumber}`}
                    />
                  </TableCell>
                )}
                <TableCell className={cn("hidden font-medium font-body md:table-cell", cellClass)}>
                  {job.jobNumber}
                </TableCell>
                {/* Wraps on a phone; from `md` it is the single truncated line
                    it was, and the sub-lines (which repeat hidden columns) go. */}
                <TableCell className={cn("whitespace-normal font-body md:max-w-[200px] md:truncate", phonePad, cellClass)}>
                  <span className="line-clamp-2 break-words md:hidden">{job.title}</span>
                  <span className="hidden md:inline">{job.title}</span>
                  <div className="mt-0.5 text-xs font-normal text-muted-foreground md:hidden">
                    {job.jobNumber} · {customerName}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 md:hidden">
                    {statusBadge}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(job.scheduledDate)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className={cn("hidden font-body md:table-cell", cellClass)}>
                  {customerName}
                </TableCell>
                <TableCell className={cn("hidden md:table-cell", cellClass)}>
                  {statusBadge}
                </TableCell>
                <TableCell className={cn("hidden md:table-cell", cellClass)}>
                  {priorityColors && (
                    <Badge
                      className={cn(
                        "font-medium",
                        compact ? "px-2 py-px text-[11px]" : "px-2.5 py-0.5",
                        priorityColors.bg,
                        priorityColors.text,
                      )}
                    >
                      {JOB_PRIORITY_LABELS[job.priority as JobPriority]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className={cn("hidden text-muted-foreground font-body md:table-cell", cellClass)}>
                  {SERVICE_TYPE_LABELS[job.serviceType] ?? job.serviceType}
                </TableCell>
                <TableCell className={cn("hidden text-muted-foreground font-body md:table-cell", cellClass)}>
                  {formatDate(job.scheduledDate)}
                </TableCell>
                <TableCell className={cn("whitespace-nowrap text-right font-medium font-body", phonePad, cellClass)}>
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
