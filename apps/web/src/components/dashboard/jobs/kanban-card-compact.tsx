"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { JobCardData } from "./kanban-card";

interface KanbanCardCompactProps {
  job: JobCardData;
  onClick: (jobId: string) => void;
  isOverlay?: boolean;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(first: string | null, last: string | null): string {
  const f = first?.charAt(0)?.toUpperCase() ?? "";
  const l = last?.charAt(0)?.toUpperCase() ?? "";
  return f + l || "?";
}

const DRAG_COLORS = {
  dark: { bg: "hsl(222, 84%, 4.9%)", fg: "hsl(210, 40%, 98%)" },
  light: { bg: "hsl(0, 0%, 100%)", fg: "hsl(222, 47%, 11%)" },
} as const;

export function KanbanCardCompact({
  job,
  onClick,
  isOverlay,
}: KanbanCardCompactProps) {
  const { resolvedTheme } = useTheme();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: job.id,
    data: { job },
  });

  const dragColors = DRAG_COLORS[resolvedTheme === "dark" ? "dark" : "light"];
  const style: React.CSSProperties = isOverlay
    ? { backgroundColor: dragColors.bg, color: dragColors.fg }
    : {};

  const amount = parseFloat(job.totalAmount);

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
        "cursor-grab rounded-xl border bg-card px-3 py-2 transition-all duration-200",
        "border-border/80 shadow dark:border-border/60 dark:shadow-sm",
        "hover:shadow-lg hover:-translate-y-0.5 dark:hover:shadow-md",
        "active:cursor-grabbing",
        isDragging && "opacity-30",
        isOverlay && "shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]",
        job.priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-medium text-muted-foreground font-body">
          {job.jobNumber}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground font-body">
          {job.title}
        </span>
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light/40 text-[9px] font-semibold text-brand dark:bg-brand/20 dark:text-brand"
          title={
            job.customerFirstName || job.customerLastName
              ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
              : "No customer"
          }
        >
          {getInitials(job.customerFirstName, job.customerLastName)}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground font-body">
          {formatDate(job.scheduledDate)}
        </span>
        {amount > 0 && (
          <span className="shrink-0 text-[10px] font-medium text-foreground font-body">
            ${amount.toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}
