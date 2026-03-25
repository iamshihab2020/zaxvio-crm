"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  IconCalendar,
  IconClock,
  IconTool,
  IconMapPin,
  IconCurrencyDollar,
  IconFileDescription,
  IconNote,
} from "@tabler/icons-react";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPE_LABELS,
  type ServiceType,
} from "@/lib/constants/job-options";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import type { JobDetail } from "./job-detail-sheet";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface JobInfoPanelProps {
  job: JobDetail;
  stages: PipelineStage[];
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const amPm = hour >= 12 ? "PM" : "AM";
  const display = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${display}:${m} ${amPm}`;
}

export function JobInfoPanel({ job, stages }: JobInfoPanelProps) {
  const currentStage = stages.find((s) => s.name === job.status);
  const statusColors = currentStage ? getStageColors(currentStage.color) : null;
  const statusLabel = currentStage?.label ?? job.status;
  const priorityColors = JOB_PRIORITY_COLORS[job.priority];

  const customerName =
    `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim() ||
    "No customer";

  const timeRange =
    job.scheduledStart && job.scheduledEnd
      ? `${formatTime(job.scheduledStart)} - ${formatTime(job.scheduledEnd)}`
      : job.scheduledStart
        ? formatTime(job.scheduledStart)
        : null;

  const subtotal = parseFloat(job.subtotal);
  const taxAmount = parseFloat(job.taxAmount ?? "0");
  const total = parseFloat(job.totalAmount);

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Warm header */}
      <div className="flex flex-col items-center gap-2 rounded-lg bg-brand-light/50 py-5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 rounded-b-none px-4 sm:px-5">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          {job.jobNumber}
        </h2>
        <div className="flex items-center gap-2">
          {statusColors && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                statusColors.bg,
                statusColors.text,
              )}
            >
              {statusLabel}
            </span>
          )}
          {priorityColors && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                priorityColors.bg,
                priorityColors.text,
              )}
            >
              {JOB_PRIORITY_LABELS[job.priority]}
            </span>
          )}
        </div>
      </div>

      {/* Schedule */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Schedule
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-body">Date</p>
              <p className="text-sm text-foreground font-body">
                {formatDate(job.scheduledDate)}
              </p>
            </div>
          </div>
          {timeRange && (
            <div className="flex items-center gap-2">
              <IconClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-body">Time</p>
                <p className="text-sm text-foreground font-body">{timeRange}</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <IconTool className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-body">Service</p>
              <p className="text-sm text-foreground font-body">
                {SERVICE_TYPE_LABELS[job.serviceType as ServiceType] ??
                  job.serviceType}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location */}
      {job.address && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
            Location
          </h3>
          <div className="rounded-md bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <IconMapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-foreground font-body">{job.address}</p>
            </div>
          </div>
        </div>
      )}

      {/* Financials */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconCurrencyDollar className="h-3.5 w-3.5" />
          Financials
        </h3>
        <div className="rounded-md border border-border divide-y divide-border">
          <div className="flex justify-between px-3 py-2">
            <span className="text-sm text-muted-foreground font-body">
              Subtotal
            </span>
            <span className="text-sm font-body">${subtotal.toFixed(2)}</span>
          </div>
          {taxAmount > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Tax
              </span>
              <span className="text-sm font-body">
                ${taxAmount.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-3 py-2 bg-muted/30">
            <span className="text-sm font-medium font-body">Total</span>
            <span className="text-sm font-semibold font-body">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      {job.description && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
            <IconFileDescription className="h-3.5 w-3.5" />
            Description
          </h3>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {job.description}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      {job.notes && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
            <IconNote className="h-3.5 w-3.5" />
            Notes
          </h3>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {job.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
