"use client";

import { useCallback, useMemo, useRef, useEffect, type MutableRefObject } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type SlotPropGetter,
  type DayPropGetter,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import {
  format,
  parse,
  startOfWeek,
  getDay,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { AnimatePresence, motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { isTenantToday, tenantNow } from "@/lib/tenant-time";
import { ScheduleEvent, ScheduleMonthEvent } from "./schedule-event";
import type { CalendarView } from "./schedule-toolbar";
import "./calendar-styles.css";

/* ── date-fns localizer ── */
const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

/* ── DnD-enhanced calendar (typed as any to avoid react-big-calendar generic issues) ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DnDCalendar = withDragAndDrop(BigCalendar as any) as any;

/* ── Types ── */
export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: {
    type: "job" | "booking" | "event";
    priority?: string;
    status?: string;
    serviceType?: string;
    jobNumber?: string;
    customerName: string;
    address?: string;
    color?: string;
  };
}

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isActive: boolean;
}

interface ScheduleOverrideSlot {
  overrideDate: string; // YYYY-MM-DD
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  currentView: CalendarView;
  availability: AvailabilitySlot[];
  /** Date-specific closures and custom hours. Take precedence over the weekly schedule. */
  overrides: ScheduleOverrideSlot[];
  /** Tenant IANA timezone — decides which column is "today". */
  timezone: string;
  navigationDirection: MutableRefObject<-1 | 0 | 1>;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEventDrop: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; action: string }) => void;
}

/** Parse "HH:MM" or "HH:MM:SS" to hours as decimal (e.g., "09:30" → 9.5) */
function parseTimeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

/** Local calendar date as YYYY-MM-DD — matches how overrides are keyed. */
function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function ScheduleCalendar({
  events,
  currentDate,
  currentView,
  availability,
  overrides,
  timezone,
  navigationDirection,
  onNavigate,
  onViewChange,
  onSelectEvent,
  onEventDrop,
  onSelectSlot,
}: ScheduleCalendarProps) {
  const overrideByDate = useMemo(
    () => new Map(overrides.map((o) => [o.overrideDate, o])),
    [overrides],
  );

  /* ── Availability-based slot styling ── */
  //
  // Overrides win over the weekly schedule, exactly as they do in the API's
  // availability resolver. The calendar used to read the weekly schedule alone,
  // so a day the contractor had closed in Settings still shaded as open here
  // while the public portal correctly refused to sell it (BOOK-10).
  const slotPropGetter: SlotPropGetter = useCallback(
    (date: Date) => {
      if (availability.length === 0 && overrideByDate.size === 0) return {};

      const override = overrideByDate.get(toDateKey(date));
      let startTime: string | null;
      let endTime: string | null;

      if (override) {
        if (!override.isAvailable) return { className: "schedule-slot-unavailable" };
        startTime = override.startTime;
        endTime = override.endTime;
      } else {
        const slot = availability.find((a) => a.dayOfWeek === date.getDay());
        if (!slot || !slot.isActive) {
          return { className: "schedule-slot-unavailable" };
        }
        startTime = slot.startTime;
        endTime = slot.endTime;
      }

      if (!startTime || !endTime) return { className: "schedule-slot-unavailable" };

      const hours = date.getHours() + date.getMinutes() / 60;
      if (hours < parseTimeToHours(startTime) || hours >= parseTimeToHours(endTime)) {
        return { className: "schedule-slot-unavailable" };
      }
      return {};
    },
    [availability, overrideByDate],
  );

  /* ── Event styling ── */
  const eventPropGetter = useCallback(
    (event: CalendarEvent) => ({
      className: event.resource.type === "booking" ? "rbc-booking-event" : "",
      style: { cursor: "pointer" as const },
    }),
    [],
  );

  /* ── Today column highlight (week/day views) ── */
  // Tenant's today, not the browser's (BOOK-25).
  const dayPropGetter: DayPropGetter = useCallback(
    (date: Date) => {
      if (isTenantToday(date, timezone)) {
        return { className: "schedule-today-column" };
      }
      return {};
    },
    [timezone],
  );

  /* ── Drag handler (prevent booking drag) ── */
  //
  // Bookings are also excluded by `draggableAccessor`, so this is the second of
  // two guards. Deliberate: the accessor governs the drag affordance, this one
  // governs what actually gets written.
  const handleEventDrop = useCallback(
    (args: { event: CalendarEvent; start: Date | string; end: Date | string }) => {
      const { event } = args;
      if (event.resource.type === "booking") return;
      onEventDrop({
        event,
        start: new Date(args.start),
        end: new Date(args.end),
      });
    },
    [onEventDrop],
  );

  /* ── Custom component map ── */
  const components = useMemo(
    () => ({
      event: ScheduleEvent,
      month: {
        event: ScheduleMonthEvent,
      },
      toolbar: () => null,
    }),
    [],
  );

  const isTimeView = currentView === "week" || currentView === "day";

  /* ── Directional transition key ── */
  const transitionKey = `${currentView}-${currentDate.toISOString().slice(0, 10)}`;
  const dir = navigationDirection.current;

  /* ── Scroll to current time on mount/today in week/day views ── */
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isTimeView) return;
    const timer = setTimeout(() => {
      const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]");
      if (!viewport) return;
      // Tenant's current hour — events are laid out in tenant wall-clock time, so
      // scrolling to the browser's hour lands somewhere else entirely (BOOK-25).
      const now = tenantNow(timezone);
      const offset = Math.max(0, (now.getHours() + now.getMinutes() / 60) * 72 - viewport.clientHeight / 3);
      viewport.scrollTo({ top: offset, behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  // Only scroll on mount or when switching to time view
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeView]);

  const calendarEl = (
    <DnDCalendar
      localizer={localizer}
      events={events}
      date={currentDate}
      view={currentView as View}
      onNavigate={onNavigate}
      onView={(v: string) => onViewChange(v as CalendarView)}
      onSelectEvent={(event: CalendarEvent) => onSelectEvent(event)}
      onEventDrop={handleEventDrop}
      components={components}
      eventPropGetter={eventPropGetter}
      slotPropGetter={isTimeView ? slotPropGetter : undefined}
      dayPropGetter={dayPropGetter}
      selectable={!!onSelectSlot}
      onSelectSlot={onSelectSlot}
      longPressThreshold={250}
      resizable={false}
      step={30}
      timeslots={2}
      popup
      showMultiDayTimes
      draggableAccessor={(event: CalendarEvent) => event.resource.type === "job" || event.resource.type === "event"}
      style={{ height: isTimeView ? "auto" : "100%" }}
    />
  );

  /* ── Motion variants for directional transitions ── */
  const isDateNav = dir !== 0;
  const motionProps = {
    initial: isDateNav
      ? { x: dir * 30, opacity: 0 }
      : { scale: 0.98, opacity: 0 },
    animate: isDateNav
      ? { x: 0, opacity: 1 }
      : { scale: 1, opacity: 1 },
    exit: isDateNav
      ? { x: -dir * 30, opacity: 0 }
      : { scale: 1.02, opacity: 0 },
    transition: isDateNav
      ? { duration: 0.2, ease: [0, 0, 0.2, 1] as const }
      : { type: "spring" as const, stiffness: 300, damping: 30 },
  };

  if (isTimeView) {
    return (
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={transitionKey}
            {...motionProps}
            className="schedule-calendar-no-internal-scroll"
          >
            {calendarEl}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        {...motionProps}
        className="flex-1 min-h-0"
      >
        {calendarEl}
      </motion.div>
    </AnimatePresence>
  );
}
