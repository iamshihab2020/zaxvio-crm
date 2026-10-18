"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconPlayerStop, IconClock } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useRunningTimer, useStopJobTimer } from "@/hooks/queries";
import { ElapsedTime } from "./elapsed-time";

/**
 * The running timer, on every page.
 *
 * ## Why this exists at all
 *
 * It is the whole reason a stopwatch beats a text box. The failure a timer
 * introduces that a text box does not have is *forgetting to stop it* — and the
 * only real defence against that is being unable to look at the app without
 * seeing the clock. The hourly sweep is the backstop for when nobody looks; this
 * is the thing that stops the sweep from ever being needed.
 *
 * ## Why Stop lives here and not only on the job
 *
 * Somebody clocks into a job and then navigates away — to the schedule, to a
 * customer, to the dashboard. If Stop only existed on the job they started from,
 * stopping would mean first remembering which job it was. The service stops
 * whichever timer belongs to *this user*, so the bar does not need to know.
 *
 * Renders nothing when no timer is running, so it costs a fixed query and no
 * layout on every other page load.
 */
interface RunningTimerBarProps {
  /**
   * Where it pins. The navbar is `fixed` at `h-14`, and shifts to `top-10` while
   * an admin is impersonating — so the offset is the layout's to supply, not
   * this component's to guess.
   */
  offsetClass?: string;
}

/**
 * The timer entry this bar last announced, kept at module scope on purpose.
 *
 * The bar lives inside the dashboard's `<main>`, which is keyed by pathname,
 * so it remounts on every navigation. Component state would forget it had
 * already shown this timer and drop the bar in again on each page. A module
 * variable survives the remount, so the drop-in plays once per timer: when one
 * starts, or the first time a running one is seen this session.
 */
let announcedTimerId: string | null = null;

export function RunningTimerBar({
  offsetClass = "top-14",
}: RunningTimerBarProps) {
  const { data } = useRunningTimer();
  const running = data?.data ?? null;
  const stop = useStopJobTimer(running?.jobId ?? "");

  const isNew = running !== null && running.id !== announcedTimerId;
  useEffect(() => {
    if (running) announcedTimerId = running.id;
  }, [running]);

  if (!running) return null;

  // A fixed `h-12`, not padding around the content: full-height pages subtract
  // exactly this (`--timer-bar-h`, found by `data-running-timer` in
  // globals.css). The row is one line that truncates, so it never needs more.
  // No negative side margins: the parent `<main>` has no padding to bleed into,
  // so they pushed the clock and Stop flush against the edges of the screen.
  return (
    <div
      role="status"
      aria-live="polite"
      data-running-timer
      className={`sticky ${offsetClass} z-10 flex h-12 items-center gap-3 border-b border-brand/25 bg-brand/10 px-4 backdrop-blur-md sm:px-6 ${isNew ? "motion-drop-in" : ""}`}
    >
      <IconClock className="h-4 w-4 shrink-0 text-brand" aria-hidden />

      <Link
        href={`/jobs/${running.jobId}`}
        className="min-w-0 flex-1 truncate font-body text-sm text-foreground hover:underline"
      >
        <span className="font-medium">{running.jobNumber}</span>
        <span className="text-muted-foreground"> · {running.jobTitle}</span>
      </Link>

      <ElapsedTime
        since={running.startedAt}
        className="tnum shrink-0 font-mono text-sm font-semibold text-brand-ink"
      />

      <Button
        size="sm"
        variant="outline"
        disabled={stop.isPending}
        onClick={() => stop.mutate(undefined)}
        className="h-7 shrink-0 cursor-pointer border-brand/40 px-2 text-xs text-brand-ink hover:bg-brand/10 hover:text-brand-ink"
      >
        <IconPlayerStop className="mr-1 h-3.5 w-3.5" aria-hidden />
        {stop.isPending ? "Stopping…" : "Stop"}
      </Button>
    </div>
  );
}
