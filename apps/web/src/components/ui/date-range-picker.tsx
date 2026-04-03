"use client";

import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import type { DateRange } from "react-day-picker";
import { IconCalendar, IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const PRESETS = [
  { label: "Today", getValue: () => ({ from: new Date(), to: new Date() }) },
  {
    label: "Last 7 days",
    getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }),
  },
  {
    label: "This month",
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: "Last month",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  {
    label: "Last 3 months",
    getValue: () => ({ from: subMonths(new Date(), 3), to: new Date() }),
  },
  {
    label: "Last 6 months",
    getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }),
  },
  {
    label: "This year",
    getValue: () => ({ from: startOfYear(new Date()), to: new Date() }),
  },
] as const;

export type DatePreset = {
  label: string;
  getValue: () => { from: Date; to: Date };
};

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
  extraPresets?: DatePreset[];
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  extraPresets,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);

  const allPresets = React.useMemo(() => {
    if (!extraPresets?.length) return PRESETS as unknown as DatePreset[];
    return [...(PRESETS as unknown as DatePreset[]), ...extraPresets];
  }, [extraPresets]);

  const handlePreset = (preset: DatePreset) => {
    const range = preset.getValue();
    onDateRangeChange(range);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 justify-start gap-2 text-left font-body text-xs font-normal",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <IconCalendar className="h-3.5 w-3.5 text-muted-foreground" />
          {dateRange?.from ? (
            dateRange.to ? (
              <>
                {format(dateRange.from, "MMM d, yyyy")} –{" "}
                {format(dateRange.to, "MMM d, yyyy")}
              </>
            ) : (
              format(dateRange.from, "MMM d, yyyy")
            )
          ) : (
            "Select date range"
          )}
          <IconChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="flex flex-col gap-0.5 border-r border-border p-2">
            {allPresets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                onClick={() => handlePreset(preset)}
                className="justify-start text-xs font-body whitespace-nowrap"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
