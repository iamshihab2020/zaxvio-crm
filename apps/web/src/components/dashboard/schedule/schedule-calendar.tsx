"use client";

import { useCallback, useMemo, useRef, useEffect } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type SlotPropGetter,
} from "react-big-calendar";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import {
  format,
  parse,
  startOfWeek,
  getDay,
} from "date-fns";
import { enUS } from "date-fns/locale/en-US";
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

  /* ── Animate on date/view change ── */
  const calendarRef = useRef<HTMLDivElement>(null);
  const prevKeyRef = useRef("");
  const transitionKey = `${currentView}-${currentDate.toISOString().slice(0, 10)}`;

  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== transitionKey && calendarRef.current) {
      const el = calendarRef.current;
      // 1. Remove transition, set start state
      el.style.transition = "none";
      el.style.opacity = "0";
      el.style.transform = "translateY(6px)";
      // 2. Force reflow so browser registers the start state
      void el.offsetHeight;
      // 3. Add transition and animate to end state
      el.style.transition = "opacity 250ms ease-out, transform 250ms ease-out";
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }
    prevKeyRef.current = transitionKey;
  }, [transitionKey]);

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

  if (isTimeView) {
    return (
      <ScrollArea className="flex-1 min-h-0">
        <div ref={calendarRef} className="schedule-calendar-no-internal-scroll">
          {calendarEl}
        </div>
      </ScrollArea>
    );
  }

  return (
    <div ref={calendarRef} className="flex-1 min-h-0">
      {calendarEl}
    </div>
  );
}
