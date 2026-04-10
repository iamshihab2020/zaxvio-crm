"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TimePicker } from "@/components/ui/time-picker";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  JOB_PRIORITIES,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";
import {
  IconCalendar,
  IconClock,
  IconCurrencyDollar,
  IconMapPin,
  IconCheck,
} from "@tabler/icons-react";
import type { CardFieldVisibility } from "./card-fields-popover";
import { AssigneePicker, type AssigneeMember } from "./assignee-picker";

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
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
}

interface KanbanCardProps {
  job: JobCardData;
  onClick: (jobId: string) => void;
  isOverlay?: boolean;
  visibleFields?: CardFieldVisibility;
  members?: AssigneeMember[];
  onAssigneeChange?: (jobId: string, assigneeId: string | null) => void;
  onJobFieldChange?: (jobId: string, field: string, value: string) => void;
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

const SERVICE_TYPE_DOT: Record<string, string> = {
  installation: "bg-indigo-500",
  repair: "bg-orange-500",
  maintenance: "bg-sky-500",
  inspection: "bg-violet-500",
  emergency: "bg-red-500",
  consultation: "bg-teal-500",
  other: "bg-gray-400",
};

const SERVICE_TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  installation: { bg: "bg-indigo-50 dark:bg-indigo-950/50", text: "text-indigo-700 dark:text-indigo-300" },
  repair: { bg: "bg-orange-50 dark:bg-orange-950/50", text: "text-orange-700 dark:text-orange-300" },
  maintenance: { bg: "bg-sky-50 dark:bg-sky-950/50", text: "text-sky-700 dark:text-sky-300" },
  inspection: { bg: "bg-violet-50 dark:bg-violet-950/50", text: "text-violet-700 dark:text-violet-300" },
  emergency: { bg: "bg-red-50 dark:bg-red-950/50", text: "text-red-700 dark:text-red-300" },
  consultation: { bg: "bg-teal-50 dark:bg-teal-950/50", text: "text-teal-700 dark:text-teal-300" },
  other: { bg: "bg-gray-100 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400" },
};

const PRIORITY_DOT: Record<string, string> = {
  standard: "bg-blue-500",
  urgent: "bg-amber-500",
  emergency: "bg-red-500",
};

function getInitials(first: string | null, last: string | null): string {
  const f = first?.charAt(0)?.toUpperCase() ?? "";
  const l = last?.charAt(0)?.toUpperCase() ?? "";
  return f + l || "?";
}

