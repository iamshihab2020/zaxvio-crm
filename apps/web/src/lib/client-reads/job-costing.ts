/**
 * Browser reads for job costing: the TanStack Query side of
 * `@/actions/job-costing`. Same paths, fallback text and `ApiResult` shape as
 * the server actions; see lib/api-client.ts for why.
 */
import type { JobCostSummary, JobExpense } from "@hvac-saas/types";
import { readResult } from "@/lib/api-client";

export async function getJobCosts(jobId: string) {
  return readResult<JobCostSummary>(`/jobs/${jobId}/costs`, "Failed to load costs");
}

export async function getJobExpenses(jobId: string) {
  return readResult<JobExpense[]>(`/jobs/${jobId}/expenses`, "Failed to load expenses");
}
