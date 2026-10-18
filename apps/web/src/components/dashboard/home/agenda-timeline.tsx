"use client";

import Link from "next/link";
import { useMemo, useRef } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
import type {
  DashboardAgenda,
  DashboardAgendaBooking,
  DashboardAgendaEvent,
  DashboardAgendaJob,
} from "@hvac-saas/types";
import { AgendaHoverCard, type AgendaDetails } from "@/components/dashboard/shared/agenda-hover-card";
import { Card } from "@/components/ui/card";
import {
  JOB_PRIORITY_COLORS,
  JOB_PRIORITY_LABELS,
} from "@/lib/constants/job-options";
import { tokenColor } from "@/lib/constants/chart-palette";
import { useStagger } from "@/hooks/use-stagger";
import { WidgetWindowBadge } from "./widget-window-badge";
import { WidgetHeader, WidgetLink } from "./widget-header";
import { bookingLink, jobLink } from "@/lib/entity-links";
import { cn } from "@/lib/utils";

interface AgendaTimelineProps {
  agenda: DashboardAgenda;
}

type AgendaKind = "event" | "job" | "booking";

/**
 * `hasTime` distinguishes "scheduled for 9am" from "scheduled that day, no time".
 * `start` still carries the date in both cases so sorting works, but without
 * this flag an untimed item would print a meaningless "12:00 AM".
 *
 * `date` is the raw yyyy-MM-dd the API sent, and it is what the day sheet
 * groups on. `start` is a local-clock Date rebuilt from that string, and
 * formatting it back would be one more place for a timezone to move a job to
 * the wrong day.
 */
type AgendaItem = AgendaDetails & {
  id: string;
  hasTime: boolean;
  date: string | null;
};

/**
 * The colour of a row is its kind, and only its kind: DESIGN.md says a job is
 * always orange, a booking always teal and an event always indigo, here and in
 * the type badges. Week Ahead beside this widget draws the kinds the same way,
 * so one booking is one teal on the whole screen.
 *
 * Rows used to be coloured by something else. A job took its priority's hue,
 * so a blue rule meant "standard job" in a list where indigo meant "event", and
 * an event took its own calendar colour, so two events could be two colours.
 * Neither says what kind of thing the row is, which is what the rule down its
 * left edge is for. Priority is a word now (see `PriorityPill`), shown only
 * where it needs attention.
 *
 * These are tokens, not Tailwind's indigo-500/teal-500, so both themes stay
 * correct and the colours are the validated ones.
 */
const KIND_COLOR: Record<AgendaKind, string> = {
  job: tokenColor("brand"),
  booking: tokenColor("series-booking"),
  event: tokenColor("series-event"),
};

/** The whole list, not each day: the card sets its own height (see `AgendaTimeline`). */
const MAX_ROWS = 10;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}/;

/** The yyyy-MM-dd prefix of a date string, or null if it isn't one. */
function dayKey(date: string | null): string | null {
  return date && DAY_KEY.test(date) ? date.slice(0, 10) : null;
}

/** The day after a yyyy-MM-dd key, as a key. Null if the key isn't a real date. */
function nextDayKey(key: string | null): string | null {
  if (!key) return null;
  const d = parseISO(key);
  return isValid(d) ? format(addDays(d, 1), "yyyy-MM-dd") : null;
}

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
    date: dayKey(e.eventDate),
    color: KIND_COLOR.event,
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
    date: dayKey(b.bookingDate),
    color: KIND_COLOR.booking,
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
    date: dayKey(j.scheduledDate),
    color: KIND_COLOR.job,
    // Param name must match what jobs-page-client.tsx reads (`jobId`, not `job`).
    href: jobLink(j.id),
  };
}

/** One day of the sheet. A null key is the "Unscheduled" tail. */
interface DayGroup {
  key: string | null;
  items: AgendaItem[];
}

/**
 * Bucket the (already sorted, already capped) items by their own date string.
 * Days come out in date order, undated items last. Today is always a section,
 * even with nothing in it, because "nothing today" is an answer the reader
 * came for and a list that silently starts tomorrow doesn't give it.
 */
