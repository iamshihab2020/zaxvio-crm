"use client";

import type { BookingStatus } from "@hvac-saas/types";
import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS, BOOKING_STATUS_COLORS } from "@/lib/constants/booking-options";
import { cn } from "@/lib/utils";

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

export function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const colors = BOOKING_STATUS_COLORS[status];
  const label = BOOKING_STATUS_LABELS[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text,
        colors.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", colors.dot)} />
      {label}
    </Badge>
  );
}
