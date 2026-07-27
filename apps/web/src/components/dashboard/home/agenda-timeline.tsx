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
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
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
        <GroupedList items={items} condensed={spanDays > 14} />
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


function GroupedList({ items, condensed }: { items: AgendaItem[]; condensed: boolean }) {
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
    <div className="mt-4 max-h-[700px] space-y-4 overflow-y-auto pr-1">
      {groups.map(([key, groupItems]) => {
        const dayDate = key === "unscheduled" ? null : parseISO(key);
        const dayAbbr = dayDate ? format(dayDate, "MMM").toUpperCase() : "—";
        const dayNum = dayDate ? format(dayDate, "d") : "—";
        const dayName = dayDate ? format(dayDate, "EEEE") : "Unscheduled";
        return (
          <div key={key} className="flex gap-3">
            {/* Bold day badge */}
            <div className="flex w-12 shrink-0 flex-col items-center pt-1">
              <span className="text-[10px] font-body font-semibold uppercase tracking-wide text-brand">
                {dayAbbr}
              </span>
              <span className="font-heading text-2xl font-bold leading-none text-foreground">
                {dayNum}
              </span>
              {!condensed && (
                <span className="mt-1 text-[10px] font-body text-muted-foreground">
                  {dayName.slice(0, 3)}
                </span>
              )}
            </div>
            <ul className="flex-1 space-y-2">
              {groupItems.map((item) => (
                <li key={item.id}>
                  <AgendaHoverCard details={item} side="left">
                    <Link
                      href={item.href}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-background/40 p-3 transition-all hover:border-brand/40 hover:bg-brand/5 hover:shadow-sm cursor-pointer"
                    >
                      <span
                        className="mt-1 h-2 w-2 shrink-0 rounded-full ring-4 ring-background"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <KindBadge kind={item.kind} />
                          <span className="truncate font-heading text-sm font-semibold text-foreground">
                            {item.title}
                          </span>
                        </div>
                        {item.subtitle && (
                          <div className="mt-0.5 truncate text-[11px] font-body text-muted-foreground">
                            {item.subtitle}
                          </div>
                        )}
                        <div className="mt-1 text-[10px] font-body font-medium text-muted-foreground">
                          {item.start && item.hasTime ? (
                            <>
                              {format(item.start, "h:mm a")}
                              {item.end ? ` – ${format(item.end, "h:mm a")}` : ""}
                            </>
                          ) : (
                            "All day"
                          )}
                        </div>
                      </div>
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
