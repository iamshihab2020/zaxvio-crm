"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from "date-fns";

import { getJobs, updateJob, deleteJob } from "@/actions/jobs";
import { getBookings, getAvailability } from "@/actions/bookings";
import { getPipelineStages } from "@/actions/pipeline-stages";
import type { JobCardData } from "@/components/dashboard/jobs/kanban-card";
import { JobDetailSheet, type JobDetail } from "@/components/dashboard/jobs/job-detail-sheet";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";

import { ScheduleToolbar, type CalendarView } from "@/components/dashboard/schedule/schedule-toolbar";
import { ScheduleFilters } from "@/components/dashboard/schedule/schedule-filters";
import { ScheduleCalendar, type CalendarEvent } from "@/components/dashboard/schedule/schedule-calendar";
import { ScheduleSkeleton } from "@/components/dashboard/schedule/schedule-skeleton";
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

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

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

/* ── Main component ── */
export function SchedulePageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Calendar state
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<CalendarView>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("schedule-calendar-view");
      if (stored === "month" || stored === "week" || stored === "day") return stored;
    }
    return "week";
  });

  // Data state
  const [jobs, setJobs] = useState<JobCardData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceType | null>(null);
  const [showBookings, setShowBookings] = useState(true);

  // Detail sheet state
  const [selectedJobId, setSelectedJobId] = useState<string | null>(
    searchParams.get("jobId"),
  );
  const [sheetOpen, setSheetOpen] = useState(!!searchParams.get("jobId"));

  // Create/delete dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobDetail | null>(null);
  const [deletingJob, setDeletingJob] = useState<JobDetail | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Ref to prevent double-fetch
  const fetchingRef = useRef(false);

  /* ── Fetch data ── */
  const fetchData = useCallback(
    async (date: Date, view: CalendarView) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      const { dateFrom, dateTo } = getDateRange(date, view);

      try {
        const [jobsRes, bookingsRes] = await Promise.all([
          getJobs({ dateFrom, dateTo, limit: 200, sortBy: "scheduledDate", sortOrder: "asc" }),
          getBookings({ dateFrom, dateTo, limit: 200 }),
        ]);

        if (jobsRes.data) setJobs(jobsRes.data);
        if (bookingsRes.data) setBookings(bookingsRes.data);
      } finally {
        fetchingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  // Initial load: availability + stages + data
  useEffect(() => {
    async function init() {
      const [availRes, stagesRes] = await Promise.all([
        getAvailability(),
        getPipelineStages(),
      ]);

      if (availRes.data?.weeklySchedule) {
        setAvailability(availRes.data.weeklySchedule);
      }
      if (stagesRes.data) {
        setStages(stagesRes.data);
      }

      await fetchData(currentDate, currentView);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when date/view changes
  useEffect(() => {
    if (!loading) {
      fetchData(currentDate, currentView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, currentView]);

  /* ── View persistence ── */
  function handleViewChange(view: CalendarView) {
    setCurrentView(view);
    if (typeof window !== "undefined") {
      localStorage.setItem("schedule-calendar-view", view);
    }
  }

  /* ── Navigation ── */
  function handleNavigate(date: Date) {
    setCurrentDate(date);
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  function handlePrev() {
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
      router.replace(`/schedule?jobId=${event.id}`, { scroll: false });
    } else {
      // Booking click — navigate to bookings page
      router.push(`/bookings`);
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
    const scheduledDate = format(start, "yyyy-MM-dd");
    const scheduledStart = format(start, "HH:mm");
    const scheduledEnd = format(end, "HH:mm");

    // Optimistic update
    const prevJobs = [...jobs];
    setJobs((prev) =>
      prev.map((j) =>
        j.id === event.id
          ? { ...j, scheduledDate, scheduledStart, scheduledEnd }
          : j,
      ),
    );

    const result = await updateJob(event.id, {
      scheduledDate,
      scheduledStart,
      scheduledEnd,
    });

    if (result.error) {
      setJobs(prevJobs);
      toast.error(result.error);
    } else {
      toast.success(`Job rescheduled to ${format(start, "MMM d, h:mm a")}`);
    }
  }

  async function handleEventResize({
    event,
    start,
    end,
  }: {
    event: CalendarEvent;
    start: Date;
    end: Date;
  }) {
    const scheduledDate = format(start, "yyyy-MM-dd");
    const scheduledStart = format(start, "HH:mm");
    const scheduledEnd = format(end, "HH:mm");

    const prevJobs = [...jobs];
    setJobs((prev) =>
      prev.map((j) =>
        j.id === event.id
          ? { ...j, scheduledDate, scheduledStart, scheduledEnd }
          : j,
      ),
    );

    const result = await updateJob(event.id, {
      scheduledDate,
      scheduledStart,
      scheduledEnd,
    });

    if (result.error) {
      setJobs(prevJobs);
      toast.error(result.error);
    }
  }

  /* ── Job detail sheet callbacks ── */
  function handleEdit(job: JobDetail) {
    setEditingJob(job);
    setCreateDialogOpen(true);
  }

  function handleDelete(job: JobDetail) {
    setDeletingJob(job);
  }

  async function confirmDelete() {
    if (!deletingJob) return;
    setDeleteLoading(true);
    const result = await deleteJob(deletingJob.id);
    setDeleteLoading(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Job deleted");
      setDeletingJob(null);
      setSheetOpen(false);
      setSelectedJobId(null);
      fetchData(currentDate, currentView);
    }
  }

  function handleStatusChange() {
    fetchData(currentDate, currentView);
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
  ];

  /* ── Loading state ── */
  if (loading) {
    return <ScheduleSkeleton />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Full-height flex column: navbar is h-14 (3.5rem) */}
      <section className="flex flex-col h-[calc(100vh-3.5rem)] p-4 gap-0">
        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ScheduleToolbar
            currentDate={currentDate}
            currentView={currentView}
            onNavigate={handleNavigate}
            onViewChange={handleViewChange}
            onToday={handleToday}
            onPrev={handlePrev}
            onNext={handleNext}
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
            availability={availability}
            onNavigate={handleNavigate}
            onViewChange={handleViewChange}
            onSelectEvent={handleSelectEvent}
            onEventDrop={handleEventDrop}
            onEventResize={handleEventResize}
          />
        </Card>

        {/* Job detail sheet (reused from jobs page) */}
        <JobDetailSheet
          jobId={selectedJobId}
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          stages={stages}
        />

        {/* Delete confirmation */}
        <DeleteConfirmDialog
          open={!!deletingJob}
          onOpenChange={(open) => !open && setDeletingJob(null)}
          onConfirm={confirmDelete}
          loading={deleteLoading}
          entityName="job"
          itemLabel={deletingJob?.jobNumber ?? ""}
        />
      </section>
    </TooltipProvider>
  );
}
