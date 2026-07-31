"use client";

import { useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  useBookings,
  useCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useAvailability,
} from "@/hooks/queries";
import { bookingLink, scheduleJobLink } from "@/lib/entity-links";
import { tenantNow } from "@/lib/tenant-time";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { Card } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";

import { getJobs, updateJob, deleteJob } from "@/actions/jobs";
import { getPipelineStages } from "@/actions/pipeline-stages";
import { type CalendarEventData } from "@/actions/calendar-events";
import type { JobCardData } from "@/components/dashboard/jobs/kanban-card";
import { JobDetailSheet, type JobDetail } from "@/components/dashboard/jobs/job-detail-sheet";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { EventCreateDialog, type EventFormData } from "@/components/dashboard/schedule/event-create-dialog";

import { ScheduleToolbar, type CalendarView } from "@/components/dashboard/schedule/schedule-toolbar";
import { ScheduleFilters } from "@/components/dashboard/schedule/schedule-filters";
import { ScheduleCalendar, type CalendarEvent } from "@/components/dashboard/schedule/schedule-calendar";
import { ScheduleSkeleton } from "@/components/dashboard/schedule/schedule-skeleton";
import { ScheduleTaskPanel, type TaskFilter } from "@/components/dashboard/schedule/schedule-task-panel";
import type { JobPriority, ServiceType } from "@/lib/constants/job-options";

/* ── Types for bookings ── */
interface BookingData {
  id: string;
  bookingDate: string;
  preferredTime: string | null;
  status: string;
  serviceType: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  address: string | null;
  description: string | null;
}

/** Max rows fetched per source. Surfaced in the UI when hit — see `truncated`. */
const CALENDAR_FETCH_LIMIT = 200;

interface PipelineStage {
  id: string;
  name: string;
  label: string;
  color: string;
  sortOrder: number;
  isDefault: boolean;
}

/* ── Helpers ── */
function getDateRange(date: Date, view: CalendarView): { dateFrom: string; dateTo: string } {
  switch (view) {
    case "month": {
      // Include buffer days visible in month grid (prev/next month overflow)
      const s = startOfMonth(date);
      const e = endOfMonth(date);
      const bufferStart = startOfWeek(s, { weekStartsOn: 0 });
      const bufferEnd = endOfWeek(e, { weekStartsOn: 0 });
      return { dateFrom: format(bufferStart, "yyyy-MM-dd"), dateTo: format(bufferEnd, "yyyy-MM-dd") };
    }
    case "week": {
      const ws = startOfWeek(date, { weekStartsOn: 0 });
      const we = endOfWeek(date, { weekStartsOn: 0 });
      return { dateFrom: format(ws, "yyyy-MM-dd"), dateTo: format(we, "yyyy-MM-dd") };
    }
    case "day":
      return { dateFrom: format(date, "yyyy-MM-dd"), dateTo: format(date, "yyyy-MM-dd") };
    default:
      return { dateFrom: format(date, "yyyy-MM-dd"), dateTo: format(date, "yyyy-MM-dd") };
  }
}

function jobToEvent(job: JobCardData): CalendarEvent {
  const dateStr = job.scheduledDate;
  const customerName = [job.customerFirstName, job.customerLastName].filter(Boolean).join(" ");
  const title = job.jobNumber ? `${job.jobNumber} — ${job.title}` : job.title;

  let start: Date;
  let end: Date;
  let allDay = false;

  if (job.scheduledStart) {
    start = new Date(`${dateStr}T${job.scheduledStart}`);
    if (job.scheduledEnd) {
      end = new Date(`${dateStr}T${job.scheduledEnd}`);
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
    }
  } else {
    // No time specified → all-day event
    start = new Date(`${dateStr}T00:00:00`);
    end = new Date(`${dateStr}T23:59:59`);
    allDay = true;
  }

  return {
    id: job.id,
    title,
    start,
    end,
    allDay,
    resource: {
      type: "job",
      priority: job.priority,
      status: job.status,
      serviceType: job.serviceType,
      jobNumber: job.jobNumber,
      customerName,
      address: job.address ?? undefined,
    },
  };
}

