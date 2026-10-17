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
import {
  JOB_PRIORITIES,
  JOB_PRIORITY_COLORS,
  JOB_PRIORITY_LABELS,
  type JobPriority,
} from "@/lib/constants/job-options";
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

/*
 * The kind's series token is the tint and the border; the word is ink. Indigo
 * and teal text measured 4.0:1 and 2.3:1 at this size, and Tailwind's
 * indigo-500/teal-500 were not the validated series hues, so the badge here and
 * the row beside it were two different teals. Orange keeps `text-brand-ink`,
 * which is the readable orange.
 */
const KIND_META: Record<AgendaKind, { label: string; icon: typeof IconUser; style: string }> = {
  event: {
    label: "Event",
    icon: IconCalendarEvent,
    style:
      "bg-[hsl(var(--series-event)/0.1)] text-foreground border-[hsl(var(--series-event)/0.25)]",
  },
  job: {
    label: "Job",
    icon: IconBriefcase,
    style: "bg-brand/10 text-brand-ink border-brand/20",
  },
  booking: {
    label: "Booking",
    icon: IconBookmark,
    style:
      "bg-[hsl(var(--series-booking)/0.1)] text-foreground border-[hsl(var(--series-booking)/0.25)]",
  },
};

/**
 * `details.color` at a given strength, whatever form the colour is in.
 *
 * This used to append a hex alpha (`${color}10`), which only works when the
 * colour is a six-digit hex. The schedule passes hex, but the dashboard's Up
 * next passes `hsl(var(--brand))`, and `hsl(var(--brand))10` is not a colour:
 * the browser drops the declaration and the header loses its tint without a
 * word. `color-mix` takes any colour.
 */
function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

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
          style={{ backgroundColor: tint(details.color, 6) }}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: tint(details.color, 13), color: details.color }}
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
          {details.kind === "job" && isJobPriority(details.priority) && (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium font-body",
                JOB_PRIORITY_COLORS[details.priority].bg,
                JOB_PRIORITY_COLORS[details.priority].text,
              )}
            >
              {JOB_PRIORITY_LABELS[details.priority]}
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

/**
 * The pill reads the Jobs board's own map, keyed by the database enum. Its
 * predecessor switched on `high` and `low`, which the enum has never had, so
 * `urgent` and `emergency` shared one rose pill and `standard` fell through to
 * orange.
 */
function isJobPriority(p: string | null | undefined): p is JobPriority {
  return JOB_PRIORITIES.some((known) => known === p);
}
