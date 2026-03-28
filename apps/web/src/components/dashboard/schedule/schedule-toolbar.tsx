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
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfWeek,
  endOfWeek,
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
}: ScheduleToolbarProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      {/* Left: Today + navigation */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onToday}
              className="cursor-pointer gap-1.5"
            >
              <IconCalendarEvent className="h-3.5 w-3.5" />
              Today
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
              className="font-heading text-base font-semibold cursor-pointer px-2"
            >
              {formatDateLabel(currentDate, currentView)}
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

      {/* Right: View switcher */}
      <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
        {VIEW_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewChange(value)}
                className={cn(
                  "h-7 cursor-pointer gap-1 px-2.5 text-xs font-medium rounded-md",
                  currentView === value
                    ? "bg-brand text-brand-foreground shadow-sm hover:bg-brand/90 hover:text-brand-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label} view</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
