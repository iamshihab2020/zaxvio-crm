"use client";

import { useRef } from "react";
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from "date-fns";
import { cn } from "@/lib/utils";
import { isTenantToday } from "@/lib/tenant-time";
import { useSwipeNavigation } from "@/hooks/use-swipe-navigation";
import { eventDotClass } from "./schedule-event";
import type { CalendarEvent } from "./schedule-calendar";

/** Dots drawn under a day. More than this and a plus says so. */
const MAX_DOTS = 3;

interface ScheduleWeekStripProps {
  currentDate: Date;
  /** The loaded week's items, keyed by `yyyy-MM-dd`, in time order. */
  eventsByDay: Map<string, CalendarEvent[]>;
  /** Tenant IANA timezone, so "today" agrees with the rest of the page. */
  timezone: string;
  onSelectDate: (date: Date) => void;
}

export function scheduledCountLabel(count: number): string {
  if (count === 0) return "nothing scheduled";
  return `${count} scheduled`;
}

/**
 * The day view's week, in one row above the grid: the weekday, the date and a
 * dot per item, so a phone sees which days are full without leaving the day it
 * is on. Tap a day to open it; swipe the row to change week. The day view
 * fetches its whole week for this (see `getDateRange`), which also makes
 * stepping between days of one week instant.
 */
export function ScheduleWeekStrip({
  currentDate,
  eventsByDay,
  timezone,
  onSelectDate,
}: ScheduleWeekStripProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const ref = useRef<HTMLDivElement>(null);
  useSwipeNavigation(ref, {
    onPrev: () => onSelectDate(subWeeks(currentDate, 1)),
    onNext: () => onSelectDate(addWeeks(currentDate, 1)),
  });

  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Week of ${format(weekStart, "MMMM d")}`}
      className="grid grid-cols-7 gap-0.5 border-b border-border/60 px-1.5 py-1 sm:px-3"
    >
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const items = eventsByDay.get(key) ?? [];
        const selected = isSameDay(day, currentDate);
        const today = isTenantToday(day, timezone);

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDate(day)}
            aria-current={selected ? "date" : undefined}
            aria-label={`${format(day, "EEEE, MMMM d")}, ${scheduledCountLabel(items.length)}`}
            className={cn(
              "flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg py-1 transition-colors duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !selected && "[@media(hover:hover)]:hover:bg-muted/50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "text-[0.7rem] font-medium leading-none",
                today && !selected ? "text-brand-ink" : "text-muted-foreground",
              )}
            >
              {format(day, "EEE")}
            </span>
            <span
              aria-hidden
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors duration-200",
                selected
                  ? "bg-brand text-brand-foreground"
                  : today
                    ? "text-brand-ink ring-1 ring-inset ring-brand/40"
                    : "text-foreground",
              )}
            >
              {format(day, "d")}
            </span>
            <span aria-hidden className="flex h-1.5 items-center gap-0.5">
              {items.slice(0, MAX_DOTS).map((event) => (
                <span
                  key={event.id}
                  className={cn("h-1.5 w-1.5 rounded-full", eventDotClass(event.resource))}
                />
              ))}
              {items.length > MAX_DOTS && (
                <span className="text-[0.6rem] font-semibold leading-none text-muted-foreground">+</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
