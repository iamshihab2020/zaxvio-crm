"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { IconArrowLeft, IconClock } from "@tabler/icons-react";

interface TimeSlot {
  time: string;
  available: boolean;
}

interface BookingStepTimeProps {
  date: string;
  slots: TimeSlot[] | null;
  selectedTime: string | null;
  onSelect: (time: string) => void;
  onBack: () => void;
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function formatDateHeading(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function BookingStepTime({
  date,
  slots,
  selectedTime,
  onSelect,
  onBack,
}: BookingStepTimeProps) {
  const loading = slots === null;
  const availableSlots = slots?.filter((s) => s.available) ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <IconClock className="h-5 w-5 text-brand" />
        </div>
        <div>
          <h2 className="text-lg font-semibold font-heading text-foreground">
            Choose a time
          </h2>
          <p className="text-sm text-muted-foreground font-body">
            {formatDateHeading(date)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : availableSlots.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 py-10 text-center">
          <p className="text-sm text-muted-foreground font-body">
            No available time slots for this date.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Please go back and choose another date.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots!.map((slot) => (
            <Button
              key={slot.time}
              type="button"
              variant="outline"
              disabled={!slot.available}
              onClick={() => slot.available && onSelect(slot.time)}
              className={cn(
                "rounded-lg py-3 text-sm font-medium h-auto",
                slot.available && selectedTime !== slot.time &&
                  "border-border bg-card hover:border-brand/40 hover:bg-brand/5",
                selectedTime === slot.time &&
                  "border-brand bg-brand text-white shadow-sm hover:bg-brand/90",
                !slot.available &&
                  "border-transparent bg-muted/30 text-muted-foreground/30",
              )}
            >
              {formatTime(slot.time)}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="cursor-pointer">
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        {availableSlots.length > 0 && (
          <p className="text-xs text-muted-foreground font-body">
            {availableSlots.length} slot{availableSlots.length !== 1 ? "s" : ""} available
          </p>
        )}
      </div>
    </div>
  );
}
