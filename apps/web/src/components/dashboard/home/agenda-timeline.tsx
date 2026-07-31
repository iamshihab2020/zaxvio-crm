"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, differenceInCalendarDays, parseISO, isValid } from "date-fns";
import type {
  DashboardAgenda,
  DashboardAgendaBooking,
  DashboardAgendaEvent,
  DashboardAgendaJob,
} from "@hvac-saas/types";
import { AgendaHoverCard, type AgendaDetails } from "@/components/dashboard/shared/agenda-hover-card";
import {
  JOB_PRIORITY_CHART_COLORS,
  type JobPriority,
} from "@/lib/constants/job-options";
import { WidgetWindowBadge } from "./widget-window-badge";
import { bookingLink, jobLink } from "@/lib/entity-links";
import { cn } from "@/lib/utils";

interface AgendaTimelineProps {
  agenda: DashboardAgenda;
}

type AgendaKind = "event" | "job" | "booking";

/**
 * `hasTime` distinguishes "scheduled for 9am" from "scheduled that day, no time".
 * `start` still carries the date in both cases so grouping and sorting work, but
 * without this flag an untimed item would print a meaningless "12:00 AM".
 */
type AgendaItem = AgendaDetails & { id: string; hasTime: boolean };

/**
 * Combine a YYYY-MM-DD date with an optional HH:MM:SS time into a local Date.
 * With no time, returns midnight on that date.
 */
function parseDateAt(date: string, time: string | null): Date | null {
  if (!date) return null;
  const base = parseISO(date);
  if (!isValid(base)) return null;
  if (!time) return base;
  const [h, m] = time.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** End time only exists when both a date and an explicit end time are present. */
function parseEndAt(date: string | null, time: string | null): Date | null {
  if (!date || !time) return null;
  return parseDateAt(date, time);
}

function eventToItem(e: DashboardAgendaEvent): AgendaItem {
  return {
    id: `event-${e.id}`,
    kind: "event",
    title: e.title,
    subtitle: e.contactName ?? undefined,
    customerName: e.contactName ?? undefined,
    address: e.address ?? undefined,
    description: e.description ?? undefined,
    start: parseDateAt(e.eventDate, e.startTime),
    end: parseEndAt(e.eventDate, e.endTime),
    hasTime: Boolean(e.startTime),
    color: e.color || "#6366f1",
    href: `/schedule`,
  };
}

function bookingToItem(b: DashboardAgendaBooking): AgendaItem {
  return {
    id: `booking-${b.id}`,
    kind: "booking",
    title: b.serviceType ? titleCase(b.serviceType) : "Booking",
    subtitle: b.customerName ?? undefined,
    customerName: b.customerName ?? undefined,
    address: b.address ?? undefined,
    description: b.description ?? undefined,
    serviceType: b.serviceType ?? undefined,
    start: parseDateAt(b.bookingDate ?? "", b.preferredTime),
    end: null,
    hasTime: Boolean(b.preferredTime),
    color: "#14b8a6",
    // Param name must match what bookings-page-client.tsx reads.
    href: bookingLink(b.id),
  };
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function jobToItem(j: DashboardAgendaJob): AgendaItem {
  // `scheduled_start` is a Postgres `time` column, so it arrives as "09:00:00" —
  // parseISO cannot read that and returns Invalid Date. Combine it with the date
  // through the same helper events and bookings use, or every job renders 12:00 AM.
  return {
    id: `job-${j.id}`,
    kind: "job",
    title: j.jobNumber || j.title || "Job",
    subtitle: j.customerName ?? undefined,
    customerName: j.customerName ?? undefined,
    address: j.address ?? undefined,
    serviceType: j.serviceType ?? undefined,
    priority: j.priority ?? undefined,
    start: parseDateAt(j.scheduledDate ?? "", j.scheduledStart),
    end: parseEndAt(j.scheduledDate, j.scheduledEnd),
    hasTime: Boolean(j.scheduledStart),
    color: priorityColor(j.priority),
    // Param name must match what jobs-page-client.tsx reads (`jobId`, not `job`).
    href: jobLink(j.id),
  };
}

/** Colour by priority, from the shared map keyed off the database enum. */
function priorityColor(priority: string | null): string {
  if (priority && priority in JOB_PRIORITY_CHART_COLORS) {
    return JOB_PRIORITY_CHART_COLORS[priority as JobPriority];
  }
  return "hsl(var(--brand))";
}

export function AgendaTimeline({ agenda }: AgendaTimelineProps) {
  const { from, to, events, jobs, bookings } = agenda;
  const items = useMemo<AgendaItem[]>(() => {
    const eventItems = events.map(eventToItem);
    const jobItems = jobs.map(jobToItem);
    const bookingItems = bookings.map(bookingToItem);
    return [...eventItems, ...jobItems, ...bookingItems].sort((a, b) => {
      const ax = a.start?.getTime() ?? Number.POSITIVE_INFINITY;
      const bx = b.start?.getTime() ?? Number.POSITIVE_INFINITY;
      return ax - bx;
    });
  }, [events, jobs, bookings]);

  const spanDays = useMemo(() => {
    try {
      return differenceInCalendarDays(parseISO(to), parseISO(from));
    } catch {
      return 0;
    }
  }, [from, to]);

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Agenda
          </h3>
          <WidgetWindowBadge label={`Next ${spanDays} days`} />
        </div>
        <Link
          href="/schedule"
          className="whitespace-nowrap text-[11px] font-body text-muted-foreground hover:text-foreground"
        >
          View schedule →
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-body text-muted-foreground">
            Nothing scheduled
          </div>
          <div className="mt-1 text-[11px] font-body text-muted-foreground">
            Events, jobs, and bookings in the next 7 days will show here.
          </div>
        </div>
      ) : (
        <GroupedList items={items} />
      )}
    </div>
  );
}

