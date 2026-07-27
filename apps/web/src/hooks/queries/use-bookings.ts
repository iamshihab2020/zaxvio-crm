import { useQuery, useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ScheduleOverride } from "@hvac-saas/types";
import { queryKeys } from "@/lib/query-keys";
import {
  getAvailability,
  updateAvailability,
  createScheduleOverride,
  deleteScheduleOverride,
  getBookingStats,
  getBookings,
  getBooking,
  getBookingActivities,
  updateBooking,
  convertBookingToJob,
  cancelBooking,
  bulkArchiveBookings,
  bulkRestoreBookings,
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

export function useBooking(id: string | null) {
  return useQuery({
    queryKey: queryKeys.bookings.detail(id ?? ""),
    queryFn: () => getBooking(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * `booking_activities` rows have been accumulating since April with no reader —
 * no endpoint, no hook, no UI (BOOK-18).
 */
export function useBookingActivities(id: string | null) {
  return useQuery({
    queryKey: queryKeys.bookings.activities(id ?? ""),
    queryFn: () => getBookingActivities(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export interface AvailabilityPayload {
  weeklySchedule: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string | null;
    endTime: string | null;
    isActive: boolean;
  }>;
  overrides: ScheduleOverride[];
  timezone: string;
  slotCapacity: number;
}

/**
 * Weekly schedule + date overrides + tenant timezone + slot capacity.
 *
 * One query key shared by `/settings/bookings` and `/schedule`. The settings page
 * used to sit on raw `useState`/`useEffect` outside TanStack Query entirely, so
 * saving a new schedule invalidated nothing and the calendar kept shading
 * yesterday's hours for up to five minutes (BOOK-20).
 */
export function useAvailability() {
  return useQuery({
    queryKey: queryKeys.bookings.availability(),
    queryFn: async (): Promise<AvailabilityPayload | null> => {
      const res = await getAvailability();
      if (res.error || !res.data) throw new Error(res.error ?? "Failed to load availability");
      return res.data as AvailabilityPayload;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      schedule: Parameters<typeof updateAvailability>[0];
      slotCapacity?: number;
    }) => updateAvailability(vars.schedule, vars.slotCapacity),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Schedule saved");
      // The calendar shades its working hours from this key.
      qc.invalidateQueries({ queryKey: queryKeys.bookings.availability() });
    },
    onError: () => toast.error("Failed to save schedule"),
  });
}

export function useCreateScheduleOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createScheduleOverride>[0]) =>
      createScheduleOverride(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Override added");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.availability() });
    },
    onError: () => toast.error("Failed to add override"),
  });
}

export function useDeleteScheduleOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteScheduleOverride(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Override removed");
      qc.invalidateQueries({ queryKey: queryKeys.bookings.availability() });
    },
    onError: () => toast.error("Failed to remove override"),
  });
}

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

export function useBulkArchiveBookings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkArchiveBookings(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? `${res.succeeded} booking(s) archived`);
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to archive bookings"),
  });
}

export function useBulkRestoreBookings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkRestoreBookings(ids),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message ?? `${res.succeeded} booking(s) restored`);
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.all });
    },
    onError: () => toast.error("Failed to restore bookings"),
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
      // Bookings that were converted to a job are refused, so the job keeps its
      // origin (BOOK-11). Say which ones and why rather than reporting a count
      // the user has to reconcile against the table themselves.
      const errors = (res.errors ?? []) as { id: string; reason: string }[];
      if (res.succeeded > 0) {
        toast.success(`${res.succeeded} booking${res.succeeded === 1 ? "" : "s"} deleted`);
      }
      if (errors.length > 0) {
        toast.error(
          `${errors.length} skipped — ${errors[0].reason}`,
          errors.length > 1 ? { description: `and ${errors.length - 1} more` } : undefined,
        );
      }
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
