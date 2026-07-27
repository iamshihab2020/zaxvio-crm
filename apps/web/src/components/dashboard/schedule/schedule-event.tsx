"use client";

import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import { IconUser, IconCalendarEvent } from "@tabler/icons-react";
import {
  AgendaHoverCard,
  type AgendaDetails,
} from "@/components/dashboard/shared/agenda-hover-card";
import { bookingLink, scheduleJobLink } from "@/lib/entity-links";
import type { CalendarEvent } from "./schedule-calendar";

/** Check if an event is currently in progress */
function isEventActive(start: Date, end: Date): boolean {
  const now = new Date();
  return now >= start && now <= end;
}

/**
 * Priority → solid background colors for calendar events.
 * These need to be OPAQUE enough to stand out against both light and dark backgrounds.
 */
/**
 * Priority → softer pastel background colors for calendar events (Motion-inspired).
 */
const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; subtext: string }> = {
  standard: {
    bg: "bg-blue-50 dark:bg-blue-950/50",
    border: "border-l-blue-400 dark:border-l-blue-500",
    text: "text-blue-800 dark:text-blue-200",
    subtext: "text-blue-600/80 dark:text-blue-400/70",
  },
  urgent: {
    bg: "bg-amber-50 dark:bg-amber-950/50",
    border: "border-l-amber-400 dark:border-l-amber-500",
    text: "text-amber-800 dark:text-amber-200",
    subtext: "text-amber-600/80 dark:text-amber-400/70",
  },
  emergency: {
    bg: "bg-red-50 dark:bg-red-950/50",
    border: "border-l-red-400 dark:border-l-red-500",
    text: "text-red-800 dark:text-red-200",
    subtext: "text-red-600/80 dark:text-red-400/70",
  },
};

const BOOKING_COLORS = {
  bg: "bg-teal-50 dark:bg-teal-950/50",
  border: "border-l-teal-400 dark:border-l-teal-500",
  text: "text-teal-800 dark:text-teal-200",
  subtext: "text-teal-600/80 dark:text-teal-400/70",
};

/** Calendar event (user-created) colors keyed by color name — softer pastels */
const CALENDAR_EVENT_COLORS: Record<string, { bg: string; border: string; text: string; subtext: string; dot: string }> = {
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/50",
    border: "border-l-purple-400 dark:border-l-purple-500",
    text: "text-purple-800 dark:text-purple-200",
    subtext: "text-purple-600/80 dark:text-purple-400/70",
    dot: "bg-purple-500",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-950/50",
    border: "border-l-sky-400 dark:border-l-sky-500",
    text: "text-sky-800 dark:text-sky-200",
    subtext: "text-sky-600/80 dark:text-sky-400/70",
    dot: "bg-sky-500",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    border: "border-l-emerald-400 dark:border-l-emerald-500",
    text: "text-emerald-800 dark:text-emerald-200",
    subtext: "text-emerald-600/80 dark:text-emerald-400/70",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-orange-50 dark:bg-orange-950/50",
    border: "border-l-orange-400 dark:border-l-orange-500",
    text: "text-orange-800 dark:text-orange-200",
    subtext: "text-orange-600/80 dark:text-orange-400/70",
    dot: "bg-orange-500",
  },
  red: {
    bg: "bg-rose-50 dark:bg-rose-950/50",
    border: "border-l-rose-400 dark:border-l-rose-500",
    text: "text-rose-800 dark:text-rose-200",
    subtext: "text-rose-600/80 dark:text-rose-400/70",
    dot: "bg-rose-500",
  },
  teal: {
    bg: "bg-teal-50 dark:bg-teal-950/50",
    border: "border-l-teal-400 dark:border-l-teal-500",
    text: "text-teal-800 dark:text-teal-200",
    subtext: "text-teal-600/80 dark:text-teal-400/70",
    dot: "bg-teal-500",
  },
};

/** Priority → dot color class */
const PRIORITY_DOT: Record<string, string> = {
  standard: "bg-blue-500",
  urgent: "bg-amber-500",
  emergency: "bg-red-500",
};

/**
 * react-big-calendar spreads its own internal props onto custom event
 * components. `unknown` accepts them without letting anything read them
 * untyped — `any` here would have let a typo through silently.
 */
export interface ScheduleEventProps {
  event: CalendarEvent;
  title?: string;
  [key: string]: unknown;
}

