import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getJobCosts,
  getJobExpenses,
  addJobExpense,
  updateJobExpense,
  deleteJobExpense,
  type ExpenseInput,
} from "@/actions/job-costing";

// ── Queries ──────────────────────────────────────────────────

export function useJobCosts(jobId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.jobs.costs(jobId),
    queryFn: () => getJobCosts(jobId),
    enabled: enabled && Boolean(jobId),
    // Short: the summary is derived from line items, expenses and hours, all of
    // which are edited on the same screen. Stale margin is the one thing this
    // tab must never show.
    staleTime: 30_000,
  });
}

export function useJobExpenses(jobId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.jobs.expenses(jobId),
    queryFn: () => getJobExpenses(jobId),
    enabled: enabled && Boolean(jobId),
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

/**
 * Every costing mutation invalidates the whole job detail subtree, not just the
 * list it wrote to. An expense changes the cost summary; hours change it; a line
 * item changes it. Invalidating only the collection that was edited is how the
 * headline number ends up disagreeing with the rows beneath it.
 */
function useCostingInvalidation(jobId: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.jobs.detail(jobId) });
  };
}

export function useAddJobExpense(jobId: string) {
  const invalidate = useCostingInvalidation(jobId);
  return useMutation({
    mutationFn: (data: ExpenseInput) => addJobExpense(jobId, data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Expense added");
      invalidate();
    },
    onError: () => toast.error("Failed to add expense"),
  });
}

export function useUpdateJobExpense(jobId: string) {
  const invalidate = useCostingInvalidation(jobId);
  return useMutation({
    mutationFn: (vars: { expenseId: string; data: Partial<ExpenseInput> }) =>
      updateJobExpense(jobId, vars.expenseId, vars.data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Expense updated");
      invalidate();
    },
    onError: () => toast.error("Failed to update expense"),
  });
}

export function useDeleteJobExpense(jobId: string) {
  const invalidate = useCostingInvalidation(jobId);
  return useMutation({
    mutationFn: (expenseId: string) => deleteJobExpense(jobId, expenseId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Expense deleted");
      invalidate();
    },
    onError: () => toast.error("Failed to delete expense"),
  });
}

/*
 * `useUpdateJobLabor` is gone with `PATCH /jobs/:id/labor`. Hours are no longer
 * something a caller can assert — they are the sum of the job's time entries.
 * See `use-job-time.ts`.
 */