function bookingToEvent(booking: BookingData): CalendarEvent {
  const dateStr = booking.bookingDate;
  const title = `Booking: ${booking.customerName}`;

  let start: Date;
  let end: Date;
  let allDay = false;

  if (booking.preferredTime) {
    start = new Date(`${dateStr}T${booking.preferredTime}`);
    end = new Date(start.getTime() + 60 * 60 * 1000); // +1h
  } else {
    start = new Date(`${dateStr}T00:00:00`);
    end = new Date(`${dateStr}T23:59:59`);
    allDay = true;
  }

  return {
    id: booking.id,
    title,
    start,
    end,
    allDay,
    resource: {
      type: "booking",
      serviceType: booking.serviceType,
      customerName: booking.customerName,
      address: booking.address ?? undefined,
    },
  };
}

function calEventToCalendarEvent(evt: CalendarEventData): CalendarEvent {
  const dateStr = evt.eventDate;

  let start: Date;
  let end: Date;
  let allDay = false;

  if (evt.startTime) {
    start = new Date(`${dateStr}T${evt.startTime}`);
    if (evt.endTime) {
      end = new Date(`${dateStr}T${evt.endTime}`);
    } else {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
  } else {
    start = new Date(`${dateStr}T00:00:00`);
    end = new Date(`${dateStr}T23:59:59`);
    allDay = true;
  }

  return {
    id: evt.id,
    title: evt.title,
    start,
    end,
    allDay,
    resource: {
      type: "event",
      customerName: evt.contactName ?? "",
      address: evt.address ?? undefined,
      color: evt.color ?? "purple",
    },
  };
}

/* ── Main component ── */
interface SchedulePageClientProps {
  /** Tenant IANA timezone, resolved on the server so first paint is correct. */
  timezone: string;
}

export function SchedulePageClient({ timezone }: SchedulePageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Calendar state — opens on the tenant's today, not the browser's (BOOK-25).
  const [currentDate, setCurrentDate] = useState<Date>(() => tenantNow(timezone));
  const [currentView, setCurrentView] = useState<CalendarView>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("schedule-calendar-view");
      if (stored === "month" || stored === "week" || stored === "day") return stored;
    }
    return "week";
  });

  // Filter state
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | null>(null);
  const [showBookings, setShowBookings] = useState(true);

  // Detail sheet state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    searchParams.get("jobId"),
  );
  const [sheetOpen, setSheetOpen] = useState(!!searchParams.get("jobId"));

  // Job detail/delete dialog state
  const [editingJob, setEditingJob] = useState<JobDetail | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deletingJob, setDeletingJob] = useState<JobDetail | null>(null);

  // Navigation direction for calendar transitions (-1 = prev, 0 = view change, 1 = next)
  const navigationDirection = useRef<-1 | 0 | 1>(0);

  // Task sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("schedule-sidebar-open");
      if (stored !== null) return stored === "true";
      // Default: open on large screens, closed on small
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [sidebarFilter, setSidebarFilter] = useState<TaskFilter>("today");

  function handleToggleSidebar() {
    setSidebarOpen((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("schedule-sidebar-open", String(next));
      }
      return next;
    });
  }

  // Calendar event dialog state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEventData | null>(null);
  const [slotInfo, setSlotInfo] = useState<{ date: string; start: string; end: string } | null>(null);

  // Cooldown ref to prevent slot click from reopening dialog immediately after close
  const dialogClosedAtRef = useRef(0);

  /* ── Queries ── */
  const { dateFrom, dateTo } = getDateRange(currentDate, currentView);

  // `placeholderData` keeps the previous range on screen while the next one
  // loads. The date range is part of every query key, so clicking "next week"
  // created three cold keys and `isLoading` replaced the toolbar, filters,
  // sidebar and calendar with a skeleton — on a surface where arrow keys are the
  // primary interaction (BOOK-16).
  const jobsQuery = useQuery({
    queryKey: queryKeys.jobs.list({ dateFrom, dateTo, schedule: true }),
    queryFn: async () => {
      const result = await getJobs({
        dateFrom,
        dateTo,
        limit: CALENDAR_FETCH_LIMIT,
        sortBy: "scheduledDate",
        sortOrder: "asc",
      });
      if (result.error) throw new Error(result.error);
      return {
        rows: (result.data ?? []) as JobCardData[],
        total: result.pagination?.total ?? (result.data ?? []).length,
      };
    },
    placeholderData: (prev) => prev,
  });

  const bookingsQuery = useBookings({ dateFrom, dateTo, limit: CALENDAR_FETCH_LIMIT, schedule: true });

  const calEventsQuery = useCalendarEvents({ dateFrom, dateTo, limit: CALENDAR_FETCH_LIMIT });

  // Full availability payload: weekly schedule *and* date overrides. The calendar
  // read only `weeklySchedule`, so a contractor who blocked 25 December saw the
  // portal correctly refuse bookings while their own calendar showed a normal
  // working day (BOOK-10).
  const availabilityQuery = useAvailability();

  const stagesQuery = useQuery({
    queryKey: queryKeys.pipelines.all,
    queryFn: async () => {
      const result = await getPipelineStages();
      return (result.data as PipelineStage[]) ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Derived data
  const jobs = jobsQuery.data?.rows ?? [];
  const bookings = (bookingsQuery.data?.data ?? []) as BookingData[];
  const calEvents = (calEventsQuery.data?.data ?? []) as CalendarEventData[];
  const weeklySchedule = availabilityQuery.data?.weeklySchedule ?? [];
  const overrides = availabilityQuery.data?.overrides ?? [];
  const stages = stagesQuery.data ?? [];
  const loading = jobsQuery.isLoading || bookingsQuery.isLoading || calEventsQuery.isLoading;

  // A failed query used to be unwrapped with `?? []` and paint an empty week —
  // on a scheduling tool that reads as "you have nothing on" (BOOK-13).
  const loadError =
    (jobsQuery.isError ? jobsQuery.error?.message : null) ??
    bookingsQuery.data?.error ??
    (bookingsQuery.isError ? "Failed to load bookings" : null) ??
    calEventsQuery.data?.error ??
    (calEventsQuery.isError ? "Failed to load calendar events" : null) ??
    null;

  function retryScheduleData() {
    jobsQuery.refetch();
    bookingsQuery.refetch();
    calEventsQuery.refetch();
  }

  // Silent truncation on a calendar is worse than an explicit cap (BOOK-17).
  const truncatedSources: string[] = [];
  if (jobs.length >= CALENDAR_FETCH_LIMIT) truncatedSources.push("jobs");
  if (bookings.length >= CALENDAR_FETCH_LIMIT) truncatedSources.push("bookings");
  if (calEvents.length >= CALENDAR_FETCH_LIMIT) truncatedSources.push("events");

  /** Invalidate all schedule-related queries */
  function invalidateScheduleData() {
    queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.bookings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
  }

  /* ── Mutations ── */

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { scheduledDate: string; scheduledStart: string; scheduledEnd: string } }) => {
      const result = await updateJob(id, data);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      invalidateScheduleData();
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteJob(id);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success("Job deleted");
      setDeletingJob(null);
      setSheetOpen(false);
      setSelectedJobId(null);
      invalidateScheduleData();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Drag/drop calendar event update — kept inline for optimistic update + revert pattern
  const updateCalEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { updateCalendarEvent } = await import("@/actions/calendar-events");
      const result = await updateCalendarEvent(id, data);
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      invalidateScheduleData();
    },
  });

  const createCalEventMutation = useCreateCalendarEvent();
  const updateCalEventSaveMutation = useUpdateCalendarEvent();

  /* ── View persistence ── */
  function handleViewChange(view: CalendarView) {
    navigationDirection.current = 0;
    setCurrentView(view);
    if (typeof window !== "undefined") {
      localStorage.setItem("schedule-calendar-view", view);
    }
  }

  /* ── Navigation ── */
  function handleNavigate(date: Date) {
    navigationDirection.current = date > currentDate ? 1 : date < currentDate ? -1 : 0;
    setCurrentDate(date);
  }

  function handleToday() {
    const now = tenantNow(timezone);
    navigationDirection.current = now > currentDate ? 1 : now < currentDate ? -1 : 0;
    setCurrentDate(now);
  }

  function handlePrev() {
    navigationDirection.current = -1;
    switch (currentView) {
      case "month":
        setCurrentDate((d) => subMonths(d, 1));
        break;
      case "week":
        setCurrentDate((d) => subWeeks(d, 1));
        break;
      case "day":
        setCurrentDate((d) => subDays(d, 1));
        break;
    }
  }

  function handleNext() {
    navigationDirection.current = 1;
    switch (currentView) {
      case "month":
        setCurrentDate((d) => addMonths(d, 1));
        break;
      case "week":
        setCurrentDate((d) => addWeeks(d, 1));
        break;
      case "day":
        setCurrentDate((d) => addDays(d, 1));
        break;
    }
  }

  /* ── Event click ── */
  function handleSelectEvent(event: CalendarEvent) {
    if (event.resource.type === "job") {
      setSelectedJobId(event.id);
      setSheetOpen(true);
      router.replace(scheduleJobLink(event.id), { scroll: false });
    } else if (event.resource.type === "event") {
      const found = calEvents.find((e) => e.id === event.id);
      if (found) handleCalendarEventClick(found);
    } else {
      // Carried no id at all, so clicking a booking landed on an unfiltered list
      // with the sheet shut and no indication which one was meant (BOOK-15).
      router.push(bookingLink(event.id));
    }
  }

  function handleSheetOpenChange(open: boolean) {
    setSheetOpen(open);
    if (!open) {
      setSelectedJobId(null);
      router.replace("/schedule", { scroll: false });
    }
  }

  /* ── Drag-to-reschedule ── */
  async function handleEventDrop({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
  }) {
    if (event.resource.type === "event") {
      // Drag calendar event
      const eventDate = format(start, "yyyy-MM-dd");
      const startTime = format(start, "HH:mm");
      const endTime = format(end, "HH:mm");

      // Optimistic update
      queryClient.setQueryData(
        queryKeys.calendar.events({ dateFrom, dateTo, limit: 200 }),
        (old: { data?: CalendarEventData[] } | undefined) => ({
          ...old,
          data: (old?.data ?? []).map((e) =>
            e.id === event.id ? { ...e, eventDate, startTime, endTime } : e,
          ),
        }),
      );

      try {
        await updateCalEventMutation.mutateAsync({ id: event.id, data: { eventDate, startTime, endTime } });
        toast.success(`Event moved to ${format(start, "MMM d, h:mm a")}`);
      } catch (error) {
        // Revert optimistic update by refetching
        queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
        toast.error(error instanceof Error ? error.message : "Failed to move event");
      }
      return;
    }

    const scheduledDate = format(start, "yyyy-MM-dd");
    const scheduledStart = format(start, "HH:mm");
    const scheduledEnd = format(end, "HH:mm");

    // Optimistic update
    queryClient.setQueryData(
      queryKeys.jobs.list({ dateFrom, dateTo, schedule: true }),
      (old: { rows: JobCardData[]; total: number } | undefined) =>
        old
          ? {
              ...old,
              rows: old.rows.map((j) =>
                j.id === event.id ? { ...j, scheduledDate, scheduledStart, scheduledEnd } : j,
              ),
            }
          : old,
    );

    try {
      await updateJobMutation.mutateAsync({ id: event.id, data: { scheduledDate, scheduledStart, scheduledEnd } });
      toast.success(`Job rescheduled to ${format(start, "MMM d, h:mm a")}`);
    } catch (error) {
      // Revert optimistic update by refetching
      queryClient.invalidateQueries({ queryKey: queryKeys.jobs.all });
      toast.error(error instanceof Error ? error.message : "Failed to reschedule job");
    }
  }

  // NOTE: there is no resize handler. The calendar sets `resizable={false}`, so
  // `onEventResize` could never fire — it was wired through three files and read
  // like a live feature (BOOK-31). Re-enabling resize means restoring both.

  /* ── Job detail sheet callbacks ── */
  function handleEdit(job: JobDetail) {
    setEditingJob(job);
    setCreateDialogOpen(true);
  }

  function handleDelete(job: JobDetail) {
    setDeletingJob(job);
  }

  function confirmDelete() {
    if (!deletingJob) return;
    deleteJobMutation.mutate(deletingJob.id);
  }

  function handleStatusChange() {
    invalidateScheduleData();
  }

  /* ── Calendar event CRUD ── */
  function handleSelectSlot({ start, end }: { start: Date; end: Date; action: string }) {
    // Prevent slot selection from reopening the dialog when clicking outside to close it.
    // The dialog close and slot click fire in the same event loop, so state check alone
    // is not reliable. Use a 300ms cooldown after dialog close.
    if (eventDialogOpen || Date.now() - dialogClosedAtRef.current < 300) return;

    const eventDate = format(start, "yyyy-MM-dd");
    const isTimeSlot = currentView === "week" || currentView === "day";
    const startTime = isTimeSlot ? format(start, "HH:mm") : "";
    const endTime = isTimeSlot ? format(end, "HH:mm") : "";

    setSlotInfo({ date: eventDate, start: startTime, end: endTime });
    setEditingEvent(null);
    setEventDialogOpen(true);
  }

  function handleNewEventButton() {
    setSlotInfo({ date: format(tenantNow(timezone), "yyyy-MM-dd"), start: "", end: "" });
    setEditingEvent(null);
    setEventDialogOpen(true);
  }

  function handleTaskPanelItemClick(type: "job" | "booking" | "event", id: string) {
    if (type === "job") {
      setSelectedJobId(id);
      setSheetOpen(true);
      router.replace(scheduleJobLink(id), { scroll: false });
    } else if (type === "event") {
      const found = calEvents.find((e) => e.id === id);
      if (found) handleCalendarEventClick(found);
    } else {
      router.push(bookingLink(id));
    }
  }

  function handleCalendarEventClick(calEvent: CalendarEventData) {
    setEditingEvent(calEvent);
    setSlotInfo(null);
    setEventDialogOpen(true);
  }

  function closeEventDialog() {
    setEventDialogOpen(false);
    setEditingEvent(null);
    setSlotInfo(null);
    invalidateScheduleData();
  }

  async function handleEventSave(data: EventFormData) {
    const eventPayload = {
      title: data.title,
      eventDate: data.eventDate,
      startTime: data.startTime || undefined,
      endTime: data.endTime || undefined,
      contactName: data.contactName || undefined,
      contactPhone: data.contactPhone || undefined,
      address: data.address || undefined,
      description: data.description || undefined,
      notes: data.notes || undefined,
      color: data.color,
      customerId: data.customerId ?? undefined,
    };

    if (editingEvent) {
      updateCalEventSaveMutation.mutate(
        { id: editingEvent.id, data: eventPayload },
        {
          onSuccess: (res) => {
            if (!res.error) {
              toast.success("Event updated");
              closeEventDialog();
            }
          },
        },
      );
    } else {
      createCalEventMutation.mutate(eventPayload, {
        onSuccess: (res) => {
          if (!res.error) closeEventDialog();
        },
      });
    }
  }

  /* ── Build calendar events (apply filters) ── */
  const filteredJobs = jobs.filter((j) => {
    if (priorityFilter && j.priority !== priorityFilter) return false;
    if (serviceTypeFilter && j.serviceType !== serviceTypeFilter) return false;
    return true;
  });

  const calendarEvents: CalendarEvent[] = [
    ...filteredJobs.map(jobToEvent),
    ...(showBookings
      ? bookings
          .filter((b) => b.status !== "cancelled")
          .map(bookingToEvent)
      : []),
    ...calEvents.map(calEventToCalendarEvent),
  ];

  const eventSaving = createCalEventMutation.isPending || updateCalEventSaveMutation.isPending;

  /* ── Loading state ── */
  if (loading) {
    return <ScheduleSkeleton />;
  }

  /* ── Failure state — an empty calendar must not mean "you have nothing on" ── */
  if (loadError && jobs.length === 0 && bookings.length === 0 && calEvents.length === 0) {
    return (
      <section className="p-4">
        <LoadErrorState
          title="Couldn't load your schedule"
          message={loadError}
          onRetry={retryScheduleData}
          isRetrying={jobsQuery.isFetching || bookingsQuery.isFetching || calEventsQuery.isFetching}
        />
      </section>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Full-height flex column: navbar is h-14 (3.5rem) */}
      <section className="flex flex-col h-[calc(100vh-3.5rem)] p-4 gap-0">
        {/* Partial failure: some sources loaded, at least one didn't. */}
        {loadError && (
          <div
            role="alert"
            className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2"
          >
            <p className="text-xs font-body text-destructive">
              Some items may be missing — {loadError}
            </p>
            <button
              type="button"
              onClick={retryScheduleData}
              className="shrink-0 text-xs font-medium text-destructive underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {/* Explicit cap beats silently omitting appointments (BOOK-17). */}
        {truncatedSources.length > 0 && (
          <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs font-body text-amber-700 dark:text-amber-400">
            Showing the first {CALENDAR_FETCH_LIMIT} {truncatedSources.join(" / ")} for this
            range. Narrow to a week or a day to see everything.
          </p>
        )}

        <div className="flex flex-1 min-h-0 gap-3">
          {/* Collapsible task sidebar */}
          <ScheduleTaskPanel
            open={sidebarOpen}
            jobs={filteredJobs}
            bookings={bookings}
            calEvents={calEvents}
            filter={sidebarFilter}
            onFilterChange={setSidebarFilter}
            onItemClick={handleTaskPanelItemClick}
            onCreateEvent={handleNewEventButton}
            currentDate={currentDate}
          />

          {/* Main calendar card */}
          <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <ScheduleToolbar
              currentDate={currentDate}
              currentView={currentView}
              onNavigate={handleNavigate}
              onViewChange={handleViewChange}
              onToday={handleToday}
              onPrev={handlePrev}
              onNext={handleNext}
              onCreateEvent={handleNewEventButton}
              sidebarOpen={sidebarOpen}
              onToggleSidebar={handleToggleSidebar}
            />

            <ScheduleFilters
              priorityFilter={priorityFilter}
              serviceTypeFilter={serviceTypeFilter}
              showBookings={showBookings}
              onPriorityChange={setPriorityFilter}
              onServiceTypeChange={setServiceTypeFilter}
              onShowBookingsChange={setShowBookings}
            />

            <ScheduleCalendar
              events={calendarEvents}
              currentDate={currentDate}
              currentView={currentView}
              availability={weeklySchedule}
              overrides={overrides}
              timezone={timezone}
              navigationDirection={navigationDirection}
              onNavigate={handleNavigate}
              onViewChange={handleViewChange}
              onSelectEvent={handleSelectEvent}
              onEventDrop={handleEventDrop}
              onSelectSlot={handleSelectSlot}
            />
          </Card>
        </div>

        {/* Job detail sheet (reused from jobs page) */}
        <JobDetailSheet
          jobId={selectedJobId}
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onJobUpdate={handleStatusChange}
          stages={stages}
        />

        {/* Delete confirmation */}
        <DeleteConfirmDialog
          open={!!deletingJob}
          onOpenChange={(open) => !open && setDeletingJob(null)}
          onConfirm={confirmDelete}
          loading={deleteJobMutation.isPending}
          entityName="job"
          itemLabel={deletingJob?.jobNumber ?? ""}
        />

        {/* Event create/edit dialog */}
        <EventCreateDialog
          event={editingEvent}
          open={eventDialogOpen}
          onOpenChange={(open) => {
            setEventDialogOpen(open);
            if (!open) {
              dialogClosedAtRef.current = Date.now();
              setEditingEvent(null);
              setSlotInfo(null);
            }
          }}
          onSave={handleEventSave}
          loading={eventSaving}
          defaultEventDate={slotInfo?.date}
          defaultStartTime={slotInfo?.start}
          defaultEndTime={slotInfo?.end}
        />
      </section>
    </TooltipProvider>
  );
}
