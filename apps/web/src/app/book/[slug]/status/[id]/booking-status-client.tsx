"use client";

import { useState, useEffect } from "react";
import { getPublicBookingStatus } from "@/actions/bookings";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import { cn } from "@/lib/utils";
import {
  IconCircleCheck,
  IconClock,
  IconCalendar,
  IconTool,
  IconMapPin,
  IconX,
  IconLoader2,
} from "@tabler/icons-react";
import { LicenseBadge } from "@/components/public/license-badge";
import type { ServiceType } from "@hvac-saas/types";

interface BookingStatusClientProps {
  slug: string;
  bookingId: string;
  initialData: {
    booking: {
      id: string;
      customerName: string;
      serviceType: string;
      bookingDate: string;
      preferredTime: string | null;
      address: string | null;
      status: string;
      createdAt: string;
    };
    businessName: string;
    logoUrl: string | null;
    licenseNumber?: string | null;
    timezone: string | null;
  };
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

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "TBD";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

const STATUS_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
  description: string;
  color: string;
  bg: string;
  iconColor: string;
}> = {
  pending: {
    icon: IconClock,
    label: "Pending Confirmation",
    description: "Your booking has been received. Someone from our team will contact you shortly to confirm.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  confirmed: {
    icon: IconCircleCheck,
    label: "Confirmed",
    description: "Your appointment has been confirmed! We look forward to seeing you.",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-100 dark:bg-green-950/40",
    iconColor: "text-green-600 dark:text-green-400",
  },
  completed: {
    icon: IconCircleCheck,
    label: "Completed",
    description: "This appointment has been completed. Thank you for choosing us!",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-100 dark:bg-blue-950/40",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  cancelled: {
    icon: IconX,
    label: "Cancelled",
    description: "This booking has been cancelled. Please book a new appointment if needed.",
    color: "text-muted-foreground",
    bg: "bg-muted/50",
    iconColor: "text-muted-foreground",
  },
};

export function BookingStatusClient({
  slug,
  bookingId,
  initialData,
}: BookingStatusClientProps) {
  const [data, setData] = useState(initialData);

  // Poll for status updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const result = await getPublicBookingStatus(slug, bookingId);
      if (result.data) {
        setData(result.data);
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [slug, bookingId]);

  const { booking, businessName, logoUrl, licenseNumber } = data;
  const statusConfig = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-midnight dark:bg-card border-b border-border">
        <div className="mx-auto max-w-xl px-4 py-8 text-center">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={businessName}
              className="mx-auto mb-4 h-14 w-auto object-contain"
            />
          )}
          <h1 className="text-2xl font-bold font-heading text-white dark:text-foreground">
            {businessName}
          </h1>
          <div className="mt-3">
            <LicenseBadge licenseNumber={licenseNumber} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-6">
        {/* Status Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {/* Status Badge */}
          <div className="mb-6 text-center">
            <div className={cn("mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full", statusConfig.bg)}>
              <StatusIcon className={cn("h-8 w-8", statusConfig.iconColor)} />
            </div>
            <h2 className={cn("text-xl font-bold font-heading", statusConfig.color)}>
              {statusConfig.label}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground font-body max-w-sm mx-auto">
              {statusConfig.description}
            </p>
          </div>

          {/* Booking Details */}
          <div className="space-y-0 rounded-lg border border-border overflow-hidden">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <IconTool className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-body">Service</p>
                <p className="text-sm font-medium font-body">
                  {SERVICE_TYPE_LABELS[booking.serviceType as ServiceType] ?? booking.serviceType}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <IconCalendar className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-body">Date</p>
                <p className="text-sm font-medium font-body">{formatDate(booking.bookingDate)}</p>
              </div>
            </div>
            <div className={cn("flex items-center gap-3 px-4 py-3", booking.address && "border-b border-border")}>
              <IconClock className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground font-body">Time</p>
                <p className="text-sm font-medium font-body">{formatTime(booking.preferredTime)}</p>
              </div>
            </div>
            {booking.address && (
              <div className="flex items-center gap-3 px-4 py-3">
                <IconMapPin className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-body">Address</p>
                  <p className="text-sm font-medium font-body">{booking.address}</p>
                </div>
              </div>
            )}
          </div>

          {/* Auto-refresh notice */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/60 font-body">
            <IconLoader2 className="h-3 w-3 animate-spin" />
            <span>This page updates automatically</span>
          </div>
        </div>

        {/* Booking Reference */}
        <p className="mt-4 text-center text-xs text-muted-foreground/60 font-body">
          Booking reference: {bookingId.slice(0, 8).toUpperCase()}
        </p>
      </main>

      <footer className="pb-8 text-center">
        <p className="text-xs text-muted-foreground/60">
          Powered by <span className="font-semibold">Zaxvio</span>
        </p>
      </footer>
    </div>
  );
}
