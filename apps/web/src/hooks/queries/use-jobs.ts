import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkToast } from "@/lib/bulk-toast";
import { queryKeys } from "@/lib/query-keys";
import {
  getJobs,
  getJob,
  createJob,
  updateJob,
  updateJobStatus,
  reorderJobs,
  deleteJob,
  bulkArchiveJobs,
  bulkRestoreJobs,
  bulkDeleteJobs,
  bulkUpdateJobStatus,
} from "@/actions/jobs";

// ── Queries ──────────────────────────────────────────────────

export function useJobs(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: () => getJobs(params as Parameters<typeof getJobs>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: queryKeys.jobs.detail(id),
    queryFn: () => getJob(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createJob>[0]) => createJob(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Job created");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to create job"),
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateJob>[1] }) =>
      updateJob(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to update job"),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      updateJobStatus(id, status),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to update job status"),
  });
}

export function useReorderJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof reorderJobs>[0]) => reorderJobs(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: () => toast.error("Failed to reorder jobs"),
  });
}

export function useDeleteJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Job deleted");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete job"),
  });
}

export function useBulkArchiveJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveJobs(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Jobs archived");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: () => toast.error("Failed to archive jobs"),
  });
}

export function useBulkRestoreJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreJobs(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Jobs restored");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
    },
    onError: () => toast.error("Failed to restore jobs"),
  });
}

export function useBulkDeleteJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteJobs(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Jobs deleted");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete jobs"),
  });
}

export function useBulkUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      bulkUpdateJobStatus(ids, status),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Job statuses updated");
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to update job statuses"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchJobs(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.jobs.list(params),
    queryFn: () => getJobs(params as Parameters<typeof getJobs>[0]),
  });
}
