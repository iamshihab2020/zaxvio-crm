"use client";

import { cn } from "@/lib/utils";
import {
  JOB_PRIORITY_COLORS,
  type JobPriority,
} from "@/lib/constants/job-options";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { IconUser, IconCalendarEvent, IconMapPin } from "@tabler/icons-react";
import type { CalendarEvent } from "./schedule-calendar";

/**
 * Priority → solid background colors for calendar events.
 * These need to be OPAQUE enough to stand out against both light and dark backgrounds.
 */
const EVENT_COLORS: Record<string, { bg: string; border: string; text: string; subtext: string }> = {
  standard: {
    bg: "bg-blue-100 dark:bg-blue-900/70",
    border: "border-l-blue-500 dark:border-l-blue-400",
    text: "text-blue-900 dark:text-blue-100",
    subtext: "text-blue-700/80 dark:text-blue-300/70",
  },
  urgent: {
    bg: "bg-amber-100 dark:bg-amber-900/70",
    border: "border-l-amber-500 dark:border-l-amber-400",
    text: "text-amber-900 dark:text-amber-100",
    subtext: "text-amber-700/80 dark:text-amber-300/70",
  },
  emergency: {
    bg: "bg-red-100 dark:bg-red-900/70",
    border: "border-l-red-500 dark:border-l-red-400",
    text: "text-red-900 dark:text-red-100",
    subtext: "text-red-700/80 dark:text-red-300/70",
  },
};

const BOOKING_COLORS = {
  bg: "bg-teal-100 dark:bg-teal-900/70",
  border: "border-l-teal-500 dark:border-l-teal-400",
  text: "text-teal-900 dark:text-teal-100",
  subtext: "text-teal-700/80 dark:text-teal-300/70",
};

/** Calendar event (user-created) colors keyed by color name */
const CALENDAR_EVENT_COLORS: Record<string, { bg: string; border: string; text: string; subtext: string; dot: string }> = {
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/70",
    border: "border-l-purple-500 dark:border-l-purple-400",
    text: "text-purple-900 dark:text-purple-100",
    subtext: "text-purple-700/80 dark:text-purple-300/70",
    dot: "bg-purple-500",
  },
  blue: {
    bg: "bg-sky-100 dark:bg-sky-900/70",
    border: "border-l-sky-500 dark:border-l-sky-400",
    text: "text-sky-900 dark:text-sky-100",
    subtext: "text-sky-700/80 dark:text-sky-300/70",
    dot: "bg-sky-500",
  },
  green: {
    bg: "bg-emerald-100 dark:bg-emerald-900/70",
    border: "border-l-emerald-500 dark:border-l-emerald-400",
    text: "text-emerald-900 dark:text-emerald-100",
    subtext: "text-emerald-700/80 dark:text-emerald-300/70",
    dot: "bg-emerald-500",
  },
  amber: {
    bg: "bg-orange-100 dark:bg-orange-900/70",
    border: "border-l-orange-500 dark:border-l-orange-400",
    text: "text-orange-900 dark:text-orange-100",
    subtext: "text-orange-700/80 dark:text-orange-300/70",
    dot: "bg-orange-500",
  },
  red: {
    bg: "bg-rose-100 dark:bg-rose-900/70",
    border: "border-l-rose-500 dark:border-l-rose-400",
    text: "text-rose-900 dark:text-rose-100",
    subtext: "text-rose-700/80 dark:text-rose-300/70",
    dot: "bg-rose-500",
  },
  teal: {
    bg: "bg-teal-100 dark:bg-teal-900/70",
    border: "border-l-teal-500 dark:border-l-teal-400",
    text: "text-teal-900 dark:text-teal-100",
    subtext: "text-teal-700/80 dark:text-teal-300/70",
    dot: "bg-teal-500",
  },
};

/** Priority → dot color class */
const PRIORITY_DOT: Record<string, string> = {
  standard: "bg-blue-500",
  urgent: "bg-amber-500",
  emergency: "bg-red-500",
};

