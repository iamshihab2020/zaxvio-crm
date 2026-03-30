"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconBriefcase, IconCalendar } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getJobs } from "@/actions/jobs";
import {
  JOB_STATUS_COLORS,
  JOB_PRIORITY_LABELS,
  JOB_PRIORITY_COLORS,
  SERVICE_TYPE_LABELS,
  type JobPriority,
  type ServiceType,
} from "@/lib/constants/job-options";

interface JobRow {
  id: string;
  jobNumber: string;
  title: string;
  status: string;
  priority: string;
  serviceType: string;
  scheduledDate: string;
  totalAmount: string;
}

interface CustomerJobsTabProps {
  customerId: string;
}

function formatDate(val: string) {
  const d = new Date(val + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(val: string) {
  return `$${parseFloat(val).toFixed(2)}`;
}

export function CustomerJobsTab({ customerId }: CustomerJobsTabProps) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    getJobs({ customerId, limit: 50 }).then((res) => {
      if (res.data) {
        setJobs(res.data as JobRow[]);
      }
      setLoading(false);
    });
  }, [customerId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
          <IconBriefcase className="h-5 w-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground font-body">
          No jobs yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Jobs for this customer will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Job #
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Title
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Status
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Priority
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Date
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const statusColors =
              JOB_STATUS_COLORS[job.status] ?? JOB_STATUS_COLORS.scheduled;
            const priorityColors =
              JOB_PRIORITY_COLORS[job.priority as JobPriority] ??
              JOB_PRIORITY_COLORS.standard;

            return (
              <tr
                key={job.id}
                className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <td className="px-3 py-2 font-medium font-body">
                  {job.jobNumber}
                </td>
                <td className="px-3 py-2 text-foreground font-body max-w-[200px] truncate">
                  {job.title}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    className={cn(
                      "gap-1.5 px-2 py-0.5 font-medium",
                      statusColors.bg,
                      statusColors.text,
                    )}
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-full", statusColors.dot)}
                    />
                    {job.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge
                    className={cn(
                      "px-2 py-0.5 font-medium",
                      priorityColors.bg,
                      priorityColors.text,
                    )}
                  >
                    {JOB_PRIORITY_LABELS[job.priority as JobPriority] ?? job.priority}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground font-body">
                  <span className="flex items-center gap-1">
                    <IconCalendar className="h-3.5 w-3.5" />
                    {formatDate(job.scheduledDate)}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-medium font-body">
                  {formatCurrency(job.totalAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
