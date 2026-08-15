import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getJobTimeEntries,
  getRunningTimer,
  startJobTimer,
  stopJobTimer,
  addJobTimeEntry,
  updateJobTimeEntry,
  deleteJobTimeEntry,
  type TimeEntryInput,
  type TimeEntryUpdate,
} from "@/actions/job-time";

// ── Queries ──────────────────────────────────────────────────

export function useJobTimeEntries(jobId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.jobs.timeEntries(jobId),
    queryFn: () => getJobTimeEntries(jobId),
    enabled: enabled && Boolean(jobId),
    staleTime: 30_000,
  });
}

/**
 * The running timer, polled for the shell bar.
 *
 * `refetchInterval` rather than relying on invalidation, because the timer can
 * end somewhere this tab will never hear about: the hourly sweep closes it, or
 * completing the job stops it, or the user pressed Stop in another tab. A bar
 * that keeps counting up after the clock has actually stopped is worse than no
 * bar — it is the one element of this feature the user is meant to trust.
 *
 * `refetchOnWindowFocus` matters more than the interval on mobile, where the tab
 * is suspended in a pocket for an hour and resumes with a stale elapsed time.
 */
export function useRunningTimer() {
  return useQuery({
    queryKey: queryKeys.jobs.runningTimer(),
    queryFn: () => getRunningTimer(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Every time mutation invalidates two things, and both are required.
 *
 * The job's detail subtree, because hours feed the cost summary and the margin
 * headline — the same reason the costing hooks invalidate the whole subtree
 * rather than the list they wrote to. And the running-timer key, which sits
 * *outside* that subtree on purpose: it belongs to the user, not the job, so a
 * job-scoped invalidation would leave the shell bar showing a timer that has
 * stopped.
 */
function useTimeInvalidation(jobId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
    void qc.invalidateQueries({ queryKey: queryKeys.jobs.runningTimer() });
  };
}

export function useStartJobTimer(jobId: string) {
  const invalidate = useTimeInvalidation(jobId);
  return useMutation({
    mutationFn: (note?: string) => startJobTimer(jobId, note),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Timer started");
      invalidate();
    },
    onError: () => toast.error("Failed to start the timer"),
  });
}

export function useStopJobTimer(jobId: string) {
  const invalidate = useTimeInvalidation(jobId);
  return useMutation({
    mutationFn: (note?: string) => stopJobTimer(jobId, note),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data?.hours ? `Logged ${res.data.hours} hours` : "Timer stopped",
      );
      invalidate();
    },
    onError: () => toast.error("Failed to stop the timer"),
  });
}

export function useAddJobTimeEntry(jobId: string) {
  const invalidate = useTimeInvalidation(jobId);
  return useMutation({
    mutationFn: (data: TimeEntryInput) => addJobTimeEntry(jobId, data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Time logged");
      invalidate();
    },
    onError: () => toast.error("Failed to add the time entry"),
  });
}

export function useUpdateJobTimeEntry(jobId: string) {
  const invalidate = useTimeInvalidation(jobId);
  return useMutation({
    mutationFn: (vars: { entryId: string; data: TimeEntryUpdate }) =>
      updateJobTimeEntry(jobId, vars.entryId, vars.data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Time entry updated");
      invalidate();
    },
    onError: () => toast.error("Failed to update the time entry"),
  });
}

export function useDeleteJobTimeEntry(jobId: string) {
  const invalidate = useTimeInvalidation(jobId);
  return useMutation({
    mutationFn: (entryId: string) => deleteJobTimeEntry(jobId, entryId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Time entry deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete the time entry"),
  });
}