function toAgendaDetails(event: CalendarEvent): AgendaDetails {
  const r = event.resource;
  const colors = getEventColors(r);
  const dotColorHex =
    r.type === "booking"
      ? "#14b8a6"
      : r.type === "event"
        ? (CALENDAR_EVENT_COLORS[r.color ?? "purple"] ? hexFromColorName(r.color ?? "purple") : "#6366f1")
        : r.priority === "emergency"
          ? "#ef4444"
          : r.priority === "urgent"
            ? "#f59e0b"
            : "hsl(var(--brand))";
  return {
    kind: r.type,
    title:
      r.type === "event"
        ? event.title
        : r.type === "booking"
          ? "Booking"
          : r.jobNumber ?? event.title,
    subtitle: r.customerName,
    customerName: r.customerName,
    address: r.address,
    serviceType: r.serviceType,
    priority: r.priority,
    start: event.start,
    end: event.end,
    // Both of these were wrong: `?job=` carried a job *number* to a page that
    // reads `jobId`, and `?booking=` to a page that reads `bookingId` (BOOK-14).
    href:
      r.type === "job"
        ? scheduleJobLink(event.id)
        : r.type === "booking"
          ? bookingLink(event.id)
          : `/schedule`,
    color: dotColorHex,
  };
  // `colors` unused here but kept importable in case future inlined UI wants it
  void colors;
}

function hexFromColorName(name: string): string {
  const map: Record<string, string> = {
    purple: "#a855f7",
    blue: "#3b82f6",
    green: "#22c55e",
    red: "#ef4444",
    amber: "#f59e0b",
    teal: "#14b8a6",
  };
  return map[name] ?? "#6366f1";
}

function getEventColors(r: CalendarEvent["resource"]) {
  if (r.type === "event") {
    return CALENDAR_EVENT_COLORS[r.color ?? "purple"] ?? CALENDAR_EVENT_COLORS.purple;
  }
  if (r.type === "booking") return BOOKING_COLORS;
  return EVENT_COLORS[r.priority ?? "standard"] ?? EVENT_COLORS.standard;
}

/** Event component for Week/Day views (timed events with more space) */
function TimedEventContent({ event }: { event: CalendarEvent }) {
  const r = event.resource;
  const isBooking = r.type === "booking";
  const isCalendarEvent = r.type === "event";
  const colors = getEventColors(r);
  const active = !event.allDay && isEventActive(event.start, event.end);
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reducedMotion ? undefined : { y: -1, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      role="button"
      tabIndex={0}
      aria-label={
        isCalendarEvent
          ? event.title
          : isBooking
            ? `Booking for ${r.customerName}`
            : `Job ${r.jobNumber ?? event.title} for ${r.customerName}`
      }
      className={cn(
        "h-full w-full rounded-lg px-2 py-1.5 border-l-[3px] cursor-pointer overflow-hidden",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        colors.bg,
        colors.border,
        isBooking && "border border-l-[3px] border-dashed border-teal-200 dark:border-teal-800",
        active && "schedule-event-active",
      )}
    >
      <div className="flex items-center gap-1 min-w-0">
        {(isBooking || isCalendarEvent) && (
          <IconCalendarEvent className={cn("h-3 w-3 shrink-0", colors.text)} />
        )}
        <span className={cn("truncate text-xs font-semibold leading-tight", colors.text)}>
          {isBooking ? "Booking" : isCalendarEvent ? event.title : r.jobNumber ?? event.title}
        </span>
      </div>
      {r.customerName && (
        <div className={cn("flex items-center gap-1 mt-0.5 min-w-0", colors.subtext)}>
          <IconUser className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate text-[0.65rem] leading-tight font-medium">
            {r.customerName}
          </span>
        </div>
      )}
    </motion.div>
  );
}

/** Event component for Month view and all-day events (compact, less space) */
function MonthEventContent({ event }: { event: CalendarEvent }) {
  const r = event.resource;
  const isBooking = r.type === "booking";
  const isCalendarEvent = r.type === "event";
  const priority = r.priority ?? "standard";
  const colors = getEventColors(r);
  const calEvtColors = isCalendarEvent ? CALENDAR_EVENT_COLORS[r.color ?? "purple"] ?? CALENDAR_EVENT_COLORS.purple : null;
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={reducedMotion ? undefined : { x: 2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25, duration: 0.15 }}
      role="button"
      tabIndex={0}
      className={cn(
        "flex items-center gap-1.5 px-2 py-0.5 rounded-lg cursor-pointer min-w-0",
        colors.bg,
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isCalendarEvent ? calEvtColors?.dot : isBooking ? "bg-teal-500" : PRIORITY_DOT[priority],
        )}
      />
      <span className={cn("truncate text-xs font-semibold", colors.text)}>
        {isCalendarEvent ? event.title : r.jobNumber ?? event.title}
      </span>
    </motion.div>
  );
}

/** Main event wrapper for week/day views — renders hover card with rich details */
export function ScheduleEvent({ event }: ScheduleEventProps) {
  return (
    <AgendaHoverCard details={toAgendaDetails(event)}>
      <div className="h-full w-full cursor-pointer">
        {event.allDay ? (
          <MonthEventContent event={event} />
        ) : (
          <TimedEventContent event={event} />
        )}
      </div>
    </AgendaHoverCard>
  );
}

/** Month-specific event wrapper (used by react-big-calendar month view) */
export function ScheduleMonthEvent({ event }: ScheduleEventProps) {
  return (
    <AgendaHoverCard details={toAgendaDetails(event)}>
      <div className="h-full w-full cursor-pointer">
        <MonthEventContent event={event} />
      </div>
    </AgendaHoverCard>
  );
}
