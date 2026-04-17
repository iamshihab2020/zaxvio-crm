"use client";

import Link from "next/link";
import { useMemo } from "react";
import { format, differenceInCalendarDays, parseISO, isValid } from "date-fns";
import { useCalendarEvents } from "@/hooks/queries/use-calendar";
import { useJobs } from "@/hooks/queries/use-jobs";
import { useBookings } from "@/hooks/queries/use-bookings";
import type { CalendarEventData } from "@/actions/calendar-events";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaHoverCard, type AgendaDetails } from "@/components/dashboard/shared/agenda-hover-card";
import { cn } from "@/lib/utils";

interface AgendaTimelineProps {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

interface AgendaJob {
  id: string;
  jobNumber?: string;
  title?: string;
  customerName?: string | null;
  serviceType?: string | null;
  address?: string | null;
  scheduledDate?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  priority?: string | null;
}

type AgendaKind = "event" | "job" | "booking";

type AgendaItem = AgendaDetails & {
  id: string;
};

interface AgendaBooking {
  id: string;
  customerName?: string | null;
  serviceType?: string | null;
  bookingDate?: string | null;
  preferredTime?: string | null;
  address?: string | null;
  description?: string | null;
}

const HOUR_START = 8;
const HOUR_END = 20;
const HOUR_PX = 56;

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

function eventToItem(e: CalendarEventData): AgendaItem {
  const start = parseDateAt(e.eventDate, e.startTime);
  const end = parseDateAt(e.eventDate, e.endTime);
  return {
    id: `event-${e.id}`,
    kind: "event",
    title: e.title,
    subtitle: e.contactName ?? undefined,
    customerName: e.contactName ?? undefined,
    address: e.address ?? undefined,
    description: e.description ?? undefined,
    start,
    end,
    color: e.color || "#6366f1",
    href: `/schedule`,
  };
}

function bookingToItem(b: AgendaBooking): AgendaItem {
  const start = parseDateAt(b.bookingDate ?? "", b.preferredTime ?? null);
  return {
    id: `booking-${b.id}`,
    kind: "booking",
    title: b.serviceType ? titleCase(b.serviceType) : "Booking",
    subtitle: b.customerName ?? undefined,
    customerName: b.customerName ?? undefined,
    address: b.address ?? undefined,
    description: b.description ?? undefined,
    serviceType: b.serviceType ?? undefined,
    start,
    end: null,
    color: "#14b8a6",
    href: `/bookings?booking=${b.id}`,
  };
}

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function jobToItem(j: AgendaJob): AgendaItem {
  // Prefer full scheduled_start timestamp; fall back to scheduledDate + start time.
  const start = (() => {
    if (j.scheduledStart) {
      const d = parseISO(j.scheduledStart);
      if (isValid(d)) return d;
    }
    if (j.scheduledDate) {
      const d = parseISO(j.scheduledDate);
      if (isValid(d)) return d;
    }
    return null;
  })();
  const end = j.scheduledEnd ? parseISO(j.scheduledEnd) : null;
  return {
    id: `job-${j.id}`,
    kind: "job",
    title: j.jobNumber ?? j.title ?? "Job",
    subtitle: j.customerName ?? undefined,
    customerName: j.customerName ?? undefined,
    address: j.address ?? undefined,
    serviceType: j.serviceType ?? undefined,
    priority: j.priority ?? undefined,
    start,
    end: end && isValid(end) ? end : null,
    color:
      j.priority === "urgent"
        ? "#ef4444"
        : j.priority === "high"
          ? "#f59e0b"
          : "hsl(var(--brand))",
    href: `/jobs?job=${j.id}`,
  };
}

export function AgendaTimeline({ from, to }: AgendaTimelineProps) {
  const { data: eventsRes, isLoading: eventsLoading } = useCalendarEvents({
    dateFrom: from,
    dateTo: to,
    limit: 100,
  });

  // Jobs scheduled anywhere in the window — not just today.
  const { data: jobsRes, isLoading: jobsLoading } = useJobs({
    dateFrom: from,
    dateTo: to,
    limit: 100,
    showArchived: false,
  });

  // Bookings in the window
  const { data: bookingsRes, isLoading: bookingsLoading } = useBookings({
    dateFrom: from,
    dateTo: to,
    limit: 100,
  });

  const isLoading = eventsLoading || jobsLoading || bookingsLoading;

  const items = useMemo<AgendaItem[]>(() => {
    const eventItems = (eventsRes?.data ?? []).map(eventToItem);
    const jobItems = ((jobsRes?.data ?? []) as AgendaJob[]).map(jobToItem);
    const bookingItems = ((bookingsRes?.data ?? []) as AgendaBooking[]).map(
      bookingToItem,
    );
    return [...eventItems, ...jobItems, ...bookingItems].sort((a, b) => {
      const ax = a.start?.getTime() ?? Number.POSITIVE_INFINITY;
      const bx = b.start?.getTime() ?? Number.POSITIVE_INFINITY;
      return ax - bx;
    });
  }, [eventsRes, jobsRes, bookingsRes]);

  const mode = useMemo<"day" | "week" | "range">(() => {
    try {
      const span = differenceInCalendarDays(parseISO(to), parseISO(from));
      if (span <= 0) return "day";
      if (span <= 14) return "week";
      return "range";
    } catch {
      return "day";
    }
  }, [from, to]);

  const title = mode === "day" ? "Today's Agenda" : mode === "week" ? "Upcoming Agenda" : "Agenda";

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          {title}
        </h3>
        <Link
          href="/schedule"
          className="text-[11px] font-body text-muted-foreground hover:text-foreground"
        >
          View schedule →
        </Link>
      </div>

      {isLoading ? (
        <AgendaSkeleton />
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-body text-muted-foreground">
            Nothing scheduled
          </div>
          <div className="mt-1 text-[11px] font-body text-muted-foreground">
            Events, jobs, and bookings in the next 7 days will show here.
          </div>
        </div>
      ) : mode === "day" ? (
        <DayTimeline items={items} />
      ) : (
        <GroupedList items={items} condensed={mode === "range"} />
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

function AgendaSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-12 flex-1 rounded-xl" />
        </div>
      ))}
    </div>
  );
}

