"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  IconChevronLeft,
  IconChevronRight,
  IconCalendarEvent,
  IconCalendarMonth,
  IconCalendarWeek,
  IconCalendarDot,
  IconPlus,
  IconLayoutSidebar,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import {
  format,
  startOfWeek,
  endOfWeek,
  isToday as dateIsToday,
} from "date-fns";
import { useState } from "react";

export type CalendarView = "month" | "week" | "day";

interface ScheduleToolbarProps {
  currentDate: Date;
  currentView: CalendarView;
  onNavigate: (date: Date) => void;
  onViewChange: (view: CalendarView) => void;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCreateEvent?: () => void;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

const VIEW_OPTIONS: { value: CalendarView; label: string; icon: React.ElementType }[] = [
  { value: "month", label: "Month", icon: IconCalendarMonth },
  { value: "week", label: "Week", icon: IconCalendarWeek },
  { value: "day", label: "Day", icon: IconCalendarDot },
];

function formatDateLabel(date: Date, view: CalendarView): string {
  switch (view) {
    case "month":
      return format(date, "MMMM yyyy");
    case "week": {
      const ws = startOfWeek(date, { weekStartsOn: 0 });
      const we = endOfWeek(date, { weekStartsOn: 0 });
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) {
        return `${format(ws, "MMM d")} – ${format(we, "d, yyyy")}`;
      }
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    case "day":
      return format(date, "EEEE, MMMM d, yyyy");
    default:
      return format(date, "MMMM yyyy");
  }
}

/**
 * The same label for a phone, where the full form ("Wednesday, September 30,
 * 2026") is wider than the half of the row it gets. The year goes from week and
 * day, which always sit near today; the month view keeps it.
 */
function formatShortDateLabel(date: Date, view: CalendarView): string {
  switch (view) {
    case "month":
      return format(date, "MMM yyyy");
    case "week": {
      const ws = startOfWeek(date, { weekStartsOn: 0 });
      const we = endOfWeek(date, { weekStartsOn: 0 });
      const sameMonth = ws.getMonth() === we.getMonth();
      return sameMonth
        ? `${format(ws, "MMM d")} – ${format(we, "d")}`
        : `${format(ws, "MMM d")} – ${format(we, "MMM d")}`;
    }
    case "day":
      return format(date, "EEE, MMM d");
    default:
      return format(date, "MMM yyyy");
  }
}

export function ScheduleToolbar({
  currentDate,
  currentView,
  onNavigate,
  onViewChange,
  onToday,
  onPrev,
  onNext,
  onCreateEvent,
  sidebarOpen,
  onToggleSidebar,
}: ScheduleToolbarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const viewingToday = dateIsToday(currentDate) || (currentView === "week" && dateIsToday(startOfWeek(currentDate, { weekStartsOn: 0 })));
  const dateLabel = formatDateLabel(currentDate, currentView);
  const shortDateLabel = formatShortDateLabel(currentDate, currentView);

  return (
    // One row needs about 650px (navigation, the date, New Event, the view
    // switcher), so below `md` the same controls take a 2×2 grid: navigation and
    // New Event on top, the date and the view switcher under them. Those classes
    // are inert once the container is a flex row at `md`.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 border-b border-border/60 px-3 py-1.5 sm:px-4 md:flex md:py-3.5">
      {/* Sidebar toggle + Today + navigation */}
      <div className="col-start-1 row-start-1 flex items-center gap-1.5">
        {onToggleSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={sidebarOpen ? "Hide tasks" : "Show tasks"}
                className={cn(
                  "h-10 w-10 cursor-pointer sm:h-8 sm:w-8",
                  sidebarOpen && "text-brand-ink",
                )}
                onClick={onToggleSidebar}
              >
                <IconLayoutSidebar className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{sidebarOpen ? "Hide tasks" : "Show tasks"}</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className={cn(
                "relative h-10 cursor-pointer gap-1.5 sm:h-8",
                viewingToday
                  ? "bg-brand/10 border-brand/30 text-brand-ink hover:bg-brand/15"
                  : "",
              )}
            >
              <IconCalendarEvent className="h-3.5 w-3.5" />
              Today
              {!viewingToday && (
                <motion.span
                  className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-brand"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Go to today</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Previous ${currentView}`}
              className="h-10 w-10 cursor-pointer sm:h-8 sm:w-8"
              onClick={onPrev}
            >
              <IconChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous {currentView}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Next ${currentView}`}
              className="h-10 w-10 cursor-pointer sm:h-8 sm:w-8"
              onClick={onNext}
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next {currentView}</TooltipContent>
        </Tooltip>
      </div>

      {/* Date label with mini-calendar popover */}
      <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="col-start-1 row-start-2 h-10 min-w-0 cursor-pointer justify-self-start overflow-hidden px-2 font-heading text-base font-semibold sm:h-9"
          >
            <motion.span
              key={dateLabel}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="min-w-0 truncate"
            >
              <span className="sm:hidden">{shortDateLabel}</span>
              <span className="hidden sm:inline">{dateLabel}</span>
            </motion.span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={currentDate}
            onSelect={(date) => {
              if (date) {
                onNavigate(date);
                setDatePickerOpen(false);
              }
            }}
            defaultMonth={currentDate}
          />
        </PopoverContent>
      </Popover>

      {/* New Event */}
      {onCreateEvent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={onCreateEvent}
              aria-label="New event"
              className="col-start-2 row-start-1 h-10 w-10 cursor-pointer gap-1.5 bg-brand px-0 text-brand-foreground hover:bg-brand/90 sm:h-8 sm:w-auto sm:px-3 md:ml-auto"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Event</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Schedule a new event</TooltipContent>
        </Tooltip>
      )}

      {/* Animated view switcher */}
      <div className="relative col-start-2 row-start-2 flex items-center rounded-lg border border-border bg-muted/30 p-0.5 md:ml-0.5">
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewChange(value)}
                aria-label={`${label} view`}
                className={cn(
                  "relative z-10 h-10 w-10 cursor-pointer gap-1 rounded-md px-0 text-xs font-medium sm:h-7 sm:w-auto sm:px-2.5",
                  currentView === value
                    ? "text-brand-foreground hover:text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {currentView === value && (
                  <motion.div
                    layoutId="schedule-view-indicator"
                    className="absolute inset-0 rounded-md bg-brand shadow-sm"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label} view</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
