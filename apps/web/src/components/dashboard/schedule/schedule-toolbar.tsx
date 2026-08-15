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

  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60">
      {/* Left: Sidebar toggle + Today + navigation */}
      <div className="flex items-center gap-1.5">
        {onToggleSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8 cursor-pointer",
                  sidebarOpen && "text-brand",
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
                "relative cursor-pointer gap-1.5",
                viewingToday
                  ? "bg-brand/10 border-brand/30 text-brand hover:bg-brand/15"
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
              className="h-8 w-8 cursor-pointer"
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
              className="h-8 w-8 cursor-pointer"
              onClick={onNext}
            >
              <IconChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next {currentView}</TooltipContent>
        </Tooltip>

        {/* Date label with mini-calendar popover */}
        <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="font-heading text-base font-semibold cursor-pointer px-2 overflow-hidden"
            >
              <motion.span
                key={dateLabel}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {dateLabel}
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
      </div>

      {/* Right: New Event + View switcher */}
      <div className="flex items-center gap-2">
        {onCreateEvent && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                onClick={onCreateEvent}
                className="cursor-pointer gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90"
              >
                <IconPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">New Event</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Schedule a new event</TooltipContent>
          </Tooltip>
        )}

        {/* Animated view switcher */}
        <div className="relative flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
          {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewChange(value)}
                  className={cn(
                    "relative h-7 cursor-pointer gap-1 px-2.5 text-xs font-medium rounded-md z-10",
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
    </div>
  );
}
