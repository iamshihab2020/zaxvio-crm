import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bulkToast } from "@/lib/bulk-toast";
import { queryKeys } from "@/lib/query-keys";
import {
  getQuoteStats,
  getQuotes,
  getQuote,
  createQuote,
  updateQuote,
  deleteQuote,
  sendQuote,
  acceptQuote,
  declineQuote,
  convertQuoteToJob,
  bulkArchiveQuotes,
  bulkRestoreQuotes,
  bulkDeleteQuotes,
} from "@/actions/quotes";

// ── Queries ──────────────────────────────────────────────────

/**
 * `initialData` seeds the exact key the server rendered and nothing else.
 *
 * The page used to accept `initialQuotes` / `initialPagination` props and never
 * read them, so every visit fetched the list twice and still showed a skeleton
 * (QUO-14). `initialDataUpdatedAt` is what stops the seed from looking
 * permanently fresh — without it the query would never refetch on mount.
 */
export function useQuotes(
  params: Record<string, unknown>,
  initialData?: Awaited<ReturnType<typeof getQuotes>>,
) {
  return useQuery({
    queryKey: queryKeys.quotes.list(params),
    queryFn: () => getQuotes(params as Parameters<typeof getQuotes>[0]),
    placeholderData: (prev) => prev,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

export function useQuoteStats(
  initialData?: Awaited<ReturnType<typeof getQuoteStats>>,
) {
  return useQuery({
    queryKey: queryKeys.quotes.stats(),
    queryFn: () => getQuoteStats(),
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

export function useQuote(
  id: string,
  initialData?: Awaited<ReturnType<typeof getQuote>>,
) {
  return useQuery({
    queryKey: queryKeys.quotes.detail(id),
    queryFn: () => getQuote(id),
    enabled: !!id,
    staleTime: 30_000,
    initialData,
    initialDataUpdatedAt: initialData ? Date.now() : undefined,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createQuote>[0]) => createQuote(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote created");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to create quote"),
  });
}

export function useUpdateQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateQuote>[1] }) =>
      updateQuote(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote updated");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.quotes.detail(id) });
    },
    onError: () => toast.error("Failed to update quote"),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote deleted");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete quote"),
  });
}

export function useSendQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sendQuote(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote sent");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.quotes.detail(id) });
    },
    onError: () => toast.error("Failed to send quote"),
  });
}

export function useAcceptQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => acceptQuote(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote accepted");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.quotes.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to accept quote"),
  });
}

export function useDeclineQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => declineQuote(id),
    onSuccess: (res, id) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote declined");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.quotes.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to decline quote"),
  });
}

export function useConvertQuoteToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pipelineStageId }: { id: string; pipelineStageId?: string }) =>
      convertQuoteToJob(id, pipelineStageId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Quote converted to job");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to convert quote to job"),
  });
}

export function useBulkArchiveQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveQuotes(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Quotes archived");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
    },
    onError: () => toast.error("Failed to archive quotes"),
  });
}

export function useBulkRestoreQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreQuotes(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Quotes restored");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
    },
    onError: () => toast.error("Failed to restore quotes"),
  });
}

export function useBulkDeleteQuotes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteQuotes(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      bulkToast(res, "Quotes deleted");
      qc.invalidateQueries({ queryKey: queryKeys.quotes.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete quotes"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchQuotes(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.quotes.list(params),
    queryFn: () => getQuotes(params as Parameters<typeof getQuotes>[0]),
  });
}
