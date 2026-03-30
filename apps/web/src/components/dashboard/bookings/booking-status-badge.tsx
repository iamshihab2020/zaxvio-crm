"use client";

import type { BookingStatus } from "@hvac-saas/types";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/constants/booking-options";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const colors = BOOKING_STATUS_COLORS[status];
  const label = BOOKING_STATUS_LABELS[status];

  return (
    <Badge
      className={cn(
        "gap-1.5 px-2 py-0.5 font-medium",
        colors.bg,
        colors.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
      {label}
    </Badge>
  );
}
