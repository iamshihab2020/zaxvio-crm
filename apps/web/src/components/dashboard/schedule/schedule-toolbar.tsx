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
import { DUR, EASE_OUT } from "@/lib/motion";
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
  /**
   * The filters as one button (`ScheduleFilterMenu`), shown beside the view
   * switcher while the card is too narrow for the filter row under the toolbar.
   */
  filterMenu?: React.ReactNode;
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
 * The same label for a narrow card, where the full form ("Wednesday, September
 * 30, 2026") is wider than the room it gets. The year goes from week and day,
 * which always sit near today; the month view keeps it.
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
  filterMenu,
}: ScheduleToolbarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const viewingToday = dateIsToday(currentDate) || (currentView === "week" && dateIsToday(startOfWeek(currentDate, { weekStartsOn: 0 })));
  const dateLabel = formatDateLabel(currentDate, currentView);
  const shortDateLabel = formatShortDateLabel(currentDate, currentView);

  return (
    // Laid out by the calendar card's width, not the screen's: the card is a
    // container (see the page), and the sidebar rail and the task column change
    // its width as much as the screen does. A media query once put this on one
    // 650px row inside a 470px card on a 1024px tablet, with the view switcher
    // cut off.
    //
    // Under 42rem the controls take a 2×2 grid: navigation and New Event on
    // top; under them the date, then how you are looking at it (the filters
    // button and the view switcher). The grid placement classes are inert once
    // the toolbar is a flex row from 42rem. Labels join the icons from 30rem,
    // and the date spells itself out from 52rem. Each element uses one width
    // threshold per property, because Tailwind does not promise the order of
    // two arbitrary `@container` variants. Heights stay on the screen (`sm:`):
    // they are about fingers, not room.
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-1 border-b border-border/60 px-3 py-1.5 sm:px-4 [@container(min-width:42rem)]:flex [@container(min-width:42rem)]:py-3.5">
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
              <IconCalendarEvent className="hidden h-3.5 w-3.5 [@container(min-width:30rem)]:block" />
              Today
              {/* "You are not looking at today". A dot that appears when you
                  navigate away, not one that pulses for as long as you stay. */}
              {!viewingToday && (
                <span className="motion-pop absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-brand" />
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
            <span key={dateLabel} className="motion-appear min-w-0 truncate">
              <span className="[@container(min-width:52rem)]:hidden">{shortDateLabel}</span>
              <span className="hidden [@container(min-width:52rem)]:inline">{dateLabel}</span>
            </span>
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
              // `ml-auto` pushes it right in the flex row; in the grid it only
              // right-aligns it in its column.
              className="col-start-2 row-start-1 ml-auto h-10 min-w-[2.5rem] cursor-pointer gap-1.5 bg-brand px-0 text-brand-foreground hover:bg-brand/90 sm:h-8 sm:min-w-[2rem] [@container(min-width:30rem)]:px-3"
            >
              <IconPlus className="h-3.5 w-3.5" />
              <span className="hidden [@container(min-width:30rem)]:inline">New Event</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Schedule a new event</TooltipContent>
        </Tooltip>
      )}

      <div className="col-start-2 row-start-2 flex items-center justify-end gap-1.5 [@container(min-width:42rem)]:ml-0.5">
        {filterMenu && (
          <div className="[@container(min-width:42rem)]:hidden">{filterMenu}</div>
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
                  aria-label={`${label} view`}
                  aria-pressed={currentView === value}
                  className={cn(
                    "relative z-10 h-10 min-w-[2.5rem] cursor-pointer gap-1 rounded-md px-0 text-xs font-medium sm:h-7 sm:min-w-[1.75rem] [@container(min-width:30rem)]:px-2.5",
                    currentView === value
                      ? "text-brand-foreground hover:text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {currentView === value && (
                    <motion.div
                      layoutId="schedule-view-indicator"
                      className="absolute inset-0 rounded-md bg-brand shadow-sm"
                      transition={{ duration: DUR.state / 1000, ease: EASE_OUT }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden [@container(min-width:30rem)]:inline">{label}</span>
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
