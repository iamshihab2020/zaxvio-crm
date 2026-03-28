import type { BookingStatus, ServiceType } from "@hvac-saas/types";

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const BOOKING_STATUS_COLORS: Record<
  BookingStatus,
  { dot: string; bg: string; text: string; border: string }
> = {
  pending: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  confirmed: {
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
  completed: {
    dot: "bg-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-200 dark:border-green-800",
  },
  cancelled: {
    dot: "bg-muted-foreground/50",
    bg: "bg-muted/50",
    text: "text-muted-foreground",
    border: "border-border",
  },
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  installation: "Installation",
  repair: "Repair",
  maintenance: "Maintenance",
  inspection: "Inspection",
  emergency: "Emergency",
  consultation: "Consultation",
  other: "Other",
};

/** Day names indexed by dayOfWeek (0=Sunday) */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/** Short day names */
export const DAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
