"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getStageColors } from "@/lib/constants/stage-color-presets";
import {
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPE_LABELS,
} from "@/lib/constants/job-options";
import type { JobCardData } from "./kanban-card";
import {
  IconCalendar,
  IconClock,
  IconCurrencyDollar,
  IconMapPin,
} from "@tabler/icons-react";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface JobListViewProps {
  jobs: JobCardData[];
  stages: PipelineStage[];
  onJobClick: (jobId: string) => void;
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

export function JobListView({ jobs, stages, onJobClick }: JobListViewProps) {
  return (
    <div className="space-y-5">
      {stages.map((stage) => {
        const stageJobs = jobs.filter((j) => j.status === stage.name);
        const colors = getStageColors(stage.color);

        return (
          <div key={stage.id}>
            {/* Stage header */}
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-0.5", colors.bg)}>
                <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
                <span className={cn("text-[11px] font-semibold uppercase tracking-wider font-heading", colors.text)}>
                  {stage.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground font-body">{stageJobs.length}</span>
            </div>

            {/* Job rows */}
            {stageJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground/50 font-body pl-2 py-2">
                No jobs
              </p>
            ) : (
              <div className="space-y-1">
                {stageJobs.map((job, index) => {
                  const priorityColors = JOB_PRIORITY_COLORS[job.priority];
                  const customerName =
                    job.customerFirstName || job.customerLastName
                      ? `${job.customerFirstName ?? ""} ${job.customerLastName ?? ""}`.trim()
                      : "No customer";
                  const amount = parseFloat(job.totalAmount);

                  return (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                      onClick={() => onJobClick(job.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border border-border/40 bg-card px-3 py-2.5 cursor-pointer transition-all duration-150",
                        "hover:bg-muted/30 hover:border-border/60",
                      )}
                    >
                      {/* Customer avatar */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-light/40 text-[10px] font-semibold text-brand dark:bg-brand/20 dark:text-brand">
                        {getInitials(job.customerFirstName, job.customerLastName)}
                      </span>

                      {/* Main info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground font-body truncate">
                            {job.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60 font-body shrink-0">
                            {job.jobNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground font-body truncate">
                            {customerName}
                          </span>
                          {job.address && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground/60 font-body truncate">
                                <IconMapPin className="h-2.5 w-2.5 shrink-0" />
                                {job.address}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <Badge className="bg-muted/60 text-muted-foreground px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider border-0 shrink-0">
                        {SERVICE_TYPE_LABELS[job.serviceType]}
                      </Badge>
                      <Badge className={cn("px-1.5 py-0 text-[9px] font-medium border-0 shrink-0", priorityColors.bg, priorityColors.text)}>
                        {JOB_PRIORITY_LABELS[job.priority]}
                      </Badge>

                      {/* Date/time */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                        <IconCalendar className="h-3 w-3" />
                        <span className="font-body">{formatDate(job.scheduledDate)}</span>
                        {job.scheduledStart && (
                          <>
                            <IconClock className="h-3 w-3" />
                            <span className="font-body">{formatTime(job.scheduledStart)}</span>
                          </>
                        )}
                      </div>

                      {/* Amount */}
                      {amount > 0 && (
                        <div className="flex items-center gap-0.5 text-xs font-medium text-foreground font-body shrink-0">
                          <IconCurrencyDollar className="h-3 w-3" />
                          {amount.toFixed(2)}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
