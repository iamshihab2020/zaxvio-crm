"use client";

import Link from "next/link";
import type { Booking } from "@hvac-saas/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookingStatusBadge } from "./booking-status-badge";
import { SERVICE_TYPE_LABELS } from "@/lib/constants/booking-options";
import {
  IconDots,
  IconEye,
  IconCheck,
  IconBriefcase,
  IconX,
  IconExternalLink,
  IconLink,
  IconCode,
  IconBracketsContain,
  IconPencil,
} from "@tabler/icons-react";

interface BookingWithJob extends Booking {
  convertedToJobId?: string | null;
  convertedJobNumber?: string | null;
  convertedJobStatus?: string | null;
}

const SOURCE_CONFIG: Record<string, { label: string; Icon: typeof IconLink; className: string }> = {
  portal:  { label: "Link",   Icon: IconLink,   className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  embed:   { label: "Embed",  Icon: IconCode,   className: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400" },
  widget:  { label: "Widget", Icon: IconBracketsContain, className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400" },
  manual:  { label: "Manual", Icon: IconPencil, className: "bg-muted text-muted-foreground" },
};

interface BookingTableProps {
  bookings: BookingWithJob[];
  onViewDetail: (id: string) => void;
  onConfirm: (id: string) => void;
  onConvert: (id: string) => void;
  onCancel: (id: string) => void;
  // Selection props (optional — omit to disable selection)
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: (items: { id: string }[]) => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "—";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

export function BookingTable({
  bookings,
  onViewDetail,
  onConfirm,
  onConvert,
  onCancel,
  selectedIds,
  onToggle,
  onToggleAll,
  isAllSelected,
  isIndeterminate,
}: BookingTableProps) {
  const selectionEnabled = !!selectedIds && !!onToggle;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectionEnabled && (
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                onCheckedChange={() => onToggleAll?.(bookings)}
                aria-label="Select all"
              />
            </TableHead>
          )}
          <TableHead>Customer</TableHead>
          <TableHead className="w-[140px]">Phone</TableHead>
          <TableHead className="w-[120px]">Service</TableHead>
          <TableHead className="w-[120px]">Date</TableHead>
          <TableHead className="w-[90px]">Time</TableHead>
          <TableHead className="w-[110px]">Status</TableHead>
          <TableHead className="w-[90px]">Source</TableHead>
          <TableHead className="w-[130px]">Job</TableHead>
          <TableHead className="w-[48px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow
            key={booking.id}
            className="cursor-pointer"
            onClick={() => onViewDetail(booking.id)}
            data-selected={selectionEnabled && selectedIds?.has(booking.id)}
          >
            {selectionEnabled && (
              <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds?.has(booking.id) ?? false}
                  onCheckedChange={() => onToggle(booking.id)}
                  aria-label={`Select booking for ${booking.customerName}`}
                />
              </TableCell>
            )}
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-brand/10 text-brand text-xs font-medium">
                    {getInitials(booking.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{booking.customerName}</p>
                  {booking.customerEmail && (
                    <p className="text-xs text-muted-foreground">{booking.customerEmail}</p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {booking.customerPhone || "—"}
            </TableCell>
            <TableCell className="text-sm">
              {SERVICE_TYPE_LABELS[booking.serviceType as keyof typeof SERVICE_TYPE_LABELS] ?? booking.serviceType}
            </TableCell>
            <TableCell className="text-sm">{formatDate(booking.bookingDate)}</TableCell>
            <TableCell className="text-sm">{formatTime(booking.preferredTime)}</TableCell>
            <TableCell>
              <BookingStatusBadge status={booking.status as any} />
            </TableCell>
            <TableCell>
              {(() => {
                const cfg = SOURCE_CONFIG[(booking.source ?? "portal") as string] ?? SOURCE_CONFIG.portal;
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
                    <cfg.Icon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                );
              })()}
            </TableCell>
            <TableCell>
              {booking.convertedToJobId ? (
                <Link
                  href={`/jobs/${booking.convertedToJobId}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="group cursor-pointer">
                    <p className="text-xs font-medium text-brand group-hover:underline">
                      {booking.convertedJobNumber}
                    </p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {booking.convertedJobStatus}
                    </p>
                  </div>
                </Link>
              ) : (
                <span className="text-xs text-muted-foreground/40">—</span>
              )}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onViewDetail(booking.id)}>
                    <IconEye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  {booking.status === "pending" && (
                    <DropdownMenuItem onClick={() => onConfirm(booking.id)}>
                      <IconCheck className="mr-2 h-4 w-4" />
                      Confirm Booking
                    </DropdownMenuItem>
                  )}
                  {(booking.status === "pending" || booking.status === "confirmed") && !booking.convertedToJobId && (
                    <DropdownMenuItem onClick={() => onConvert(booking.id)}>
                      <IconBriefcase className="mr-2 h-4 w-4" />
                      Convert to Job
                    </DropdownMenuItem>
                  )}
                  {booking.convertedToJobId && (
                    <DropdownMenuItem asChild>
                      <Link href={`/jobs/${booking.convertedToJobId}`}>
                        <IconExternalLink className="mr-2 h-4 w-4" />
                        View Job
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {booking.status !== "cancelled" && booking.status !== "completed" && (
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => onCancel(booking.id)}
                    >
                      <IconX className="mr-2 h-4 w-4" />
                      Cancel Booking
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
