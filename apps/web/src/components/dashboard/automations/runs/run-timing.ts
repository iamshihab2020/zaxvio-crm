/**
 * How long, and how long ago.
 *
 * Kept out of the components because three of them need the same answers and a
 * run page whose list and detail disagree about a duration is worse than one
 * that shows neither.
 */

/**
 * A duration a person can read.
 *
 * Sub-second work is reported in milliseconds because that is the range almost
 * every step lands in, and "0s" next to eleven steps reads as broken. Above a
 * minute the seconds are kept — "3m" hides the difference between a three-minute
 * step and a nearly-four-minute one, and that difference is the thing somebody
 * opened this page about.
 */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) {
    const s = ms / 1000;
    return `${s < 10 ? s.toFixed(1) : Math.round(s)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  if (minutes < 60) return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/**
 * "2 minutes ago", "in 3 days".
 *
 * `Intl.RelativeTimeFormat` rather than a hand-rolled ladder, so it is
 * localised and correctly pluralised for free. It handles the future too, which
 * this genuinely needs: a waiting run's `resumeAt` is a date that has not
 * happened, and the same helper has to say "in 3 days" without a second branch
 * at every call site.
 */
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86_400_000],
  ["month", 30 * 86_400_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
  ["second", 1000],
];

export function formatRelative(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const diff = then - Date.now();
  const abs = Math.abs(diff);

  // Below the smallest unit the answer is "now", not "in 0 seconds".
  if (abs < 45_000) return diff < 0 ? "just now" : "any moment";

  for (const [unit, size] of UNITS) {
    if (abs >= size) return RELATIVE.format(Math.round(diff / size), unit);
  }
  return null;
}

/**
 * An exact timestamp in the tenant's timezone, for the tooltip behind the
 * relative one.
 *
 * The zone is passed in rather than left to the browser: a contractor in
 * Chicago looking at a run on a laptop still set to UTC would otherwise read
 * times six hours out, and this repo has fixed that exact class of bug on the
 * dashboard, the calendar, the completion email and the job board.
 */
export function formatExact(
  iso: string | null | undefined,
  timeZone: string,
): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

/** Wall-clock elapsed for a run, which stores start and end rather than a span. */
export function elapsedMs(
  startedAt: string,
  completedAt: string | null,
): number | null {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : null;
  if (Number.isNaN(start) || end === null || Number.isNaN(end)) return null;
  return end - start;
}
