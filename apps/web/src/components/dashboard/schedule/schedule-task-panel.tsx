"use client";

import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  IconPlus,
  IconCalendarEvent,
  IconBriefcase,
  IconCalendarCheck,
  IconClipboardList,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { format, isToday, isBefore, startOfDay, addDays } from "date-fns";
import type { CalendarEventData } from "@/actions/calendar-events";

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
  open: boolean;
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

const TYPE_ICON: Record<string, React.ElementType> = {
  job: IconBriefcase,
  booking: IconCalendarCheck,
  event: IconCalendarEvent,
};

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
  open,
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

  return (
    <motion.div
      animate={{
        width: open ? 288 : 0,
        opacity: open ? 1 : 0,
      }}
      initial={false}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onAnimationComplete={() => {
        window.dispatchEvent(new Event("resize"));
      }}
      className="shrink-0 overflow-hidden"
    >
      <div className="flex h-full w-72 flex-col rounded-lg border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <IconClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="font-heading text-sm font-semibold">Tasks</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 cursor-pointer"
            onClick={onCreateEvent}
          >
            <IconPlus className="h-3.5 w-3.5" />
          </Button>
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
                "relative h-6 cursor-pointer px-2.5 text-[0.7rem] font-medium rounded-full z-10",
                filter === opt.value
                  ? "text-brand-foreground hover:text-brand-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {filter === opt.value && (
                <motion.div
                  layoutId="task-filter-pill"
                  className="absolute inset-0 rounded-full bg-brand"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <span className="relative z-10">{opt.label}</span>
            </Button>
          ))}
        </div>

        {/* Task list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-0.5">
            <AnimatePresence mode="popLayout">
              {filteredItems.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center py-8 text-center"
                >
                  <IconCalendarEvent className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {filter === "today" && "No tasks for today"}
                    {filter === "upcoming" && "No upcoming tasks"}
                    {filter === "completed" && "No completed tasks"}
                  </p>
                </motion.div>
              )}
              {filteredItems.map((item, index) => {
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: index * 0.02, duration: 0.2 }}
                  >
                    <button
                      onClick={() => onItemClick(item.type, item.id)}
                      className="flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50 cursor-pointer"
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}