export function KanbanCard({
  job,
  onClick,
  isOverlay,
  visibleFields,
  members,
  onAssigneeChange,
  onJobFieldChange,
}: KanbanCardProps) {
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

  const priorityColors = JOB_PRIORITY_COLORS[job.priority];
  const customerName =
    job.customerFirstName || job.customerLastName
      ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
      : "No customer";

  const isToday =
    job.scheduledDate === new Date().toISOString().split("T")[0];

  // Default all fields to visible if not provided
  const vf = visibleFields ?? {
    serviceType: true, priority: true, jobNumber: true, customer: true,
    address: true, date: true, time: true, amount: true, todayBadge: true,
  };

  const showTopRow = vf.serviceType || vf.priority;
  const showBottomRow = vf.date || vf.time || vf.todayBadge || vf.amount;
  const hasAssignee = members && onAssigneeChange && !isOverlay;
  const canEdit = !!onJobFieldChange && !isOverlay;

  // Controlled popover states for inline editors
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  // Press effect — only fires from card body clicks (popovers stopPropagation on mouseDown)
  const [pressed, setPressed] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-dragging={isDragging || undefined}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={() => {
        setPressed(false);
        if (!isDragging) onClick(job.id);
      }}
      className={cn(
        "cursor-grab rounded-xl border bg-card p-3.5",
        "transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        "border-border/60 shadow-sm",
        "hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.25)] hover:border-brand/30",
        "dark:border-border/40 dark:shadow-sm",
        "dark:hover:shadow-[0_6px_24px_0px_hsl(var(--brand)/0.35)] dark:hover:border-brand/40",
        "active:cursor-grabbing",
        pressed && "scale-[0.98]",
        isDragging && "opacity-30 z-0",
        isOverlay && "shadow-xl ring-2 ring-brand/30 rotate-2 scale-[1.03]",
        job.priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      {/* Top row: Service type + Priority (inline editable) */}
      {showTopRow && (
        <div className="flex items-center justify-between mb-2.5">
          {vf.serviceType && (
            canEdit ? (
              <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <Popover open={serviceTypeOpen} onOpenChange={setServiceTypeOpen}>
                  <PopoverTrigger asChild>
                    <button className="cursor-pointer">
                      <Badge className={cn("px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-0 hover:opacity-80 transition-opacity", SERVICE_TYPE_BADGE[job.serviceType]?.bg ?? "bg-gray-100 dark:bg-gray-800/50", SERVICE_TYPE_BADGE[job.serviceType]?.text ?? "text-gray-600 dark:text-gray-400")}>
                        {SERVICE_TYPE_LABELS[job.serviceType]}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-1" align="start">
                    {SERVICE_TYPES.map((st) => (
                      <button
                        key={st}
                        onClick={() => { onJobFieldChange!(job.id, "serviceType", st); setServiceTypeOpen(false); }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors",
                          job.serviceType === st ? "bg-brand-light/30 text-brand font-medium dark:bg-brand/15" : "hover:bg-muted",
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full shrink-0", SERVICE_TYPE_DOT[st] ?? "bg-gray-400")} />
                        <span className="flex-1 text-left">{SERVICE_TYPE_LABELS[st as ServiceType]}</span>
                        {job.serviceType === st && <IconCheck className="h-3 w-3 shrink-0" />}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Badge className={cn("px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border-0", SERVICE_TYPE_BADGE[job.serviceType]?.bg ?? "bg-gray-100 dark:bg-gray-800/50", SERVICE_TYPE_BADGE[job.serviceType]?.text ?? "text-gray-600 dark:text-gray-400")}>
                {SERVICE_TYPE_LABELS[job.serviceType]}
              </Badge>
            )
          )}
          {vf.priority && (
            canEdit ? (
              <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} className={cn(!vf.serviceType && "ml-auto")}>
                <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
                  <PopoverTrigger asChild>
                    <button className="cursor-pointer">
                      <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border-0 hover:opacity-80 transition-opacity", priorityColors.bg, priorityColors.text)}>
                        {JOB_PRIORITY_LABELS[job.priority]}
                      </Badge>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-1" align="end">
                    {JOB_PRIORITIES.map((p) => {
                      return (
                        <button
                          key={p}
                          onClick={() => { onJobFieldChange!(job.id, "priority", p); setPriorityOpen(false); }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer transition-colors",
                            job.priority === p ? "bg-brand-light/30 text-brand font-medium dark:bg-brand/15" : "hover:bg-muted",
                          )}
                        >
                          <span className={cn("h-2 w-2 rounded-full shrink-0", PRIORITY_DOT[p] ?? "bg-gray-400")} />
                          <span className="flex-1 text-left">{JOB_PRIORITY_LABELS[p as JobPriority]}</span>
                          {job.priority === p && <IconCheck className="h-3 w-3 shrink-0" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border-0", priorityColors.bg, priorityColors.text, !vf.serviceType && "ml-auto")}>
                {JOB_PRIORITY_LABELS[job.priority]}
              </Badge>
            )
          )}
        </div>
      )}

      {/* Title — always visible */}
      <h4 className="text-sm font-medium text-foreground font-body line-clamp-2 mb-1.5">
        {job.title}
      </h4>

      {/* Job number */}
      {vf.jobNumber && (
        <p className="text-[11px] text-muted-foreground/70 font-body mb-2">
          {job.jobNumber}
        </p>
      )}

      {/* Customer row */}
      {vf.customer && (
        <div className="flex items-center gap-2 mb-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-light/40 text-[10px] font-semibold text-brand dark:bg-brand/20 dark:text-brand">
            {getInitials(job.customerFirstName, job.customerLastName)}
          </span>
          <span className="text-xs text-muted-foreground font-body truncate flex-1">
            {customerName}
          </span>

          {/* Assignee — interactive picker with stopPropagation */}
          {hasAssignee ? (
            <div
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <AssigneePicker
                value={job.assigneeId}
                onChange={(id) => onAssigneeChange!(job.id, id)}
                members={members!}
                compact
              />
            </div>
          ) : (
            /* Overlay / no-member fallback: static display */
            job.assigneeId && job.assigneeName ? (
              <span title={job.assigneeName} className="shrink-0">
                {job.assigneeImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.assigneeImage}
                    alt={job.assigneeName}
                    className="h-5 w-5 rounded-full object-cover ring-1 ring-background"
                  />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-1 ring-background">
                    {job.assigneeName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
            ) : null
          )}
        </div>
      )}

      {/* Address */}
      {vf.address && job.address && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
          <IconMapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{job.address}</span>
        </div>
      )}

      {/* Bottom metadata (date + time inline editable) */}
      {showBottomRow && (
        <div className="flex items-center justify-between pt-2.5 border-t border-border/50 dark:border-border/40">
          <div className="flex items-center gap-2.5">
            {vf.date && (
              canEdit ? (
                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <IconCalendar className="h-3 w-3" />
                        <span className="font-body">{formatDate(job.scheduledDate)}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={new Date(job.scheduledDate + "T00:00:00")}
                        onSelect={(date) => {
                          if (date) {
                            const yyyy = date.getFullYear();
                            const mm = String(date.getMonth() + 1).padStart(2, "0");
                            const dd = String(date.getDate()).padStart(2, "0");
                            onJobFieldChange!(job.id, "scheduledDate", `${yyyy}-${mm}-${dd}`);
                            setDateOpen(false);
                          }
                        }}
                        defaultMonth={new Date(job.scheduledDate + "T00:00:00")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconCalendar className="h-3 w-3" />
                  <span className="font-body">{formatDate(job.scheduledDate)}</span>
                </div>
              )
            )}
            {vf.time && job.scheduledStart && (
              canEdit ? (
                <div onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                  <Popover open={timeOpen} onOpenChange={setTimeOpen}>
                    <PopoverTrigger asChild>
                      <button className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                        <IconClock className="h-3 w-3" />
                        <span className="font-body">{formatTime(job.scheduledStart)}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="start">
                      <TimePicker
                        value={job.scheduledStart}
                        onChange={(v) => { onJobFieldChange!(job.id, "scheduledStart", v); setTimeOpen(false); }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconClock className="h-3 w-3" />
                  <span className="font-body">{formatTime(job.scheduledStart)}</span>
                </div>
              )
            )}
            {vf.todayBadge && isToday && (
              <Badge className="bg-brand-light/50 text-brand px-1.5 py-0 text-[9px] font-medium border-0 dark:bg-brand/20">
                Today
              </Badge>
            )}
          </div>
          {vf.amount && parseFloat(job.totalAmount) > 0 && (
            <div className="flex items-center gap-0.5 text-xs font-medium text-foreground font-body">
              <IconCurrencyDollar className="h-3 w-3" />
              <span>{parseFloat(job.totalAmount).toFixed(2)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
