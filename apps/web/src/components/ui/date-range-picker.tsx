"use client";

import * as React from "react";
import {
  format,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  startOfQuarter,
  endOfQuarter,
  subQuarters,
  subYears,
} from "date-fns";
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
  // The periods a contractor actually files taxes on.
  {
    label: "This quarter",
    getValue: () => ({ from: startOfQuarter(new Date()), to: new Date() }),
  },
  {
    label: "Last quarter",
    getValue: () => ({
      from: startOfQuarter(subQuarters(new Date(), 1)),
      to: endOfQuarter(subQuarters(new Date(), 1)),
    }),
  },
  {
    label: "Last 6 months",
    getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }),
  },
  {
    label: "This year",
    getValue: () => ({ from: startOfYear(new Date()), to: new Date() }),
  },
  {
    label: "Last year",
    getValue: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: new Date(new Date().getFullYear() - 1, 11, 31),
    }),
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
  /**
   * The half-finished selection, held here instead of being pushed to the page.
   *
   * `onSelect` fires on *every* click, and the first click of a range carries
   * `to: undefined`. That partial value used to go straight out to the page,
   * where /dashboard read the missing `to` as "no range" and fell back to
   * month-to-date, and /reports discarded the selection and re-rendered the
   * server's range. Either way, picking a start date silently threw the range
   * away and refetched — on the 1st of a month, month-to-date is a single day,
   * so the control appeared to jam on "Aug 1 – Aug 1".
   *
   * Nothing leaves this component until both ends exist.
   */
  const [draft, setDraft] = React.useState<DateRange | undefined>(dateRange);

  // Reopening always starts from what is actually applied, so an abandoned
  // selection cannot linger into the next visit.
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(dateRange);
    setOpen(next);
  };

  const allPresets = React.useMemo(() => {
    if (!extraPresets?.length) return PRESETS as unknown as DatePreset[];
    return [...(PRESETS as unknown as DatePreset[]), ...extraPresets];
  }, [extraPresets]);

  const handlePreset = (preset: DatePreset) => {
    const range = preset.getValue();
    setDraft(range);
    onDateRangeChange(range);
    setOpen(false);
  };

  const handleSelect = (range: DateRange | undefined) => {
    setDraft(range);
    // A complete range is the commit. Clicking a single day twice is a valid
    // one-day range and commits the same way.
    if (range?.from && range?.to) {
      onDateRangeChange(range);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
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
              /**
               * A click starts a NEW range instead of stretching the applied
               * one. Without this, react-day-picker folds every click into the
               * range already selected — and because the dashboard always has a
               * complete range selected, clicking either end point returned
               * `{from: day, to: day}`. That is the "Aug 1, 2026 – Aug 1, 2026"
               * the picker kept collapsing to: not a stuck control, a one-day
               * range the user never asked for and could not get out of,
               * because the next click collapsed it again.
               */
              resetOnSelect
              // Open on the month the range *ends* in, not the one it starts
              // in: a Jan–Aug range used to open on January and February, two
              // panels away from anything the user was about to adjust.
              defaultMonth={
                dateRange?.to ? subMonths(dateRange.to, 1) : subMonths(new Date(), 1)
              }
              selected={draft}
              onSelect={handleSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
