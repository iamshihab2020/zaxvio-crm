import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkToast } from "@/lib/bulk-toast";
import { queryKeys } from "@/lib/query-keys";
import {
  getInvoiceStats,
  getInvoices,
  getInvoice,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  sendInvoice,
  voidInvoice,
  recordPayment,
  deletePayment,
  payInvoiceInFull,
  remindInvoice,
  addInvoiceLineItem,
  updateInvoiceLineItem,
  deleteInvoiceLineItem,
  bulkArchiveInvoices,
  bulkRestoreInvoices,
  bulkDeleteInvoices,
  bulkUpdateInvoiceStatus,
} from "@/actions/invoices";

/**
 * Every mutation that changes an invoice has to invalidate three things: the
 * lists, the stat cards and that invoice's detail. Writing it out per hook is
 * how `useSendInvoice` and `useVoidInvoice` ended up refreshing the list while
 * leaving the open sheet showing the old status.
 */
function invalidateInvoice(qc: QueryClient, id?: string) {
  qc.invalidateQueries({ queryKey: queryKeys.invoices.all });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  if (id) qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(id) });
}

// ── Queries ──────────────────────────────────────────────────

interface SeedOptions<T> {
  initialData?: T;
  /** When the server read `initialData`. Without it the seed never ages. */
  initialFetchedAt?: number;
  /** False when the server rendered a *different* key than this one. */
  canSeed?: boolean;
}

export function useInvoices(
  params: Record<string, unknown>,
  seed?: SeedOptions<Awaited<ReturnType<typeof getInvoices>>>,
) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => getInvoices(params as Parameters<typeof getInvoices>[0]),
    placeholderData: (prev) => prev,
    // INV-15: the server fetched invoices + stats + tenant and the client
    // referenced none of them, so every load paid twice and still showed a
    // skeleton. Seeded here, but only for the exact key the server produced —
    // seeding unconditionally is the bug the jobs audit fixed (JOB-05): change
    // the filter and you get the previous filter's rows for the whole staleTime.
    ...(seed?.canSeed && seed.initialData
      ? { initialData: seed.initialData, initialDataUpdatedAt: seed.initialFetchedAt }
      : {}),
  });
}

export function useInvoiceStats(
  params?: Record<string, unknown>,
  seed?: SeedOptions<Awaited<ReturnType<typeof getInvoiceStats>>>,
) {
  return useQuery({
    queryKey: queryKeys.invoices.stats(params ?? {}),
    queryFn: () => getInvoiceStats(params as Parameters<typeof getInvoiceStats>[0]),
    ...(seed?.canSeed && seed.initialData
      ? { initialData: seed.initialData, initialDataUpdatedAt: seed.initialFetchedAt }
      : {}),
  });
}

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id ?? "__none__"),
    queryFn: () => getInvoice(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createInvoice>[0]) => createInvoice(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice created");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to create invoice"),
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateInvoice>[1] }) =>
      updateInvoice(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice updated");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to update invoice"),
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice deleted");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to delete invoice"),
  });
}

export function useSendInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendInvoice(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice sent");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to send invoice"),
  });
}

export function useVoidInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => voidInvoice(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Invoice voided");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to void invoice"),
  });
}

export function useRemindInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remindInvoice(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment reminder sent");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to send reminder"),
  });
}

// ── Payments ─────────────────────────────────────────────────

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof recordPayment>[1] }) =>
      recordPayment(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment recorded");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to record payment"),
  });
}

export function usePayInFull() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Parameters<typeof payInvoiceInFull>[1] }) =>
      payInvoiceInFull(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked as paid in full");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to record payment"),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, paymentId }: { id: string; paymentId: string }) =>
      deletePayment(id, paymentId),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment removed");
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to remove payment"),
  });
}

// ── Line items ───────────────────────────────────────────────

export function useAddInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof addInvoiceLineItem>[1] }) =>
      addInvoiceLineItem(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to add line item"),
  });
}

export function useUpdateInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      lineItemId,
      data,
    }: {
      id: string;
      lineItemId: string;
      data: Parameters<typeof updateInvoiceLineItem>[2];
    }) => updateInvoiceLineItem(id, lineItemId, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to update line item"),
  });
}

export function useDeleteInvoiceLineItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, lineItemId }: { id: string; lineItemId: string }) =>
      deleteInvoiceLineItem(id, lineItemId),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      invalidateInvoice(qc, id);
    },
    onError: () => toast.error("Failed to remove line item"),
  });
}

// ── Bulk ─────────────────────────────────────────────────────

export function useBulkArchiveInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveInvoices(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Invoices archived");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to archive invoices"),
  });
}

export function useBulkRestoreInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreInvoices(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Invoices restored");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to restore invoices"),
  });
}

export function useBulkDeleteInvoices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteInvoices(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Invoices deleted");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to delete invoices"),
  });
}

/**
 * INV-26: the server action and the endpoint both existed, fully wired, and no
 * hook and no UI reached them — a dead path that was also unguarded per INV-01.
 * The guard is now server-side and the bulk bar exposes it.
 */
export function useBulkUpdateInvoiceStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      bulkUpdateInvoiceStatus(ids, status),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Invoice status updated");
      invalidateInvoice(qc);
    },
    onError: () => toast.error("Failed to update invoice status"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchInvoices(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => getInvoices(params as Parameters<typeof getInvoices>[0]),
  });
}
