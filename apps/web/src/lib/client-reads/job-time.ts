/**
 * Browser reads for job time tracking: the TanStack Query side of
 * `@/actions/job-time`. Same paths, fallback text and `ApiResult` shape as the
 * server actions; see lib/api-client.ts for why.
 */
import type { JobTimeEntryView, RunningTimer } from "@hvac-saas/types";
import { readResult } from "@/lib/api-client";

export async function getJobTimeEntries(jobId: string) {
  return readResult<JobTimeEntryView[]>(
    `/jobs/${jobId}/time-entries`,
    "Failed to load time entries",
  );
}

export async function getRunningTimer() {
  return readResult<RunningTimer | null>(
    `/jobs/time-entries/running`,
    "Failed to load timer",
  );
}
