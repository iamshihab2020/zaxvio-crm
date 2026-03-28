"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@hvac-saas/types";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BookingStatusBadge } from "./booking-status-badge";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import { getBooking, updateBooking } from "@/actions/bookings";
import { useViewPreference } from "@/hooks/use-view-preference";
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
  IconLayoutSidebar,
  IconMaximize,
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

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

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

function DetailRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <div className="text-sm font-medium text-foreground font-body">{children}</div>
      </div>
    </div>
  );
}

export function BookingDetailSheet({
  bookingId,
  open,
  onOpenChange,
  onConfirm,
  onConvert,
  onCancel,
}: BookingDetailSheetProps) {
  const router = useRouter();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  /* ── Preferences ──────────────────────────────────────────── */
  const {
    mode: prefMode,
    sidebarWidth: prefSidebarWidth,
    mounted,
    setMode: setPrefMode,
    setSidebarWidth: setPrefSidebarWidth,
  } = useViewPreference("bookings");
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(DEFAULT_WIDTH);
  const switchingModeRef = useRef(false);

  useEffect(() => {
    setLiveSidebarWidth(prefSidebarWidth);
  }, [prefSidebarWidth]);

  /* ── Booking data fetching ────────────────────────────────── */
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

  /* ── Mode toggle ──────────────────────────────────────────── */
  function toggleMode() {
    switchingModeRef.current = true;
    const newMode = prefMode === "sidebar" ? "dialog" : "sidebar";
    setPrefMode(newMode);
    requestAnimationFrame(() => {
      switchingModeRef.current = false;
    });
  }

  function handleOpenChange(newOpen: boolean) {
    if (switchingModeRef.current) return;
    onOpenChange(newOpen);
  }

  /* ── Drag-to-resize (sidebar only) ────────────────────────── */
  const dragWidthRef = useRef(DEFAULT_WIDTH);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragWidthRef.current = liveSidebarWidth;

      const onMove = (ev: MouseEvent) => {
        const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - ev.clientX));
        dragWidthRef.current = w;
        setLiveSidebarWidth(w);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setPrefSidebarWidth(dragWidthRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [liveSidebarWidth, setPrefSidebarWidth],
  );

  const handleSaveNotes = async () => {
    if (!bookingId) return;
    setSavingNotes(true);
    await updateBooking(bookingId, { notes });
    setSavingNotes(false);
  };

  const mode = mounted ? (prefMode === "page" ? "sidebar" : prefMode) : "sidebar";
  const isPending = booking?.status === "pending";
  const isActive = booking?.status === "pending" || booking?.status === "confirmed";

  /* ── Shared inner content ─────────────────────────────────── */
  const innerContent = (
    <>
      {loading && (
        <>
          <SheetTitle className="sr-only">Booking details</SheetTitle>
          <SheetDescription className="sr-only">Loading booking information</SheetDescription>
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </>
      )}

      {!loading && booking && (
        <>
          {/* ── Header ────────────────────────────────────── */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between pr-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SheetTitle className="font-heading text-lg">
                    Booking Details
                  </SheetTitle>
                  <BookingStatusBadge status={booking.status as any} />
                </div>
                <SheetDescription className="text-sm font-body">
                  {formatDate(booking.bookingDate)} at {formatTime(booking.preferredTime)}
                </SheetDescription>
              </div>

              <div className="flex items-center gap-1">
                {/* Mode toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={toggleMode}
                  title={mode === "sidebar" ? "Switch to dialog view" : "Switch to sidebar view"}
                >
                  {mode === "sidebar" ? (
                    <IconMaximize className="h-4 w-4" />
                  ) : (
                    <IconLayoutSidebar className="h-4 w-4" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onOpenChange(false)}
                  title="Close"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Action buttons row */}
            {isActive && (
              <div className="flex gap-2 pt-3">
                {isPending && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onConfirm(booking.id);
                      onOpenChange(false);
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
                    onConvert(booking.id);
                    onOpenChange(false);
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
                    onCancel(booking.id);
                    onOpenChange(false);
                  }}
                >
                  <IconX className="mr-1.5 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* ── Content ───────────────────────────────────── */}
          <div className="px-6 py-4 space-y-6">
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
                    <a href={`tel:${booking.customerPhone}`} className="text-brand hover:underline">
                      {booking.customerPhone}
                    </a>
                  </DetailRow>
                )}
                {booking.customerEmail && (
                  <DetailRow icon={IconMail} label="Email">
                    <a href={`mailto:${booking.customerEmail}`} className="text-brand hover:underline">
                      {booking.customerEmail}
                    </a>
                  </DetailRow>
                )}
              </div>
            </div>

            {/* Booking Details Section */}
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
                Service Details
              </h3>
              <div className="space-y-3">
                <DetailRow icon={IconTool} label="Service Type">
                  {SERVICE_TYPE_LABELS[booking.serviceType as keyof typeof SERVICE_TYPE_LABELS] ?? booking.serviceType}
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
                    variant={notes === (booking.notes ?? "") ? "ghost" : "default"}
                  >
                    <IconDeviceFloppy className="mr-1.5 h-3 w-3" />
                    {savingNotes ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );

  /* ── Render: Dialog mode ──────────────────────────────────── */
  if (mode === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  /* ── Render: Sidebar mode (default) ───────────────────────── */
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{
          maxWidth: mounted ? liveSidebarWidth : DEFAULT_WIDTH,
          width: "100%",
        }}
      >
        {/* Drag handle — left edge resize */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
          onMouseDown={handleDragStart}
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-brand/40 transition-colors" />
        </div>
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
