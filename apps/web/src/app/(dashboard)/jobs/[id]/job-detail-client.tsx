"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { JobDetail } from "@/components/dashboard/jobs/job-detail-sheet";
import { getJob } from "@/actions/jobs";
import { JobDetailPageHeader } from "@/components/dashboard/jobs/job-detail-page-header";
import { JobInfoPanel } from "@/components/dashboard/jobs/job-info-panel";
import { JobTabsPanel } from "@/components/dashboard/jobs/job-tabs-panel";
import { JobSidebarPanel } from "@/components/dashboard/jobs/job-sidebar-panel";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";

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
  const router = useRouter();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("jobs");
  const [job, setJob] = useState<JobDetail>(initialJob);

  // Set preference to "page" since user is on the full page view
  useEffect(() => {
    if (viewMounted && viewMode !== "page") {
      setViewMode("page");
    }
  }, [viewMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user switches away from "page" mode, navigate back to list with deep-link
  useEffect(() => {
    if (viewMounted && viewMode !== "page") {
      router.push(`/jobs?jobId=${job.id}`);
    }
  }, [viewMode, viewMounted, router, job.id]);

  const refreshJob = useCallback(async () => {
    const res = await getJob(job.id);
    if (res.data) setJob(res.data as JobDetail);
  }, [job.id]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <JobDetailPageHeader
        job={job}
        stages={stages}
        onUpdate={refreshJob}
      >
        {viewMounted && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </JobDetailPageHeader>
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
