"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  JOB_PRIORITY_BORDER_COLORS,
  SERVICE_TYPE_LABELS,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";
import {
  IconCalendar,
  IconClock,
  IconCurrencyDollar,
  IconMapPin,
  IconGripVertical,
} from "@tabler/icons-react";

export interface JobCardData {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  priority: JobPriority;
  serviceType: ServiceType;
  scheduledDate: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  address: string | null;
  totalAmount: string;
  customerFirstName: string | null;
  customerLastName: string | null;
}

interface KanbanCardProps {
  job: JobCardData;
  onClick: (jobId: string) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const amPm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${amPm}`;
}

// Hardcoded theme colors to guarantee correct background during drag
// (CSS variable resolution can break when translate3d promotes to compositing layer)
const DRAG_COLORS = {
  dark: { bg: "hsl(222, 84%, 4.9%)", fg: "hsl(210, 40%, 98%)" },
  light: { bg: "hsl(0, 0%, 100%)", fg: "hsl(222, 47%, 11%)" },
} as const;

export function KanbanCard({ job, onClick, isOverlay }: KanbanCardProps) {
  const { resolvedTheme } = useTheme();
  const { attributes, listeners, setNodeRef, isDragging } =
    useDraggable({
      id: job.id,
      data: { job },
    });

  const dragColors = DRAG_COLORS[resolvedTheme === "dark" ? "dark" : "light"];

  const style: React.CSSProperties = isOverlay
    ? { backgroundColor: dragColors.bg, color: dragColors.fg }
    : {};

  const priorityColors = JOB_PRIORITY_COLORS[job.priority];
  const customerName =
    job.customerFirstName || job.customerLastName
      ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
      : "No customer";

  const isToday =
    job.scheduledDate === new Date().toISOString().split("T")[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-dragging={isDragging || undefined}
      onClick={() => {
        if (!isDragging) onClick(job.id);
      }}
      className={cn(
        "cursor-grab rounded-md border border-border border-l-[3px] bg-card p-3 shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5",
        "active:cursor-grabbing",
        JOB_PRIORITY_BORDER_COLORS[job.priority],
        isDragging && "opacity-30",
        isOverlay && "shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]",
        job.priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground font-body">
            {job.jobNumber}
          </span>
          {isToday && (
            <span className="inline-flex items-center rounded-full bg-brand-light px-1.5 py-0.5 text-[10px] font-medium text-brand">
              Today
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
              priorityColors.bg,
              priorityColors.text,
            )}
          >
            {JOB_PRIORITY_LABELS[job.priority]}
          </span>
          <IconGripVertical className="h-3.5 w-3.5 text-muted-foreground/30" />
        </div>
      </div>

      <h4 className="text-sm font-medium text-foreground font-body line-clamp-2 mb-1">
        {job.title}
      </h4>

      <p className="text-xs text-muted-foreground font-body mb-1.5">
        {customerName}
      </p>

      <div className="flex items-center gap-1.5 mb-2">
        <span className="inline-flex items-center rounded-md bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider font-body">
          {SERVICE_TYPE_LABELS[job.serviceType]}
        </span>
      </div>

      {job.address && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
          <IconMapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{job.address}</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconCalendar className="h-3 w-3" />
            <span>{formatDate(job.scheduledDate)}</span>
          </div>
          {job.scheduledStart && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconClock className="h-3 w-3" />
              <span>{formatTime(job.scheduledStart)}</span>
            </div>
          )}
        </div>
        {parseFloat(job.totalAmount) > 0 && (
          <div className="flex items-center gap-0.5 text-xs font-medium text-foreground">
            <IconCurrencyDollar className="h-3 w-3" />
            <span>{parseFloat(job.totalAmount).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
