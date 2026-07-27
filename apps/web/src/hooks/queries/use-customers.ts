import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkToast } from "@/lib/bulk-toast";
import { queryKeys } from "@/lib/query-keys";
import {
  getCustomerStats,
  getCustomers,
  getCustomer,
  getCustomerSummary,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  bulkArchiveCustomers,
  bulkRestoreCustomers,
  bulkDeleteCustomers,
  getCustomerNotes,
  createCustomerNote,
  updateCustomerNote,
  deleteCustomerNote,
  getCustomerActivities,
  getCustomerTags,
  addCustomerTag,
  removeCustomerTag,
  getCustomerPhotos,
} from "@/actions/customers";

// ── Queries ──────────────────────────────────────────────────

export function useCustomers(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getCustomers(params as Parameters<typeof getCustomers>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useCustomerStats() {
  return useQuery({
    queryKey: queryKeys.customers.stats(),
    queryFn: () => getCustomerStats(),
  });
}

export function useCustomer(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id),
    queryFn: () => getCustomer(id),
    enabled: !!id && enabled,
    staleTime: 30_000,
  });
}

/** Aggregated counts + outstanding balance — one query, computed in SQL (CUST-05). */
export function useCustomerSummary(customerId: string) {
  return useQuery({
    queryKey: queryKeys.customers.summary(customerId),
    queryFn: () => getCustomerSummary(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useCustomerNotes(customerId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.customers.notes(customerId, params),
    queryFn: () => getCustomerNotes(customerId, params),
    enabled: !!customerId,
    placeholderData: (prev) => prev,
  });
}

export function useCustomerActivities(
  customerId: string,
  params?: { page?: number; limit?: number },
) {
  return useQuery({
    queryKey: queryKeys.customers.activities(customerId, params),
    queryFn: () => getCustomerActivities(customerId, params),
    enabled: !!customerId,
    placeholderData: (prev) => prev,
  });
}

export function useCustomerTags(customerId: string) {
  return useQuery({
    queryKey: queryKeys.customers.tags(customerId),
    queryFn: () => getCustomerTags(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  });
}

export function useCustomerPhotos(customerId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.customers.photos(customerId, params),
    queryFn: () => getCustomerPhotos(customerId, params),
    enabled: !!customerId,
    placeholderData: (prev) => prev,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createCustomer>[0]) => createCustomer(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer created");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to create customer"),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCustomer>[1] }) =>
      updateCustomer(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer updated");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(id) });
    },
    onError: () => toast.error("Failed to update customer"),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: (res) => {
      if (res.error) {
        // The API refuses the delete with a precise, useful reason ("they still
        // have 2 jobs, 1 invoice…"). The detail header used to throw it away and
        // leave the dialog sitting open with no explanation (CUST-10).
        toast.error(res.error);
        return;
      }
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete customer"),
  });
}

export function useBulkArchiveCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveCustomers(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Customers archived");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
    onError: () => toast.error("Failed to archive customers"),
  });
}

export function useBulkRestoreCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreCustomers(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Customers restored");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
    },
    onError: () => toast.error("Failed to restore customers"),
  });
}

export function useBulkDeleteCustomers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteCustomers(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Customers deleted");
      qc.invalidateQueries({ queryKey: queryKeys.customers.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete customers"),
  });
}

// ── Notes ────────────────────────────────────────────────────
//
// The notes tab used to hold its own array in `useState` and re-fetch the whole
// list after every write. Invalidating the customer's detail key refreshes the
// notes *and* the activity timeline, which now records note edits too (CUST-22).

export function useCreateCustomerNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => createCustomerNote(customerId, content),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Note added");
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
    },
    onError: () => toast.error("Failed to add note"),
  });
}

export function useUpdateCustomerNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      updateCustomerNote(customerId, noteId, content),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Note updated");
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
    },
    onError: () => toast.error("Failed to update note"),
  });
}

export function useDeleteCustomerNote(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => deleteCustomerNote(customerId, noteId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Note deleted");
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) });
    },
    onError: () => toast.error("Failed to delete note"),
  });
}

// ── Tags ─────────────────────────────────────────────────────

export function useAddCustomerTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => addCustomerTag(customerId, tagId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.customers.tags(customerId) });
      qc.invalidateQueries({ queryKey: queryKeys.customers.activities(customerId) });
    },
    onError: () => toast.error("Failed to add tag"),
  });
}

export function useRemoveCustomerTag(customerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagId: string) => removeCustomerTag(customerId, tagId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.customers.tags(customerId) });
      qc.invalidateQueries({ queryKey: queryKeys.customers.activities(customerId) });
    },
    onError: () => toast.error("Failed to remove tag"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchCustomers(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.customers.list(params),
    queryFn: () => getCustomers(params as Parameters<typeof getCustomers>[0]),
  });
}