function groupByDay(items: AgendaItem[], todayKey: string | null): DayGroup[] {
  const byDay = new Map<string, AgendaItem[]>();
  const unscheduled: AgendaItem[] = [];
  if (todayKey) byDay.set(todayKey, []);

  for (const item of items) {
    if (!item.date) {
      unscheduled.push(item);
      continue;
    }
    const bucket = byDay.get(item.date);
    if (bucket) bucket.push(item);
    else byDay.set(item.date, [item]);
  }

  // yyyy-MM-dd sorts as text in date order.
  const groups: DayGroup[] = Array.from(byDay.keys())
    .sort()
    .map((key) => ({ key, items: byDay.get(key) ?? [] }));
  if (unscheduled.length > 0) groups.push({ key: null, items: unscheduled });
  return groups;
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

  // "Today" is the agenda window's first day. The API resolves it in the
  // tenant's timezone, and the browser's clock can sit on a different date: a
  // contractor travelling, or the last hours of the day in another zone, would
  // otherwise see tomorrow's jobs under a "Today" heading.
  const todayKey = dayKey(from);
  const tomorrowKey = useMemo(() => nextDayKey(todayKey), [todayKey]);

  const days = useMemo(
    () => groupByDay(items.slice(0, MAX_ROWS), todayKey),
    [items, todayKey],
  );
  const hiddenCount = items.length - MAX_ROWS;

  // Which rows are on the sheet, not the agenda objects: a refetch that returns
  // the same work keeps the key, so the sheet only re-lays itself out when a
  // job, booking or event is added, removed or moves day, or when the window
  // rolls over to a new today.
  const rowsKey = useMemo(
    () =>
      `${from}:${days
        .flatMap((day) => day.items.map((item) => item.id))
        .join("|")}`,
    [from, days],
  );

  return (
    // No `h-full`: this card lives in the side zone's stack, where a percentage
    // height resolves against the stretched zone and pulls the card down to
    // the bottom of the main zone, leaving empty sheet under the last row.
    <Card data-widget="agenda" className="flex flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Up next"
        badge={<WidgetWindowBadge label={`Next ${spanDays} days`} />}
        action={<WidgetLink href="/schedule">Schedule →</WidgetLink>}
      />

      {items.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
          <div className="text-sm font-body text-muted-foreground">
            Nothing scheduled
          </div>
          <div className="mt-1 text-[11px] font-body text-muted-foreground">
            Jobs, bookings and events for the next {spanDays} days will show here.
          </div>
        </div>
      ) : (
        <>
          {/* No inner scroll. This card sits in the dashboard's side zone, which
              is a stack, so the list sets its own height and nothing next to it
              is stretched to match. A scrolling box was how it used to avoid
              that, and on a phone it put a scroll area inside the page scroll.
              The ten-row cap is what bounds the height instead. */}
          <div className="mt-4 space-y-5">
            {days.map((group) => (
              <DaySection
                key={group.key ?? "unscheduled"}
                group={group}
                todayKey={todayKey}
                tomorrowKey={tomorrowKey}
                rowsKey={rowsKey}
              />
            ))}
          </div>

          {hiddenCount > 0 && (
            <div className="motion-appear mt-3">
              <WidgetLink href="/schedule">
                {hiddenCount} more on the schedule →
              </WidgetLink>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

const KIND_LABEL: Record<AgendaKind, string> = {
  event: "Event",
  job: "Job",
  booking: "Booking",
};

// The kind's colour is the tint; the word is ink. Printing the word in the
// series hue measured 2.3:1 for bookings and 4.0:1 for events at 9px.
function KindBadge({ kind }: { kind: AgendaKind }) {
  const style = {
    event: "bg-[hsl(var(--series-event)/0.14)]",
    job: "bg-brand/15",
    booking: "bg-[hsl(var(--series-booking)/0.14)]",
  }[kind];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-body font-semibold uppercase tracking-wide text-foreground",
        style,
      )}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Only these two are worth a word on a row; "standard" is the default and says nothing. */
function flaggedPriority(
  priority: string | null | undefined,
): "urgent" | "emergency" | null {
  return priority === "urgent" || priority === "emergency" ? priority : null;
}

/**
 * Reuses the Jobs board's priority classes and labels, so the same job reads the
 * same on both pages. Emergency carries the same slow pulse the kanban card
 * gives it, which DESIGN.md allows as a signal; reduced motion turns it into a
 * steady ring (globals.css), so the state survives without the movement.
 */
function PriorityPill({ priority }: { priority: "urgent" | "emergency" }) {
  const colors = JOB_PRIORITY_COLORS[priority];
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-body font-semibold uppercase tracking-wide",
        colors.bg,
        colors.text,
        priority === "emergency" && "animate-pulse-emergency",
      )}
    >
      {JOB_PRIORITY_LABELS[priority]}
    </span>
  );
}

function dayLabel(
  key: string | null,
  todayKey: string | null,
  tomorrowKey: string | null,
): string {
  if (key === null) return "Unscheduled";
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  const d = parseISO(key);
  return isValid(d) ? format(d, "EEE d MMM") : key;
}

function DaySection({
  group,
  todayKey,
  tomorrowKey,
  rowsKey,
}: {
  group: DayGroup;
  todayKey: string | null;
  tomorrowKey: string | null;
  /** Identifies the rows on the whole sheet; every day re-lays its rows together. */
  rowsKey: string;
}) {
  const isToday = group.key !== null && group.key === todayKey;
  // Each day staggers its own rows from zero, all on the same key, so the sheet
  // fills top-down together and no day waits on the one above it.
  const listRef = useRef<HTMLUListElement>(null);
  useStagger(listRef, rowsKey);

  return (
    <div>
      {/* The day's Label. "Today" is the one orange word, because orange here
          means now. */}
      <h3
        className={cn(
          "border-b border-border pb-1.5 font-heading text-[11px] font-semibold uppercase tracking-wider",
          isToday ? "text-brand-ink" : "text-muted-foreground",
        )}
      >
        {dayLabel(group.key, todayKey, tomorrowKey)}
      </h3>
      {group.items.length === 0 ? (
        <p className="py-3 text-sm font-body text-muted-foreground">
          Nothing scheduled today
        </p>
      ) : (
        <ul ref={listRef} className="mt-1.5 space-y-1">
          {group.items.map((item) => (
            <AgendaRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One entry on the day sheet: the hour in the left column, the work on the
 * right, with a rule in the work's kind colour between them.
 *
 * Two lines, 48px at least. The time is a column rather than a third line (it
 * made every entry ~76px, and thirteen of them ran the widget past 1000px), and
 * as a column it scans down the sheet. Tabular mono figures keep it straight.
 * On a phone the whole row is the tap target; the hover card is a desktop
 * preview and the link still navigates on touch.
 */
function AgendaRow({ item }: { item: AgendaItem }) {
  const flagged = item.kind === "job" ? flaggedPriority(item.priority) : null;
  const time = item.start
    ? item.hasTime
      ? format(item.start, "h:mm a")
      : "All day"
    : "—";

  return (
    <li className="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-3">
      <span className="tnum pt-2 font-mono text-xs text-muted-foreground">
        {time}
      </span>
      <AgendaHoverCard details={item} side="left">
        <Link
          href={item.href}
          style={{ borderLeftColor: item.color }}
          className="block min-h-12 min-w-0 rounded-r-md border-l-2 px-3 py-1.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {item.title}
            </span>
            {flagged && <PriorityPill priority={flagged} />}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <KindBadge kind={item.kind} />
            {item.subtitle && (
              <span className="truncate text-xs font-body text-muted-foreground">
                {item.subtitle}
              </span>
            )}
          </div>
        </Link>
      </AgendaHoverCard>
    </li>
  );
}
