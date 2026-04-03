"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPE_LABELS,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";
import {
  IconCalendar,
  IconClock,
  IconCurrencyDollar,
  IconMapPin,
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

function getInitials(first: string | null, last: string | null): string {
  const f = first?.charAt(0)?.toUpperCase() ?? "";
  const l = last?.charAt(0)?.toUpperCase() ?? "";
  return f + l || "?";
}

// Hardcoded theme colors to guarantee correct background during drag
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
        "cursor-grab rounded-xl border bg-card p-3.5 transition-all duration-200",
        "border-border/80 shadow dark:border-border/60 dark:shadow-sm",
        "hover:shadow-lg hover:-translate-y-0.5 dark:hover:shadow-md",
        "active:cursor-grabbing",
        isDragging && "opacity-30",
        isOverlay && "shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]",
        job.priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      {/* Top row: Service type + Priority */}
      <div className="flex items-center justify-between mb-2.5">
        <Badge className="bg-muted/60 text-muted-foreground px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-0">
          {SERVICE_TYPE_LABELS[job.serviceType]}
        </Badge>
        <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border-0", priorityColors.bg, priorityColors.text)}>
          {JOB_PRIORITY_LABELS[job.priority]}
        </Badge>
      </div>

      {/* Title */}
      <h4 className="text-sm font-medium text-foreground font-body line-clamp-2 mb-1.5">
        {job.title}
      </h4>

      {/* Job number */}
      <p className="text-[11px] text-muted-foreground/70 font-body mb-2">
        {job.jobNumber}
      </p>

      {/* Customer with initials avatar */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light/40 text-[10px] font-semibold text-brand dark:bg-brand/20 dark:text-brand">
          {getInitials(job.customerFirstName, job.customerLastName)}
        </span>
        <span className="text-xs text-muted-foreground font-body truncate">
          {customerName}
        </span>
      </div>

      {/* Address */}
      {job.address && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
          <IconMapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{job.address}</span>
        </div>
      )}

      {/* Bottom metadata */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <IconCalendar className="h-3 w-3" />
            <span className="font-body">{formatDate(job.scheduledDate)}</span>
          </div>
          {job.scheduledStart && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <IconClock className="h-3 w-3" />
              <span className="font-body">{formatTime(job.scheduledStart)}</span>
            </div>
          )}
          {isToday && (
            <Badge className="bg-brand-light/50 text-brand px-1.5 py-0 text-[9px] font-medium border-0 dark:bg-brand/20">
              Today
            </Badge>
          )}
        </div>
        {parseFloat(job.totalAmount) > 0 && (
          <div className="flex items-center gap-0.5 text-xs font-medium text-foreground font-body">
            <IconCurrencyDollar className="h-3 w-3" />
            <span>{parseFloat(job.totalAmount).toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
