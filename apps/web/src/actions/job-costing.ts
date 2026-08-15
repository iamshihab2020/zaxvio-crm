"use server";

import { apiGet, apiSend, apiVoid } from "@/lib/api-fetch";
import type { JobCostSummary, JobExpense } from "@hvac-saas/types";

export interface ExpenseInput {
  category: string;
  description: string;
  amount: string;
  incurredOn: string;
  vendor?: string;
}

export async function getJobCosts(jobId: string) {
  return apiGet<JobCostSummary>(`/jobs/${jobId}/costs`, {
    fallback: "Failed to load costs",
  });
}

export async function getJobExpenses(jobId: string) {
  return apiGet<JobExpense[]>(`/jobs/${jobId}/expenses`, {
    fallback: "Failed to load expenses",
  });
}

export async function addJobExpense(jobId: string, data: ExpenseInput) {
  return apiSend<JobExpense>(`/jobs/${jobId}/expenses`, "POST", data, {
    fallback: "Failed to add expense",
  });
}

export async function updateJobExpense(
  jobId: string,
  expenseId: string,
  data: Partial<ExpenseInput>,
) {
  return apiSend<JobExpense>(
    `/jobs/${jobId}/expenses/${expenseId}`,
    "PATCH",
    data,
    { fallback: "Failed to update expense" },
  );
}

export async function deleteJobExpense(jobId: string, expenseId: string) {
  return apiVoid(`/jobs/${jobId}/expenses/${expenseId}`, "DELETE", undefined, {
    fallback: "Failed to delete expense",
  });
}

/*
 * `updateJobLabor` is gone with the endpoint behind it. Labour is recorded as
 * time entries now — see `actions/job-time.ts`.
 */
