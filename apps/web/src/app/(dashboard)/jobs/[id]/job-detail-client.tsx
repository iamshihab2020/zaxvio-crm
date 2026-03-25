"use client";

import { useState, useCallback } from "react";
import type { JobDetail } from "@/components/dashboard/jobs/job-detail-sheet";
import { getJob } from "@/actions/jobs";
import { JobDetailPageHeader } from "@/components/dashboard/jobs/job-detail-page-header";
import { JobInfoPanel } from "@/components/dashboard/jobs/job-info-panel";
import { JobTabsPanel } from "@/components/dashboard/jobs/job-tabs-panel";
import { JobSidebarPanel } from "@/components/dashboard/jobs/job-sidebar-panel";

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
}

interface JobDetailClientProps {
  job: JobDetail;
  stages: PipelineStage[];
}

export function JobDetailClient({
  job: initialJob,
  stages,
}: JobDetailClientProps) {
  const [job, setJob] = useState<JobDetail>(initialJob);

  const refreshJob = useCallback(async () => {
    const res = await getJob(job.id);
    if (res.data) setJob(res.data as JobDetail);
  }, [job.id]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface">
      <JobDetailPageHeader
        job={job}
        stages={stages}
        onUpdate={refreshJob}
      />
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
          {/* Left Panel */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <JobInfoPanel job={job} stages={stages} />
          </div>
          {/* Center Panel */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <JobTabsPanel job={job} onUpdate={refreshJob} />
          </div>
          {/* Right Sidebar */}
          <div className="hidden xl:block w-72 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <JobSidebarPanel job={job} />
          </div>
        </div>
      </div>
    </div>
  );
}