function DayTimeline({ items }: { items: AgendaItem[] }) {
  const hours = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

  return (
    <div className="relative mt-4 flex-1 overflow-y-auto" style={{ maxHeight: (HOUR_END - HOUR_START) * HOUR_PX + 40 }}>
      <div className="relative" style={{ height: (HOUR_END - HOUR_START) * HOUR_PX }}>
        {hours.map((h, i) => (
          <div
            key={h}
            className="absolute left-0 right-0 flex items-start gap-3 border-t border-dashed border-border/60"
            style={{ top: i * HOUR_PX }}
          >
            <span className="mt-[-6px] w-10 shrink-0 pl-1 text-[10px] font-body text-muted-foreground">
              {h === 12 ? "12 pm" : h > 12 ? `${h - 12} pm` : `${h} am`}
            </span>
          </div>
        ))}
        {items.map((item) => {
          if (!item.start) return null;
          const startH = item.start.getHours() + item.start.getMinutes() / 60;
          if (startH < HOUR_START || startH > HOUR_END) return null;
          const endH = item.end
            ? item.end.getHours() + item.end.getMinutes() / 60
            : startH + 1;
          const top = (startH - HOUR_START) * HOUR_PX;
          const height = Math.max(28, (endH - startH) * HOUR_PX - 4);
          return (
            <AgendaHoverCard key={item.id} details={item}>
              <Link
                href={item.href}
                className="absolute left-12 right-2 flex flex-col justify-center rounded-xl border px-3 py-2 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
                style={{
                  top,
                  height,
                  backgroundColor: `${item.color}14`,
                  borderColor: `${item.color}55`,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <KindBadge kind={item.kind} />
                  <span className="truncate font-heading text-xs font-semibold text-foreground">
                    {item.title}
                  </span>
                </div>
                {item.subtitle && (
                  <span className="truncate text-[11px] font-body text-muted-foreground">
                    {item.subtitle}
                  </span>
                )}
                {item.start && (
                  <span className="mt-0.5 text-[10px] font-body text-muted-foreground">
                    {format(item.start, "h:mm a")}
                    {item.end ? ` – ${format(item.end, "h:mm a")}` : ""}
                  </span>
                )}
              </Link>
            </AgendaHoverCard>
          );
        })}
      </div>
    </div>
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
                        {item.start && (
                          <div className="mt-1 text-[10px] font-body font-medium text-muted-foreground">
                            {format(item.start, "h:mm a")}
                            {item.end ? ` – ${format(item.end, "h:mm a")}` : ""}
                          </div>
                        )}
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
