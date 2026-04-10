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
  isToday,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import { AnimatePresence, motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface ScheduleCalendarProps {
  events: CalendarEvent[];
  currentDate: Date;
  currentView: CalendarView;
  availability: AvailabilitySlot[];
  navigationDirection: MutableRefObject<-1 | 0 | 1>;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onEventDrop: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
  onEventResize: (args: { event: CalendarEvent; start: Date; end: Date }) => void;
  onSelectSlot?: (slotInfo: { start: Date; end: Date; action: string }) => void;
}

/** Parse "HH:MM" string to hours as decimal (e.g., "09:30" → 9.5) */
function parseTimeToHours(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

export function ScheduleCalendar({
  events,
  currentDate,
  currentView,
  availability,
  navigationDirection,
  onNavigate,
  onViewChange,
  onSelectEvent,
  onEventDrop,
  onEventResize,
  onSelectSlot,
}: ScheduleCalendarProps) {
  /* ── Availability-based slot styling ── */
  const slotPropGetter: SlotPropGetter = useCallback(
    (date: Date) => {
      if (availability.length === 0) return {};
      const dow = date.getDay();
      const slot = availability.find((a) => a.dayOfWeek === dow);
      if (!slot || !slot.isActive) {
        return { className: "schedule-slot-unavailable" };
      }
      const hours = date.getHours() + date.getMinutes() / 60;
      const slotStart = parseTimeToHours(slot.startTime);
      const slotEnd = parseTimeToHours(slot.endTime);
      if (hours < slotStart || hours >= slotEnd) {
        return { className: "schedule-slot-unavailable" };
      }
      return {};
    },
    [availability],
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
  const dayPropGetter: DayPropGetter = useCallback((date: Date) => {
    if (isToday(date)) {
      return { className: "schedule-today-column" };
    }
    return {};
  }, []);

  /* ── Drag handlers (prevent booking drag) ── */
  const handleEventDrop = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => {
      const event = args.event as CalendarEvent;
      if (event.resource.type === "booking") return;
      onEventDrop({
        event,
        start: args.start as Date,
        end: args.end as Date,
      });
    },
    [onEventDrop],
  );

  const handleEventResize = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (args: any) => {
      const event = args.event as CalendarEvent;
      if (event.resource.type === "booking") return;
      onEventResize({
        event,
        start: args.start as Date,
        end: args.end as Date,
      });
    },
    [onEventResize],
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
      const now = new Date();
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
      onEventResize={handleEventResize}
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
