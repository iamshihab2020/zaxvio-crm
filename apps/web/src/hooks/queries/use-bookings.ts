import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getBookingStats,
  getBookings,
  getBooking,
  updateBooking,
  convertBookingToJob,
  cancelBooking,
  bulkDeleteBookings,
  bulkUpdateBookingStatus,
} from "@/actions/bookings";

// ── Queries ──────────────────────────────────────────────────

export function useBookings(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.bookings.list(params),
    queryFn: () => getBookings(params as Parameters<typeof getBookings>[0]),
    placeholderData: (prev) => prev,
  });
}

export function useBookingStats() {
  return useQuery({
    queryKey: queryKeys.bookings.stats(),
    queryFn: () => getBookingStats(),
  });
}

export function useBooking(id: string) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(id),
    queryFn: () => getBooking(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useUpdateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateBooking>[1] }) =>
      updateBooking(id, data),
    onSuccess: (res, { id }) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking updated");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.bookings.detail(id) });
    },
    onError: () => toast.error("Failed to update booking"),
  });
}

export function useConvertBookingToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pipelineStageId }: { id: string; pipelineStageId?: string }) =>
      convertBookingToJob(id, pipelineStageId),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking converted to job");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to convert booking"),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelBooking(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Booking cancelled");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to cancel booking"),
  });
}

export function useBulkDeleteBookings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteBookings(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Bookings deleted");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to delete bookings"),
  });
}

export function useBulkUpdateBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      bulkUpdateBookingStatus(ids, status),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? "Booking statuses updated");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
    onError: () => toast.error("Failed to update booking statuses"),
  });
}

// ── Prefetch ─────────────────────────────────────────────────

export function prefetchBookings(qc: QueryClient, params: Record<string, unknown>) {
  return qc.prefetchQuery({
    queryKey: queryKeys.bookings.list(params),
    queryFn: () => getBookings(params as Parameters<typeof getBookings>[0]),
  });
}