const KIND_LABEL: Record<AgendaKind, string> = {
  event: "Event",
  job: "Job",
  booking: "Booking",
};

function KindBadge({ kind }: { kind: AgendaKind }) {
  const style = {
    event: "bg-indigo-500/10 text-indigo-500",
    job: "bg-brand/10 text-brand",
    booking: "bg-teal-500/10 text-teal-500",
  }[kind];
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[9px] font-body font-semibold uppercase tracking-wide",
        style,
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}


/** `condensed` is gone — every row is compact now, so there was nothing to vary. */
function GroupedList({ items }: { items: AgendaItem[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, AgendaItem[]>();
    for (const it of items) {
      const key = it.start ? format(it.start, "yyyy-MM-dd") : "unscheduled";
      const arr = map.get(key) ?? [];
      arr.push(it);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [items]);

  return (
    /* `flex-1 min-h-0` instead of `max-h-[700px]`: the list now takes whatever
       height the row gives it and scrolls inside that, rather than *setting*
       the row height at 700px. It was the tallest thing in the row, so its
       neighbour — which has ~340px of content — was stretched to match and
       carried ~450px of empty card. `min-h-0` is required, or a flex child
       refuses to shrink below its content and scrolls the page instead. */
    <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
      {groups.map(([key, groupItems]) => {
        const dayDate = key === "unscheduled" ? null : parseISO(key);
        const dayAbbr = dayDate ? format(dayDate, "MMM").toUpperCase() : "—";
        const dayNum = dayDate ? format(dayDate, "d") : "—";
        const dayName = dayDate ? format(dayDate, "EEEE") : "Unscheduled";
        return (
          <div key={key} className="flex gap-3">
            {/* Day marker, trimmed. The 2xl numeral plus a weekday underneath
                took more vertical space than the entries it was labelling. */}
            <div className="flex w-10 shrink-0 flex-col items-center pt-1.5">
              <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-brand">
                {dayAbbr}
              </span>
              <span className="tnum font-heading text-lg font-bold leading-none text-foreground">
                {dayNum}
              </span>
              <span className="mt-0.5 font-mono text-[9px] uppercase text-muted-foreground">
                {dayName.slice(0, 3)}
              </span>
            </div>
            <ul className="flex-1 space-y-1.5">
              {groupItems.map((item) => (
                <li key={item.id}>
                  <AgendaHoverCard details={item} side="left">
                    {/* Two lines, not three. The time used to sit under the
                        subtitle as a third stacked row, which made every entry
                        ~76px tall — thirteen of them ran the widget past 1000px.
                        Pulled onto the title line and right-aligned, it also
                        becomes scannable down a column instead of being buried
                        in each card. Tabular figures keep that column true. */}
                    <Link
                      href={item.href}
                      className="group flex items-center gap-2.5 rounded-lg border border-border bg-background/40 px-2.5 py-2 transition-all hover:border-brand/40 hover:bg-brand/5 cursor-pointer"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <KindBadge kind={item.kind} />
                          <span className="truncate font-heading text-[13px] font-semibold text-foreground">
                            {item.title}
                          </span>
                        </div>
                        {item.subtitle && (
                          <div className="truncate text-[11px] font-body text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                      <span className="tnum shrink-0 self-start pt-0.5 font-mono text-[10px] text-muted-foreground">
                        {item.start && item.hasTime
                          ? format(item.start, "h:mm a")
                          : "All day"}
                      </span>
                    </Link>
                  </AgendaHoverCard>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
