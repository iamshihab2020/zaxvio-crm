"use server";

import { apiGet, apiSend, apiVoid } from "@/lib/api-fetch";
import type { JobTimeEntryView, RunningTimer } from "@hvac-saas/types";

export interface TimeEntryInput {
  startedAt: string;
  endedAt: string;
  /** Owner/admin only — log time on behalf of someone else. Omit for yourself. */
  userId?: string;
  note?: string;
  hourlyCostRate?: string | null;
}

export type TimeEntryUpdate = Partial<Omit<TimeEntryInput, "userId">> & {
  note?: string | null;
};

export async function getJobTimeEntries(jobId: string) {
  return apiGet<JobTimeEntryView[]>(`/jobs/${jobId}/time-entries`, {
    fallback: "Failed to load time entries",
  });
}

/**
 * The current user's running timer, or null.
 *
 * `RunningTimer | null` rather than an array, because the partial unique index
 * guarantees at most one — the type says what the database enforces instead of
 * making every caller handle a list that can never have two elements.
 */
export async function getRunningTimer() {
  return apiGet<RunningTimer | null>(`/jobs/time-entries/running`, {
    fallback: "Failed to load timer",
  });
}

export async function startJobTimer(jobId: string, note?: string) {
  return apiSend<JobTimeEntryView>(
    `/jobs/${jobId}/time-entries/start`,
    "POST",
    { note },
    { fallback: "Failed to start the timer" },
  );
}

export async function stopJobTimer(jobId: string, note?: string) {
  return apiSend<JobTimeEntryView>(
    `/jobs/${jobId}/time-entries/stop`,
    "POST",
    { note },
    { fallback: "Failed to stop the timer" },
  );
}

export async function addJobTimeEntry(jobId: string, data: TimeEntryInput) {
  return apiSend<JobTimeEntryView>(
    `/jobs/${jobId}/time-entries`,
    "POST",
    data,
    { fallback: "Failed to add the time entry" },
  );
}

export async function updateJobTimeEntry(
  jobId: string,
  entryId: string,
  data: TimeEntryUpdate,
) {
  return apiSend<JobTimeEntryView>(
    `/jobs/${jobId}/time-entries/${entryId}`,
    "PATCH",
    data,
    { fallback: "Failed to update the time entry" },
  );
}

export async function deleteJobTimeEntry(jobId: string, entryId: string) {
  return apiVoid(
    `/jobs/${jobId}/time-entries/${entryId}`,
    "DELETE",
    undefined,
    { fallback: "Failed to delete the time entry" },
  );
}
