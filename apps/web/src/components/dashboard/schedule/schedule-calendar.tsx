"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useEffect } from "react";
import {
  Calendar as BigCalendar,
  dateFnsLocalizer,
  type View,
  type SlotPropGetter,
  type DayPropGetter,
  type Formats,
  type HeaderProps,
  type DateHeaderProps,
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
import { isTenantToday, tenantNow } from "@/lib/tenant-time";
import { useReplayOnChange } from "@/hooks/use-replay-on-change";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import { cn } from "@/lib/utils";
import { ScheduleEvent, ScheduleMonthEvent, eventDotClass } from "./schedule-event";
import { ScheduleWeekStrip, scheduledCountLabel } from "./schedule-week-strip";
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

/* ── DnD-enhanced calendar ──
   `withDragAndDrop` does *not* erase react-big-calendar's generics — it is
   declared `<TEvent extends object, TResource extends object>` and returns
   `DragAndDropCalendarProps<TEvent, TResource>`, which is `CalendarProps` plus
   the drag props. So the calendar is parameterised with this file's own event
   type and needs no cast at either end.

   The previous version cast `BigCalendar` to `ComponentType<Record<string,
   unknown>>` and the result back through `as unknown as` (itself against
   strict-rules §4). That erased `TEvent` to the library's default `Event`, so
   `components`, `eventPropGetter`, `onSelectEvent` and `draggableAccessor`
   were all checked against `object` — and none of the `CalendarEvent`
   handlers below fit, which is exactly what the build failed on. A cast that
   loses a type argument does not silence an error, it relocates it. (ARC-17) */
const DnDCalendar = withDragAndDrop<CalendarEvent, object>(BigCalendar);

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
  /** The event that was just dragged or edited; its card wears the highlight once. */
  highlightedEventId?: string | null;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  /** A swipe on a touch screen: one day, week or month back or forward. */
  onPrev: () => void;
  onNext: () => void;
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

/**
 * "9 AM" rather than react-big-calendar's "9:00 AM". The gutter labels every
 * hour, so the minutes never say anything, and on a phone the width they took
 * goes back to the day columns.
 */
const FORMATS: Formats = { timeGutterFormat: "h a" };

/**
 * What the header components below need from the calendar. react-big-calendar
 * renders them itself with its own props, so this is how they reach the
 * tenant's today and the day's items without a new component type (and a
 * remount of every header) each time the events change.
 */
const CalendarDayContext = createContext<{
  timezone: string;
  eventsByDay: Map<string, CalendarEvent[]>;
}>({ timezone: "UTC", eventsByDay: new Map() });

/**
 * A week or day column's header: the weekday over the date, with today's date
 * on the brand. Under 3.5rem a column (seven of them on a phone) shows the
 * weekday's initial instead; calendar-styles.css decides, by the column's width.
 */
function DayColumnHeader({ date }: HeaderProps) {
  const { timezone } = useContext(CalendarDayContext);
  return (
    <span className="schedule-day-head">
      <span className="sr-only">{format(date, "EEEE, MMMM d")}</span>
      <span aria-hidden className="schedule-day-head-weekday">
        <span className="schedule-day-head-long">{format(date, "EEE")}</span>
        <span className="schedule-day-head-short">{format(date, "EEEEE")}</span>
      </span>
      <span
        aria-hidden
        className={cn("schedule-day-head-date", isTenantToday(date, timezone) && "schedule-day-head-today")}
      >
        {format(date, "d")}
      </span>
    </span>
  );
}

/**
 * The month view's date. On a wide card it looks like react-big-calendar's own
 * (the number, which opens that day). When the card is narrow, as on a phone,
 * chips with names do not fit in a 45px cell: calendar-styles.css hides them,
 * this button fills the cell, and the day's items show as dots under the
 * number. Tapping anywhere in the cell then opens that day.
 */
function MonthDateHeader({ date, label, drilldownView, onDrillDown }: DateHeaderProps) {
  const { timezone, eventsByDay } = useContext(CalendarDayContext);
  if (!drilldownView) return <span>{label}</span>;
  const items = eventsByDay.get(toDateKey(date)) ?? [];
  return (
    <button
      type="button"
      className="rbc-button-link schedule-month-date"
      onClick={onDrillDown}
      aria-label={`${format(date, "EEEE, MMMM d")}, ${scheduledCountLabel(items.length)}`}
    >
      <span
        className={cn("schedule-month-date-num", isTenantToday(date, timezone) && "schedule-month-date-today")}
      >
        {label}
      </span>
      <span aria-hidden className="schedule-month-dots">
        {items.slice(0, 3).map((event) => (
          <span key={event.id} className={cn("schedule-month-dot", eventDotClass(event.resource))} />
        ))}
      </span>
    </button>
  );
}

export function ScheduleCalendar({
  events,
  currentDate,
  currentView,
  availability,
  overrides,
  timezone,
  highlightedEventId,
  onNavigate,
  onViewChange,
  onPrev,
  onNext,
  onSelectEvent,
  onEventDrop,
  onSelectSlot,
}: ScheduleCalendarProps) {
  // Each day's items in time order, for the week strip and the phone month's dots.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (const event of sorted) {
      const key = toDateKey(event.start);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
    return map;
  }, [events]);
  const dayContext = useMemo(() => ({ timezone, eventsByDay }), [timezone, eventsByDay]);

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
      className: cn(
        event.resource.type === "booking" && "rbc-booking-event",
        // The wash is drawn on the card inside, in calendar-styles.css, because
        // this element is transparent and a background here would be hidden.
        event.id === highlightedEventId && "schedule-event-flash",
      ),
      style: { cursor: "pointer" as const },
    }),
    [highlightedEventId],
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
      week: { header: DayColumnHeader },
      // react-big-calendar hides a single day's header itself; this is for parity.
      day: { header: DayColumnHeader },
      month: {
        event: ScheduleMonthEvent,
        dateHeader: MonthDateHeader,
      },
      toolbar: () => null,
    }),
    [],
  );

  const isTimeView = currentView === "week" || currentView === "day";

  /* ── Range change: the grid crossfades ──
     Prev, next, today, a date pick and a view switch all change the visible
     range. The grid used to be re-keyed inside AnimatePresence, which waited
     for the old range to fade out before the new one could start (an arrow key
     held down queued 200ms per press) and remounted react-big-calendar, so the
     time views lost their scroll position and its measured rows on every step.
     Here the wrapper stays mounted and only its fade restarts, so nothing is
     rebuilt and nothing waits. Opacity only; a slide would need a direction. */
  const transitionKey = `${currentView}-${currentDate.toISOString().slice(0, 10)}`;
  const bodyRef = useRef<HTMLDivElement>(null);
  useReplayOnChange(bodyRef, transitionKey, "motion-appear");

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

  /* ── Swipe to turn the page (touch only; see the hook) ──
     On the wrapper, which stays mounted across views, and not on the strip,
     which has its own swipe for the week. */
  const swipeRef = useRef<HTMLDivElement>(null);
  useSwipeNavigation(swipeRef, { onPrev, onNext });

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
      formats={FORMATS}
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

  return (
    <CalendarDayContext.Provider value={dayContext}>
      <div className="flex min-h-0 flex-1 flex-col">
        {currentView === "day" && (
          <ScheduleWeekStrip
            currentDate={currentDate}
            eventsByDay={eventsByDay}
            timezone={timezone}
            onSelectDate={onNavigate}
          />
        )}
        <div ref={swipeRef} className="flex min-h-0 flex-1 flex-col">
          {isTimeView ? (
            <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
              <div ref={bodyRef} className="schedule-calendar-no-internal-scroll">
                {calendarEl}
              </div>
            </ScrollArea>
          ) : (
            <div ref={bodyRef} className="flex-1 min-h-0">
              {calendarEl}
            </div>
          )}
        </div>
      </div>
    </CalendarDayContext.Provider>
  );
}
