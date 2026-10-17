/**
 * Browser reads for jobs: the TanStack Query side of `@/actions/jobs`.
 * Same signature, query keys, error text and return shape as the server
 * action, so a hook switches by import alone. See lib/api-client.ts for why.
 */
import type * as actions from "@/actions/jobs";
import { pickQuery, readJson } from "@/lib/api-client";

const JOB_LIST_KEYS = [
  "pipelineId",
  "assigneeId",
  "search",
  "status",
  "customerId",
  "serviceType",
  "priority",
  "dateFrom",
  "dateTo",
  "page",
  "limit",
  "sortBy",
  "sortOrder",
  "showArchived",
] as const;

export async function getJobs(params?: Parameters<typeof actions.getJobs>[0]) {
  const r = await readJson(`/jobs${pickQuery(params, JOB_LIST_KEYS)}`, "Failed to fetch jobs");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getJob(id: string) {
  const r = await readJson(`/jobs/${id}`, "Failed to load job");
  if (!r.ok) return { data: null, error: r.error, status: r.status };
  return { data: r.json.data, error: null, status: r.status };
}

export async function getJobAssignees() {
  const r = await readJson("/jobs/assignees", "Failed to fetch assignees");
  if (!r.ok) return { data: null, error: r.error };
  return {
    data: r.json.data as Array<{
      id: string;
      name: string;
      image: string | null;
      email: string;
      role: string;
    }>,
    error: null,
  };
}

const PAGE_KEYS = ["page", "limit"] as const;

export async function getJobPhotos(jobId: string, tag?: string) {
  const qs = tag ? `?tag=${tag}` : "";
  const r = await readJson(`/jobs/${jobId}/photos${qs}`, "Failed to fetch photos");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}

export async function getJobActivities(
  jobId: string,
  params?: { page?: number; limit?: number },
) {
  const r = await readJson(
    `/jobs/${jobId}/activities${pickQuery(params, PAGE_KEYS)}`,
    "Failed to fetch activities",
  );
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, pagination: r.json.pagination, error: null };
}

export async function getJobDocuments(jobId: string) {
  const r = await readJson(`/jobs/${jobId}/documents`, "Failed to fetch documents");
  if (!r.ok) return { data: null, error: r.error };
  return { data: r.json.data, error: null };
}
