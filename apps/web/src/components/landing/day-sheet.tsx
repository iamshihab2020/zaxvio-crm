"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * The day sheet — the landing page's signature element.
 *
 * A field service operator's unit of work is the day, laid out in hours. This
 * renders that: a time-ruled column with jobs placed at their real start and
 * duration, and a marker on the current hour.
 *
 * It replaces a `react-device-frameset` MacBook mockup, for three reasons.
 * The mockup shipped a dependency and its stylesheet purely for decoration; it
 * needed a separate, different `sm:hidden` fallback, so the thing shown to the
 * phone-first audience was not the thing being advertised; and a laptop is the
 * wrong object entirely for a product sold on "run it from the truck". Here the
 * desktop and mobile renderings are the same artefact at different widths.
 */

const START_HOUR = 7;
const END_HOUR = 18;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

type JobStatus = "done" | "active" | "booked";

const JOBS: {
  start: number;
  end: number;
  customer: string;
  service: string;
  status: JobStatus;
}[] = [
  { start: 7.5, end: 9, customer: "Johnson Residence", service: "No heat, emergency call", status: "done" },
  { start: 9.5, end: 11, customer: "Oak Park Office", service: "Quarterly service", status: "done" },
  { start: 11.5, end: 13.5, customer: "Rivera Home", service: "New install, day 1", status: "active" },
  { start: 14, end: 15.5, customer: "Chen Apartment", service: "Filter + coil clean", status: "booked" },
  { start: 16, end: 17.5, customer: "Williams House", service: "Duct inspection", status: "booked" },
];

const STATUS_STYLE: Record<JobStatus, string> = {
  done: "border-border bg-muted/60 text-muted-foreground",
  active: "border-brand/40 bg-brand/10 text-ink shadow-sm",
  booked: "border-border bg-card text-ink",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  done: "Done",
  active: "On site",
  booked: "Booked",
};

function formatHour(hour: number) {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function DaySheet() {
  /* Rendered only after mount. The weekday and the "now" marker come from the
     reader's clock, which the server cannot know — deriving them during SSR
     would produce a hydration mismatch and, worse, bake one machine's timezone
     into the HTML. */
  const [now, setNow] = useState<{ label: string; offset: number | null } | null>(
    null,
  );

  useEffect(() => {
    const compute = () => {
      const d = new Date();
      const hour = d.getHours() + d.getMinutes() / 60;
      setNow({
        label: d.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "short",
        }),
        offset:
          hour >= START_HOUR && hour <= END_HOUR
            ? (hour - START_HOUR) / (END_HOUR - START_HOUR)
            : null,
      });
    };
    compute();
    const id = window.setInterval(compute, 60_000);
    return () => window.clearInterval(id);
  }, []);

  const span = END_HOUR - START_HOUR;

  return (
    <figure className="m-0">
      <Card className="overflow-hidden shadow-xl shadow-ink/5">
        {/* Sheet header — reads like the top of a work order. */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {now?.label ?? "Today"}
            </p>
            <p className="mt-0.5 font-heading text-sm font-semibold text-ink">
              Today&rsquo;s schedule
            </p>
          </div>
          {/* The count is derived, so it cannot drift from the rows below it.
              A `$2,480` takings badge used to sit beside it; that figure was
              invented, and a revenue number is the single detail that turns a
              diagram into something the reader reads as a real screenshot. */}
          <Badge
            variant="secondary"
            className="tnum shrink-0 font-mono text-[11px]"
          >
            {JOBS.length} jobs
          </Badge>
        </div>

        <Separator />

        {/* Ruled column. Rows are a fixed height so a job's block height is
            literally proportional to how long the job takes. */}
        <div
          className="relative px-4 py-3 sm:px-5"
          /* 2.6rem × 11 hours keeps the whole working day visible without the
             card outgrowing the copy beside it — at 3.25rem the sheet stood
             ~230px taller than the headline column, and centring the two left
             a void above and below the text. */
          style={{ "--row": "2.6rem" } as React.CSSProperties}
        >
          <div className="relative" style={{ height: `calc(${span} * var(--row))` }}>
            {/* Hour rules + labels */}
            {HOURS.map((hour, i) => (
              <div
                key={hour}
                className="absolute inset-x-0 flex items-center gap-3"
                style={{ top: `calc(${i} * var(--row))` }}
              >
                <span className="tnum w-9 shrink-0 font-mono text-[11px] text-muted-foreground/70">
                  {String(hour).padStart(2, "0")}
                </span>
                <span aria-hidden="true" className="h-px flex-1 bg-border" />
              </div>
            ))}

            {/* Job blocks */}
            <div className="absolute inset-y-0 left-12 right-0">
              {JOBS.map((job) => (
                <div
                  key={job.customer}
                  className={cn(
                    "absolute inset-x-0 overflow-hidden rounded-lg border px-3 py-2",
                    STATUS_STYLE[job.status],
                  )}
                  style={{
                    top: `calc(${job.start - START_HOUR} * var(--row) + 2px)`,
                    height: `calc(${job.end - job.start} * var(--row) - 4px)`,
                  }}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold sm:text-[13px]">
                      {job.customer}
                    </p>
                    <span className="tnum shrink-0 font-mono text-[10px] opacity-70">
                      {formatHour(job.start)}
                    </span>
                  </div>
                  <p className="truncate text-[11px] opacity-70">{job.service}</p>
                  {/* A pinging dot on invented data is a live-status cue with
                      nothing live behind it. The word alone carries the state. */}
                  {job.status === "active" ? (
                    <span className="mt-1 inline-flex font-mono text-[10px] text-brand">
                      {STATUS_LABEL[job.status]}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* The one live element on the page: a marker on the real hour. */}
            {now?.offset !== null && now?.offset !== undefined ? (
              <div
                className="pointer-events-none absolute inset-x-0 flex items-center gap-2"
                style={{ top: `calc(${now.offset} * ${span} * var(--row))` }}
                aria-hidden="true"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span className="h-px flex-1 bg-brand/50" />
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <figcaption className="sr-only">
        Example day: five jobs between 7am and 6pm. Two finished, one in
        progress, two still booked.
      </figcaption>
    </figure>
  );
}
