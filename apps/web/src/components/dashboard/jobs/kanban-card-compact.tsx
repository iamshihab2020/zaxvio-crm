"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { JobCardData } from "./kanban-card";
import type { CardFieldVisibility } from "./card-fields-popover";

interface KanbanCardCompactProps {
  job: JobCardData;
  onClick: (jobId: string) => void;
  isOverlay?: boolean;
  visibleFields?: CardFieldVisibility;
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

export function KanbanCardCompact({
  job,
  onClick,
  isOverlay,
  visibleFields,
}: KanbanCardCompactProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: job.id,
    data: { job, type: "card" },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const amount = parseFloat(job.totalAmount);

  const vf = visibleFields ?? {
    serviceType: true, priority: true, jobNumber: true, customer: true,
    address: true, date: true, time: true, amount: true, todayBadge: true,
  };

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
        "cursor-grab rounded-xl border bg-card px-3 py-2",
        "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        "border-border/60 shadow-sm",
        "hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.25)] hover:border-brand/30",
        "dark:border-border/40 dark:shadow-sm",
        "dark:hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.35)] dark:hover:border-brand/40",
        "active:cursor-grabbing",
        isDragging && "opacity-30 z-0",
        isOverlay && "shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]",
        job.priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      <div className="flex items-center gap-2">
        {vf.jobNumber && (
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground font-body">
            {job.jobNumber}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground font-body">
          {job.title}
        </span>
        {vf.customer && (
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
        )}
        {vf.date && (
          <span className="shrink-0 text-[10px] text-muted-foreground font-body">
            {formatDate(job.scheduledDate)}
          </span>
        )}
        {vf.amount && amount > 0 && (
          <span className="shrink-0 text-[10px] font-medium text-foreground font-body">
            ${amount.toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}
