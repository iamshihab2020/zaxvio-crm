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

export interface LaborInput {
  /** Null clears the recorded hours, which clears the snapshotted rate with them. */
  actualHours: string | null;
  /** Omit to let the server resolve it from the assignee, then the tenant default. */
  laborCostRate?: string | null;
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

export async function updateJobLabor(jobId: string, data: LaborInput) {
  return apiSend<{ id: string; actualHours: string | null; laborCostRate: string | null }>(
    `/jobs/${jobId}/labor`,
    "PATCH",
    data,
    { fallback: "Failed to save hours" },
  );
}
