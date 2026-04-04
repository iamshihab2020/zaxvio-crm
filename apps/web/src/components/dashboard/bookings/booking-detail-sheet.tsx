"use client";

import { useState, useEffect } from "react";
import type { Booking } from "@hvac-saas/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BookingStatusBadge } from "./booking-status-badge";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import { getBooking, updateBooking } from "@/actions/bookings";
import {
  EntityDetailShell,
  DetailRow,
} from "@/components/dashboard/reusable/entity-detail-shell";
import {
  IconCalendar,
  IconClock,
  IconMapPin,
  IconPhone,
  IconMail,
  IconUser,
  IconTool,
  IconDeviceFloppy,
  IconCheck,
  IconBriefcase,
  IconX,
} from "@tabler/icons-react";

interface BookingDetailSheetProps {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
  onConvert: (id: string) => void;
  onCancel: (id: string) => void;
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
  if (!timeStr) return "Not specified";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export function BookingDetailSheet({
  bookingId,
  open,
  onOpenChange,
  onConfirm,
  onConvert,
  onCancel,
}: BookingDetailSheetProps) {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    if (!bookingId || !open) {
      setBooking(null);
      return;
    }
    setLoading(true);
    getBooking(bookingId).then((res) => {
      if (res.data) {
        setBooking(res.data);
        setNotes(res.data.notes ?? "");
      }
      setLoading(false);
    });
  }, [bookingId, open]);

  const handleSaveNotes = async () => {
    if (!bookingId) return;
    setSavingNotes(true);
    await updateBooking(bookingId, { notes });
    setSavingNotes(false);
  };

  const isPending = booking?.status === "pending";
  const isActive =
    booking?.status === "pending" || booking?.status === "confirmed";

  return (
    <EntityDetailShell
      entityType="bookings"
      entityRoute="/bookings"
      entityLabel="Booking"
      entityId={bookingId}
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      hasData={!!booking}
      renderTitle={() => (
        <>
          <span className="font-heading text-xl tracking-tight">
            Booking Details
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <BookingStatusBadge
              status={booking?.status as "pending" | "confirmed" | "cancelled" | "completed"}
            />
          </div>
        </>
      )}
      renderDescription={() => (
        <span>
          {booking ? formatDate(booking.bookingDate) : ""} at{" "}
          {booking ? formatTime(booking.preferredTime) : ""}
        </span>
      )}
      renderActions={
        isActive
          ? () => (
              <>
                {isPending && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (booking) { onConfirm(booking.id); onOpenChange(false); }
                    }}
                    className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
                  >
                    <IconCheck className="mr-1.5 h-3.5 w-3.5" />
                    Confirm
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => {
                    if (booking) { onConvert(booking.id); onOpenChange(false); }
                  }}
                >
                  <IconBriefcase className="mr-1.5 h-3.5 w-3.5" />
                  Convert to Job
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="cursor-pointer text-destructive hover:text-destructive"
                  onClick={() => {
                    if (booking) { onCancel(booking.id); onOpenChange(false); }
                  }}
                >
                  <IconX className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            )
          : undefined
      }
    >
      {/* ── Content (no tabs) — guard against null booking ── */}
      {booking && (
        <div className="space-y-6">
          {/* Customer Section */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Customer
            </h3>
            <div className="space-y-3">
              <DetailRow icon={IconUser} label="Name">
                {booking.customerName}
              </DetailRow>
              {booking.customerPhone && (
                <DetailRow icon={IconPhone} label="Phone">
                  <a
                    href={`tel:${booking.customerPhone}`}
                    className="text-brand hover:underline"
                  >
                    {booking.customerPhone}
                  </a>
                </DetailRow>
              )}
              {booking.customerEmail && (
                <DetailRow icon={IconMail} label="Email">
                  <a
                    href={`mailto:${booking.customerEmail}`}
                    className="text-brand hover:underline"
                  >
                    {booking.customerEmail}
                  </a>
                </DetailRow>
              )}
            </div>
          </div>

          {/* Service Details Section */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Service Details
            </h3>
            <div className="space-y-3">
              <DetailRow icon={IconTool} label="Service Type">
                {SERVICE_TYPE_LABELS[
                  booking.serviceType as keyof typeof SERVICE_TYPE_LABELS
                ] ?? booking.serviceType}
              </DetailRow>
              <DetailRow icon={IconCalendar} label="Date">
                {formatDate(booking.bookingDate)}
              </DetailRow>
              <DetailRow icon={IconClock} label="Time">
                {formatTime(booking.preferredTime)}
              </DetailRow>
              {booking.address && (
                <DetailRow icon={IconMapPin} label="Address">
                  {booking.address}
                </DetailRow>
              )}
            </div>
            {booking.description && (
              <div className="mt-4 rounded-md bg-muted/50 p-3 text-sm font-body text-foreground">
                {booking.description}
              </div>
            )}
          </div>

          {/* Internal Notes */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
              Internal Notes
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add internal notes about this booking..."
                rows={3}
                className="text-sm border-0 rounded-none focus-visible:ring-0 resize-none"
              />
              <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground/60 font-body">
                  Only visible to your team
                </p>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={savingNotes || notes === (booking.notes ?? "")}
                  className={cn(
                    "h-7 px-3 text-xs cursor-pointer",
                    notes !== (booking.notes ?? "")
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : "",
                  )}
                  variant={
                    notes === (booking.notes ?? "") ? "ghost" : "default"
                  }
                >
                  <IconDeviceFloppy className="mr-1.5 h-3 w-3" />
                  {savingNotes ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </EntityDetailShell>
  );
}
