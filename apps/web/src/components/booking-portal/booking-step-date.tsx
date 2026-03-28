"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconArrowLeft, IconCalendar } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface BookingStepDateProps {
  availableDates: Set<string>;
  loading: boolean;
  selectedDate: string | null;
  onSelect: (date: string) => void;
  onBack: () => void;
  onMonthChange: (monthStr: string) => void;
}

export function BookingStepDate({
  availableDates,
  loading,
  selectedDate,
  onSelect,
  onBack,
  onMonthChange,
}: BookingStepDateProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthAnimating, setMonthAnimating] = useState(false);

  const handleMonthChange = (month: Date) => {
    setMonthAnimating(true);
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    onMonthChange(monthStr);
    setTimeout(() => {
      setCurrentMonth(month);
      setTimeout(() => setMonthAnimating(false), 30);
    }, 120);
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = date.toLocaleDateString("en-CA");
    if (availableDates.has(dateStr)) {
      onSelect(dateStr);
    }
  };

  const selectedAsDate = selectedDate ? new Date(selectedDate + "T12:00:00Z") : undefined;

  const isDateDisabled = (date: Date) => {
    const dateStr = date.toLocaleDateString("en-CA");
    return !availableDates.has(dateStr);
  };

  // Count available dates for the current displayed month
  const monthStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  let availableThisMonth = 0;
  for (const d of availableDates) {
    if (d.startsWith(monthStr)) availableThisMonth++;
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <IconCalendar className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-heading text-foreground">
            Pick a date
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            {loading
              ? "Loading availability..."
              : `${availableThisMonth} date${availableThisMonth !== 1 ? "s" : ""} available this month`}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : (
        <div
          className={cn(
            "transition-all duration-150",
            monthAnimating ? "opacity-0 scale-[0.97]" : "opacity-100 scale-100",
          )}
        >
          <Calendar
            mode="single"
            selected={selectedAsDate}
            onSelect={handleSelect}
            month={currentMonth}
            onMonthChange={handleMonthChange}
            disabled={isDateDisabled}
            fromDate={new Date()}
            className="w-full rounded-lg border border-border p-3 [&_table]:w-full [&_td]:p-0 [&_th]:p-0 [&_button]:w-full [&_button]:h-10"
            classNames={{
              months: "w-full",
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "flex-1 text-center text-xs font-medium text-muted-foreground py-2",
              row: "flex w-full",
              cell: "flex-1 text-center relative",
              day: "h-10 w-full rounded-md text-sm font-medium transition-colors hover:bg-brand/10 cursor-pointer",
              day_selected: "bg-brand text-white hover:bg-brand/90",
              day_disabled: "text-muted-foreground/30 cursor-not-allowed hover:bg-transparent",
              day_today: "ring-1 ring-brand/40 font-bold",
              nav: "flex items-center justify-between mb-2",
              nav_button: "h-8 w-8 rounded-md border border-border hover:bg-muted transition-colors inline-flex items-center justify-center cursor-pointer",
              caption: "font-heading font-semibold text-sm",
            }}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="cursor-pointer">
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <p className="text-xs text-muted-foreground font-body">
          Tap a highlighted date to continue
        </p>
      </div>
    </div>
  );
}