export interface ScheduleEventProps {
  event: CalendarEvent;
  title?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
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

  return (
    <div
      className={cn(
        "h-full w-full rounded-md px-2 py-1 border-l-[3px] cursor-pointer overflow-hidden",
        "transition-all hover:brightness-95 dark:hover:brightness-110",
        "shadow-sm",
        colors.bg,
        colors.border,
        isBooking && "border border-l-[3px] border-dashed border-teal-300 dark:border-teal-700",
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
    </div>
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

  return (
    <div className={cn(
      "flex items-center gap-1.5 px-1.5 py-0.5 rounded-md cursor-pointer transition-all min-w-0",
      "hover:brightness-95 dark:hover:brightness-110",
      colors.bg,
    )}>
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isCalendarEvent ? calEvtColors?.dot : isBooking ? "bg-teal-500" : PRIORITY_DOT[priority],
        )}
      />
      <span className={cn("truncate text-xs font-semibold", colors.text)}>
        {isCalendarEvent ? event.title : r.jobNumber ?? event.title}
      </span>
    </div>
  );
}

/** Main event wrapper for week/day views — renders tooltip on hover */
export function ScheduleEvent({ event }: ScheduleEventProps) {
  const r = event.resource;
  const isBooking = r.type === "booking";
  const isCalendarEvent = r.type === "event";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full w-full">
          {event.allDay ? (
            <MonthEventContent event={event} />
          ) : (
            <TimedEventContent event={event} />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-xs bg-popover text-popover-foreground border border-border shadow-lg p-3 z-[60]"
      >
        <div className="space-y-1.5">
          <p className="font-heading font-semibold text-sm">
            {isCalendarEvent
              ? event.title
              : isBooking
                ? "Booking"
                : r.jobNumber}
            {!isBooking && !isCalendarEvent && r.jobNumber && (
              <span className="font-normal text-muted-foreground"> — {event.title.replace(`${r.jobNumber} — `, "")}</span>
            )}
          </p>
          {r.customerName && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IconUser className="h-3 w-3" />
              {r.customerName}
            </p>
          )}
          {r.address && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IconMapPin className="h-3 w-3" />
              <span className="truncate">{r.address}</span>
            </p>
          )}
          <div className="flex items-center gap-2 text-xs">
            {r.priority && !isBooking && !isCalendarEvent && (
              <span className={cn(
                "inline-flex items-center rounded-full px-1.5 py-0.5 font-medium",
                JOB_PRIORITY_COLORS[r.priority as JobPriority]?.bg,
                JOB_PRIORITY_COLORS[r.priority as JobPriority]?.text,
              )}>
                {r.priority}
              </span>
            )}
            {r.serviceType && (
              <span className="text-muted-foreground capitalize">{r.serviceType}</span>
            )}
            {isCalendarEvent && (
              <span className="text-muted-foreground">Event</span>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/** Month-specific event wrapper (used by react-big-calendar month view) */
export function ScheduleMonthEvent({ event }: ScheduleEventProps) {
  const r = event.resource;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="h-full w-full">
          <MonthEventContent event={event} />
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-xs bg-popover text-popover-foreground border border-border shadow-lg p-3 z-[60]"
      >
        <div className="space-y-1.5">
          <p className="font-heading font-semibold text-sm">
            {r.type === "event" ? event.title : r.type === "booking" ? "Booking" : r.jobNumber ?? event.title}
          </p>
          {r.customerName && (
            <p className="text-xs text-muted-foreground">{r.customerName}</p>
          )}
          {r.priority && r.type === "job" && (
            <span className={cn(
              "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium",
              JOB_PRIORITY_COLORS[r.priority as JobPriority]?.bg,
              JOB_PRIORITY_COLORS[r.priority as JobPriority]?.text,
            )}>
              {r.priority}
            </span>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
