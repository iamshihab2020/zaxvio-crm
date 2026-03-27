"use client";

import { IconCircleCheck, IconCalendar, IconClock, IconTool } from "@tabler/icons-react";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import type { ServiceType } from "@hvac-saas/types";

interface BookingStepConfirmationProps {
  bookingDate: string;
  preferredTime: string;
  serviceType: ServiceType;
  businessName: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function BookingStepConfirmation({
  bookingDate,
  preferredTime,
  serviceType,
  businessName,
}: BookingStepConfirmationProps) {
  return (
    <div className="text-center py-2">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/40">
        <IconCircleCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
      </div>

      <h2 className="mb-1 text-xl font-bold font-heading text-foreground">
        Booking Received!
      </h2>
      <p className="mb-6 text-sm text-muted-foreground font-body">
        Someone from our team will contact you shortly to confirm your appointment.
      </p>

      <div className="mx-auto max-w-sm space-y-0 rounded-lg border border-border overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <IconTool className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground font-body">Service</p>
            <p className="text-sm font-medium font-body">{SERVICE_TYPE_LABELS[serviceType] ?? serviceType}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <IconCalendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground font-body">Date</p>
            <p className="text-sm font-medium font-body">{formatDate(bookingDate)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <IconClock className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-left">
            <p className="text-xs text-muted-foreground font-body">Time</p>
            <p className="text-sm font-medium font-body">{formatTime(preferredTime)}</p>
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-muted-foreground font-body">
        Thank you for choosing <span className="font-semibold">{businessName}</span>
      </p>
    </div>
  );
}
