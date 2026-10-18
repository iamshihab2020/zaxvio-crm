"use client";

import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  IconPlus,
  IconCalendarEvent,
  IconClipboardList,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format, addDays } from "date-fns";
import type { CalendarEventData } from "@/actions/calendar-events";
import { useStagger } from "@/hooks/use-stagger";
import { useReplayOnChange } from "@/hooks/use-replay-on-change";
import { DUR, EASE_OUT } from "@/lib/motion";

/* ── Types ── */
export type TaskFilter = "today" | "upcoming" | "completed";

interface TaskItem {
  id: string;
  title: string;
  type: "job" | "booking" | "event";
  date: string;
  time: string | null;
  customerName: string;
  priority?: string;
  status?: string;
  color?: string;
}

interface ScheduleTaskPanelProps {
  /**
   * Where the panel lives. From `xl` it is a 288px column beside the calendar.
   * Below that the same column would take too much of the calendar's width (a
   * phone is left with about 40px of it, a 1024px tablet with a 470px week), so
   * it opens as a sheet over the calendar.
   */
  inline: boolean;
  open: boolean;
  /** Only the sheet closes itself (overlay tap, Escape, the close button). */
  onOpenChange: (open: boolean) => void;
  jobs: Array<{
    id: string;
    title: string;
    jobNumber: string;
    scheduledDate: string;
    scheduledStart: string | null;
    scheduledEnd: string | null;
    priority: string;
    status: string;
    customerFirstName: string | null;
    customerLastName: string | null;
  }>;
  bookings: Array<{
    id: string;
    bookingDate: string;
    preferredTime: string | null;
    status: string;
    serviceType: string;
    customerName: string;
  }>;
  calEvents: CalendarEventData[];
  filter: TaskFilter;
  onFilterChange: (filter: TaskFilter) => void;
  onItemClick: (type: "job" | "booking" | "event", id: string) => void;
  onCreateEvent: () => void;
  currentDate: Date;
}

const FILTER_OPTIONS: { value: TaskFilter; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Done" },
];

const PRIORITY_DOT: Record<string, string> = {
  standard: "bg-blue-500",
  urgent: "bg-amber-500",
  emergency: "bg-red-500",
};

function getEventDot(item: TaskItem): string {
  if (item.type === "job") return PRIORITY_DOT[item.priority ?? "standard"] ?? "bg-blue-500";
  if (item.type === "booking") return "bg-teal-500";
  // calendar event colors
  const colorMap: Record<string, string> = {
    purple: "bg-purple-500",
    blue: "bg-sky-500",
    green: "bg-emerald-500",
    amber: "bg-orange-500",
    red: "bg-rose-500",
    teal: "bg-teal-500",
  };
  return colorMap[item.color ?? "purple"] ?? "bg-purple-500";
}

