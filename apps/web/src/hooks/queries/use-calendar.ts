import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/actions/calendar-events";

// ── Queries ──────────────────────────────────────────────────

export function useCalendarEvents(params: Record<string, unknown>) {
  return useQuery({
    queryKey: queryKeys.calendar.events(params),
    queryFn: () => getCalendarEvents(params as Parameters<typeof getCalendarEvents>[0]),
  });
}

// ── Mutations ────────────────────────────────────────────────

export function useCreateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof createCalendarEvent>[0]) => createCalendarEvent(data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event created");
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
    onError: () => toast.error("Failed to create event"),
  });
}

export function useUpdateCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateCalendarEvent>[1] }) =>
      updateCalendarEvent(id, data),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all });
      qc.invalidateQueries({ queryKey: queryKeys.jobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.bookings.all });
    },
    onError: () => toast.error("Failed to update event"),
  });
}

export function useDeleteCalendarEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: (res) => {
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Event deleted");
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all });
    },
    onError: () => toast.error("Failed to delete event"),
  });
}
