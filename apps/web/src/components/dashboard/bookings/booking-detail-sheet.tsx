"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { BookingStatusBadge } from "./booking-status-badge";
import { BookingActivityTimeline } from "./booking-activity-timeline";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import { useBooking, useUpdateBooking } from "@/hooks/queries";
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
  IconAlertTriangle,
  IconExternalLink,
} from "@tabler/icons-react";

interface BookingDetailSheetProps {
  bookingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (id: string) => void;
  onConvert: (id: string) => void;
  onCancel: (id: string) => void;
}

/** Booking as returned by `GET /bookings/:id`, including the linked job. */
interface BookingDetail {
  id: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  serviceType: string;
  bookingDate: string;
  preferredTime: string | null;
  address: string | null;
  description: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  notes: string | null;
  convertedToJobId: string | null;
  convertedJobNumber: string | null;
  convertedJobStatus: string | null;
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
  // Was raw useState + useEffect — the last detail view in the app that never got
  // migrated. `res.error` was never read, so a failed fetch looked identical to
  // "not found"; `handleSaveNotes` ignored its result entirely, so a failed save
  // just stopped the spinner and the user believed it saved (BOOK-07).
  const query = useBooking(open ? bookingId : null);
  const updateMutation = useUpdateBooking();

  const booking = (query.data?.data ?? null) as BookingDetail | null;
  const loadError = query.data?.error ?? (query.isError ? "Failed to load booking" : null);

  const [notes, setNotes] = useState("");

  // Reset the draft whenever a different booking loads, or the server value
  // changes underneath (e.g. after a successful save).
  useEffect(() => {
    setNotes(booking?.notes ?? "");
  }, [booking?.id, booking?.notes]);

  const handleSaveNotes = () => {
    if (!bookingId) return;
    updateMutation.mutate({ id: bookingId, data: { notes } });
  };

  const savingNotes = updateMutation.isPending;
  const notesDirty = notes !== (booking?.notes ?? "");

  const isPending = booking?.status === "pending";
  const isActive =
    booking?.status === "pending" || booking?.status === "confirmed";
  // Gate on the linked job, not on status. `convertedToJobId` was permanently
  // NULL and this endpoint didn't join jobs, so the sheet offered "Convert to
  // Job" on a booking that already had one (BOOK-06).
  const alreadyConverted = !!booking?.convertedToJobId;

  return (
    <EntityDetailShell
      entityType="bookings"
      entityRoute="/bookings"
      entityLabel="Booking"
      entityId={bookingId}
      open={open}
      onOpenChange={onOpenChange}
      loading={query.isLoading}
      hasData={!!booking}
      renderTitle={() => (
        <>
          <span className="font-heading text-xl tracking-tight">
            Booking Details
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <BookingStatusBadge status={booking?.status ?? "pending"} />
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
                {!alreadyConverted && (
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
                )}
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
      {/* Failed is not empty — say which one it was. */}
      {!query.isLoading && !booking && loadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
        >
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium font-body text-destructive">
              Couldn&apos;t load this booking
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground font-body">{loadError}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3 h-7 text-xs"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              {query.isFetching ? "Retrying…" : "Try again"}
            </Button>
          </div>
        </div>
      )}

      {booking && (
        <div className="space-y-6">
          {/* Converted → job link */}
          {alreadyConverted && (
            <Link
              href={`/jobs/${booking.convertedToJobId}`}
              className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <IconBriefcase className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-medium font-body text-foreground">
                    Converted to job{" "}
                    {booking.convertedJobNumber ?? ""}
                  </p>
                  {booking.convertedJobStatus && (
                    <p className="text-xs text-muted-foreground font-body">
                      Currently {booking.convertedJobStatus}
                    </p>
                  )}
                </div>
              </div>
              <IconExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          )}

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
                  disabled={savingNotes || !notesDirty}
                  className={cn(
                    "h-7 px-3 text-xs cursor-pointer",
                    notesDirty ? "bg-brand text-brand-foreground hover:bg-brand/90" : "",
                  )}
                  variant={notesDirty ? "default" : "ghost"}
                >
                  <IconDeviceFloppy className="mr-1.5 h-3 w-3" />
                  {savingNotes ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          </div>

          {/* Activity timeline */}
          <BookingActivityTimeline bookingId={booking.id} />
        </div>
      )}
    </EntityDetailShell>
  );
}