function formatTime(time: string | null): string {
  if (!time) return "All day";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function ScheduleTaskPanel({
  inline,
  open,
  onOpenChange,
  jobs,
  bookings,
  calEvents,
  filter,
  onFilterChange,
  onItemClick,
  onCreateEvent,
  currentDate,
}: ScheduleTaskPanelProps) {
  // Build unified task items
  const allItems: TaskItem[] = [
    ...jobs.map((j) => ({
      id: j.id,
      title: j.jobNumber ? `${j.jobNumber} — ${j.title}` : j.title,
      type: "job" as const,
      date: j.scheduledDate,
      time: j.scheduledStart,
      customerName: [j.customerFirstName, j.customerLastName].filter(Boolean).join(" "),
      priority: j.priority,
      status: j.status,
    })),
    ...bookings
      .filter((b) => b.status !== "cancelled")
      .map((b) => ({
        id: b.id,
        title: `Booking: ${b.customerName}`,
        type: "booking" as const,
        date: b.bookingDate,
        time: b.preferredTime,
        customerName: b.customerName,
        status: b.status,
      })),
    ...calEvents.map((e) => ({
      id: e.id,
      title: e.title,
      type: "event" as const,
      date: e.eventDate,
      time: e.startTime,
      customerName: e.contactName ?? "",
      color: e.color,
    })),
  ];

  // Filter items
  const todayStr = format(currentDate, "yyyy-MM-dd");
  const upcomingEnd = format(addDays(currentDate, 14), "yyyy-MM-dd");

  const filteredItems = allItems
    .filter((item) => {
      if (filter === "today") return item.date === todayStr;
      if (filter === "upcoming") return item.date > todayStr && item.date <= upcomingEnd;
      if (filter === "completed") return item.status === "completed";
      return true;
    })
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
    });

  const inSheet = !inline;

  // The list arrives in sequence when the tab or the day changes. Keyed on those
  // two, not on the items: an event dragged off today should leave quietly, not
  // replay the rest.
  const listRef = useRef<HTMLDivElement>(null);
  useStagger(listRef, `${filter}:${todayStr}`);

  // The docked column slides in from the side it lives on when it is opened. It
  // is mounted only while open, so there is no width to animate (the calendar
  // takes the space at once); react-big-calendar is told to re-measure.
  const columnRef = useRef<HTMLDivElement>(null);
  useReplayOnChange(columnRef, inline ? open : null, "motion-step-back");
  const measured = useRef(false);
  useEffect(() => {
    if (!inline) return;
    if (!measured.current) {
      measured.current = true;
      return;
    }
    window.dispatchEvent(new Event("resize"));
  }, [open, inline]);

  // The sheet covers the calendar, so choosing something has to uncover it: a
  // job opens its own sheet and an event its dialog, and either would otherwise
  // stack on top of this one.
  function handleItemClick(type: "job" | "booking" | "event", id: string) {
    if (inSheet) onOpenChange(false);
    onItemClick(type, id);
  }

  function handleCreateEvent() {
    if (inSheet) onOpenChange(false);
    onCreateEvent();
  }

  const panel = (
    <div
      className={cn(
        "flex flex-col bg-card",
        inSheet ? "min-h-0 flex-1" : "h-full w-72 rounded-lg border border-border",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <IconClipboardList className="h-4 w-4 text-muted-foreground" />
          {inSheet ? (
            <SheetTitle className="font-heading text-sm font-semibold">Tasks</SheetTitle>
          ) : (
            <span className="font-heading text-sm font-semibold">Tasks</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="New event"
            className={cn(
              "cursor-pointer",
              inSheet ? "h-10 w-10 sm:h-8 sm:w-8" : "h-7 w-7",
            )}
            onClick={handleCreateEvent}
          >
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
          {inSheet && (
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close tasks"
                className="h-10 w-10 cursor-pointer sm:h-8 sm:w-8"
              >
                <IconX className="h-4 w-4" />
              </Button>
            </SheetClose>
          )}
        </div>
      </div>

      {/* Filter tabs with animated pill */}
      <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
        {FILTER_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            onClick={() => onFilterChange(opt.value)}
            className={cn(
              "relative z-10 cursor-pointer rounded-full font-medium",
              inSheet ? "h-10 px-4 text-xs sm:h-8" : "h-6 px-2.5 text-[0.7rem]",
              filter === opt.value
                ? "text-brand-foreground hover:text-brand-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {filter === opt.value && (
              <motion.div
                layoutId="task-filter-pill"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ duration: DUR.state / 1000, ease: EASE_OUT }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </Button>
        ))}
      </div>

      {/* Task list */}
      <ScrollArea className="flex-1 min-h-0">
        <div ref={listRef} className="p-2 space-y-0.5">
            {filteredItems.length === 0 && (
              <div className="motion-appear flex flex-col items-center justify-center py-8 text-center">
                <IconCalendarEvent className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  {filter === "today" && "No tasks for today"}
                  {filter === "upcoming" && "No upcoming tasks"}
                  {filter === "completed" && "No completed tasks"}
                </p>
              </div>
            )}
            {filteredItems.map((item) => {
              return (
                <div key={item.id}>
                  <button
                    onClick={() => handleItemClick(item.type, item.id)}
                    className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors duration-200 hover:bg-muted/50 cursor-pointer"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        getEventDot(item),
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-foreground">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {formatTime(item.time)}
                        {item.customerName && ` · ${item.customerName}`}
                      </p>
                      {filter === "upcoming" && (
                        <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5">
                          {format(new Date(`${item.date}T00:00:00`), "EEE, MMM d")}
                        </p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[0.6rem] shrink-0 mt-0.5">
                      {item.type === "job" ? "Job" : item.type === "booking" ? "Booking" : "Event"}
                    </Badge>
                  </button>
                </div>
              );
            })}
        </div>
      </ScrollArea>
    </div>
  );

  if (inSheet) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          aria-describedby={undefined}
          // `dvh`, not the sheet's `h-full`: on a phone the address bar slides
          // over the bottom of a fixed full-height panel.
          className="flex h-dvh w-80 max-w-[85vw] flex-col gap-0 bg-card p-0 sm:max-w-80"
        >
          {panel}
        </SheetContent>
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div ref={columnRef} className="shrink-0">
      {panel}
    </div>
  );
}
