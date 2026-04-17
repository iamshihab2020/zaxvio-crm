"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  IconUser,
  IconMapPin,
  IconClock,
  IconCalendarEvent,
  IconBriefcase,
  IconBookmark,
  IconArrowRight,
} from "@tabler/icons-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

export type AgendaKind = "event" | "job" | "booking";

export interface AgendaDetails {
  kind: AgendaKind;
  title: string;
  subtitle?: string | null;
  customerName?: string | null;
  address?: string | null;
  description?: string | null;
  serviceType?: string | null;
  priority?: string | null;
  start: Date | null;
  end?: Date | null;
  href: string;
  color: string;
}

const KIND_META: Record<AgendaKind, { label: string; icon: typeof IconUser; style: string }> = {
  event: {
    label: "Event",
    icon: IconCalendarEvent,
    style: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  },
  job: {
    label: "Job",
    icon: IconBriefcase,
    style: "bg-brand/10 text-brand border-brand/20",
  },
  booking: {
    label: "Booking",
    icon: IconBookmark,
    style: "bg-teal-500/10 text-teal-500 border-teal-500/20",
  },
};

interface AgendaHoverCardProps {
  details: AgendaDetails;
  children: React.ReactNode;
  openDelay?: number;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function AgendaHoverCard({
  details,
  children,
  openDelay = 200,
  side = "right",
  align = "start",
}: AgendaHoverCardProps) {
  const meta = KIND_META[details.kind];
  const Icon = meta.icon;

  return (
    <HoverCard openDelay={openDelay} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className="w-80 p-0 overflow-hidden"
      >
        {/* Colored header */}
        <div
          className="flex items-start gap-3 border-b border-border/60 p-4"
          style={{ backgroundColor: `${details.color}10` }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${details.color}22`, color: details.color }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold font-body uppercase tracking-wide",
                meta.style,
              )}
            >
              {meta.label}
            </span>
            <div className="mt-1 truncate font-heading text-sm font-semibold text-foreground">
              {details.title}
            </div>
            {details.subtitle && (
              <div className="truncate text-[11px] font-body text-muted-foreground">
                {details.subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-2 p-4">
          {details.customerName && (
            <Row icon={IconUser} label="Customer" value={details.customerName} />
          )}
          {details.address && (
            <Row icon={IconMapPin} label="Address" value={details.address} />
          )}
          {details.start && (
            <Row
              icon={IconClock}
              label="When"
              value={
                details.end
                  ? `${format(details.start, "EEE, MMM d · h:mm a")} – ${format(details.end, "h:mm a")}`
                  : format(details.start, "EEE, MMM d · h:mm a")
              }
            />
          )}
          {details.serviceType && (
            <Row
              icon={IconBriefcase}
              label="Service"
              value={titleCase(details.serviceType)}
            />
          )}
          {details.description && (
            <p className="rounded-lg bg-muted/40 p-2 text-[11px] font-body text-muted-foreground">
              {details.description}
            </p>
          )}
          {details.priority && details.kind === "job" && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-body capitalize",
                priorityClass(details.priority),
              )}
            >
              {details.priority}
            </span>
          )}
        </div>

        {/* Footer */}
        <Link
          href={details.href}
          className="flex items-center justify-between border-t border-border/60 bg-muted/20 px-4 py-2.5 text-xs font-body font-medium text-foreground hover:bg-muted/40 cursor-pointer"
        >
          <span>Open {meta.label.toLowerCase()}</span>
          <IconArrowRight className="h-3.5 w-3.5" />
        </Link>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof IconUser;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-body uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-xs font-body text-foreground">{value}</div>
      </div>
    </div>
  );
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function priorityClass(p: string): string {
  switch (p.toLowerCase()) {
    case "urgent":
    case "emergency":
      return "bg-rose-500/10 text-rose-500";
    case "high":
      return "bg-amber-500/10 text-amber-600";
    case "low":
      return "bg-slate-500/10 text-slate-500";
    default:
      return "bg-brand/10 text-brand";
  }
}
