"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { JobDetail } from "@/components/dashboard/jobs/job-detail-sheet";
import { useJob } from "@/hooks/queries";
import { queryKeys } from "@/lib/query-keys";
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

/**
 * JOB-40: this page kept its job in `useState` and refetched by hand, so the
 * TanStack Query migration ("all 14 page-clients migrated") never reached it —
 * and a mutation made from here could not invalidate the jobs list. It reads
 * through `useJob` now, seeded by the server render, so mutation hooks that
 * invalidate `queryKeys.jobs.detail(id)` actually reach this page.
 */

export function JobDetailClient({
  job: initialJob,
  stages,
}: JobDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("jobs");

  const jobQuery = useJob(initialJob.id);
  // The server already rendered this job; fall back to it until the query
  // resolves so there is never a blank frame on first paint.
  const job = (jobQuery.data?.data as JobDetail | undefined) ?? initialJob;

  // JOB-38: these were two effects racing on the same value. On mount with a
  // stored preference of "sidebar", the first set it to "page" while the second
  // read the still-stale "sidebar" and pushed straight back to /jobs — so any
  // deep link into a job bounced to the list. Landing on this route *is* the
  // preference; only a later, deliberate change should navigate.
  const adoptedPageMode = useRef(false);
  useEffect(() => {
    if (!viewMounted || adoptedPageMode.current) return;
    adoptedPageMode.current = true;
    if (viewMode !== "page") setViewMode("page");
  }, [viewMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate back to the list only when the user switches away *after* arriving.
  useEffect(() => {
    if (!viewMounted || !adoptedPageMode.current) return;
    if (viewMode === "page") return;
    router.push(`/jobs?jobId=${job.id}`);
  }, [viewMode, viewMounted, router, job.id]);

  const refreshJob = useCallback(async () => {
    const res = await jobQuery.refetch();
    const result = res.data;
    if (result?.data) {
      // Keep the list and the board in step with an edit made from this page.
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      return;
    }
    // Was `if (res.data) setJob(...)` with no else, so a failed refresh after a
    // save left the old values on screen looking saved.
    if (result?.status === 404) {
      toast.error("This job no longer exists.");
      router.push("/jobs");
      return;
    }
    toast.error(result?.error ?? "Couldn't refresh this job");
  }, [jobQuery, queryClient, router]);

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
            <JobInfoPanel job={job} stages={stages} onUpdate={refreshJob} />
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
