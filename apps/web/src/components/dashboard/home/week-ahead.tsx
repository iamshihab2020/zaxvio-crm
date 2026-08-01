"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from "date-fns";
import type { DashboardAgenda } from "@hvac-saas/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { WidgetWindowBadge } from "./widget-window-badge";
import { cn } from "@/lib/utils";

/**
 * The week's workload, as a shape rather than a list.
 *
 * The Agenda beside this answers "what is next" one row at a time. It cannot
 * answer "which day am I overloaded on" or "where is the hole I should be
 * selling into" — thirteen chronological rows hide both. Seven columns show
 * them at a glance, which is the question a one-to-three person crew actually
 * opens the dashboard with.
 *
 * Every number here comes from the agenda payload the dashboard already
 * fetches, so the widget costs no additional query.
 */

interface WeekAheadProps {
  agenda: DashboardAgenda;
}

/** Fixed series order. A colour means a kind, never a rank. */
const SERIES = [
  { key: "jobs", label: "Jobs", color: "hsl(var(--brand))" },
  { key: "bookings", label: "Bookings", color: "hsl(var(--series-booking))" },
  { key: "events", label: "Events", color: "hsl(var(--series-event))" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

interface DayLoad {
  /** yyyy-MM-dd */
  key: string;
  date: Date;
  counts: Record<SeriesKey, number>;
  total: number;
  isToday: boolean;
}

/**
 * A column per day of the window the API actually sent, never a fixed seven.
 *
 * `agenda.from → agenda.to` is today plus seven, which is **eight** calendar
 * days — verified against real data, where a booking landed on that eighth day.
 * Hardcoding seven columns would have dropped it from the strip while the
 * Agenda beside it still listed it. Bounded so a future window change cannot
 * render an unbounded row.
 */
const MAX_DAYS = 14;
/** Track height in px. Bars grow from the baseline inside it. */
const TRACK = 92;
/** A day with work always shows something, even at one item against a busy week. */
const MIN_SEGMENT = 6;

export function WeekAhead({ agenda }: WeekAheadProps) {
  const days = useMemo<DayLoad[]>(() => {
    const start = parseISO(agenda.from);
    const end = parseISO(agenda.to);
    if (!isValid(start)) return [];

    const span = isValid(end) ? differenceInCalendarDays(end, start) + 1 : 7;
    const dayCount = Math.min(Math.max(span, 1), MAX_DAYS);

    const byKey = new Map<string, DayLoad>();
    for (let i = 0; i < dayCount; i++) {
      const date = addDays(start, i);
      const key = format(date, "yyyy-MM-dd");
      byKey.set(key, {
        key,
        date,
        counts: { jobs: 0, bookings: 0, events: 0 },
        total: 0,
        isToday: i === 0,
      });
    }

    const tally = (dateStr: string | null, kind: SeriesKey) => {
      if (!dateStr) return;
      // Dates arrive as yyyy-MM-dd already resolved in the tenant's timezone —
      // slicing rather than parsing keeps them there. Parsing to a Date and
      // reformatting would re-read them in the browser's zone.
      const day = byKey.get(dateStr.slice(0, 10));
      if (!day) return;
      day.counts[kind] += 1;
      day.total += 1;
    };

    agenda.jobs.forEach((j) => tally(j.scheduledDate, "jobs"));
    agenda.bookings.forEach((b) => tally(b.bookingDate, "bookings"));
    agenda.events.forEach((e) => tally(e.eventDate, "events"));

    return Array.from(byKey.values());
  }, [agenda]);

  const total = days.reduce((sum, d) => sum + d.total, 0);
  const peak = days.reduce((max, d) => Math.max(max, d.total), 0);
  const busiest = peak > 0 ? days.find((d) => d.total === peak) : undefined;
  const openDays = days.filter((d) => d.total === 0).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-semibold text-foreground">
              Week Ahead
            </h3>
            <WidgetWindowBadge
              label={days.length > 0 ? `Next ${days.length} days` : "Next 7 days"}
            />
          </div>
          <p className="mt-1 text-[11px] font-body text-muted-foreground">
            {total === 0
              ? "Nothing booked yet — every day is open."
              : busiest
                ? `${total} scheduled · busiest ${format(busiest.date, "EEEE")} with ${busiest.total}${
                    openDays > 0
                      ? ` · ${openDays} open ${openDays === 1 ? "day" : "days"}`
                      : ""
                  }`
                : `${total} scheduled`}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Legend />
          <Link
            href="/schedule"
            className="whitespace-nowrap rounded text-[11px] font-body text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View schedule →
          </Link>
        </div>
      </div>

      {/* `grid-flow-col auto-cols-fr` so the column count follows the window
          rather than a hardcoded seven.

          Not `aria-hidden`, unlike the SVG charts elsewhere on this page: every
          column is a link, and hiding focusable content from assistive tech
          while leaving it in the tab order is worse than no chart at all. The
          bars themselves are hidden per column and each link carries the same
          numbers as a label, so there is no separate table to keep in sync. */}
      <div className="mt-5 grid auto-cols-fr grid-flow-col gap-2 sm:gap-3">
        {days.map((day) => (
          <DayColumn key={day.key} day={day} peak={peak} />
        ))}
      </div>

    </div>
  );
}

/** What a screen reader hears instead of the bar. */
function dayLabel(day: DayLoad): string {
  const when = `${day.isToday ? "Today, " : ""}${format(day.date, "EEEE d MMMM")}`;
  if (day.total === 0) return `${when}: nothing scheduled`;
  const parts = SERIES.filter((s) => day.counts[s.key] > 0).map(
    (s) => `${day.counts[s.key]} ${s.label.toLowerCase()}`,
  );
  return `${when}: ${day.total} scheduled — ${parts.join(", ")}`;
}

function Legend() {
  return (
    <ul className="flex items-center gap-3">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-[2px]"
            style={{ backgroundColor: s.color }}
            aria-hidden
          />
          <span className="text-[11px] font-body text-muted-foreground">
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function DayColumn({ day, peak }: { day: DayLoad; peak: number }) {
  const segments = SERIES.filter((s) => day.counts[s.key] > 0).map((s) => ({
    ...s,
    count: day.counts[s.key],
    height: Math.max(MIN_SEGMENT, (day.counts[s.key] / Math.max(peak, 1)) * TRACK),
  }));

  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <Link
          href="/schedule"
          aria-label={dayLabel(day)}
          className={cn(
            "group flex flex-col items-center gap-2 rounded-xl border border-transparent px-1 py-2 transition-colors",
            "hover:border-border hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            day.isToday && "border-brand/30 bg-brand/[0.06]",
          )}
        >
          {/* Bars sit on a shared baseline so column heights compare directly. */}
          <div
            className="flex w-full flex-col justify-end"
            style={{ height: TRACK }}
            aria-hidden
          >
            {segments.length === 0 ? (
              <div className="h-1 w-full rounded-full border-t border-dashed border-border" />
            ) : (
              <div className="flex w-full flex-col-reverse gap-[2px]">
                {segments.map((s, i) => (
                  <div
                    key={s.key}
                    className={cn(
                      "w-full",
                      // Only the top of the stack is rounded; the rest stays
                      // square so the segments read as one bar.
                      i === segments.length - 1
                        ? "rounded-t-[4px]"
                        : "rounded-none",
                    )}
                    style={{ height: s.height, backgroundColor: s.color }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-0.5" aria-hidden>
            <span
              className={cn(
                "font-mono text-[9px] uppercase tracking-wider",
                day.isToday ? "text-brand" : "text-muted-foreground",
              )}
            >
              {day.isToday ? "Today" : format(day.date, "EEE")}
            </span>
            <span
              className={cn(
                "tnum font-heading text-sm font-semibold leading-none",
                day.total > 0 ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {day.total > 0 ? day.total : "—"}
            </span>
          </div>
        </Link>
      </HoverCardTrigger>

      <HoverCardContent className="w-56 p-3" side="top">
        <div className="font-heading text-sm font-semibold text-foreground">
          {format(day.date, "EEEE, MMM d")}
        </div>
        {day.total === 0 ? (
          <p className="mt-1 text-[11px] font-body text-muted-foreground">
            Nothing scheduled. Open for work.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {SERIES.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-3 text-[11px] font-body"
              >
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-[2px]"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  {s.label}
                </span>
                <span className="tnum font-medium text-foreground">
                  {day.counts[s.key]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
