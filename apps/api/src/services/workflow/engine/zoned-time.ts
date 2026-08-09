/**
 * Wall-clock arithmetic in a tenant's timezone.
 *
 * The engine asks two questions that `Date` cannot answer on its own: "what
 * time is it *there*" and "which instant does that local time name". Both come
 * up wherever a run has to land on a human hour — `delay.wait` computing a
 * resume, working hours pushing one forward, and every schedule node after
 * them.
 *
 * It lives in the engine rather than `lib/timezone.ts` because that module
 * answers a different question: it formats dates *for display* and derives
 * calendar days. Nothing there converts a local time back to an instant, and
 * bolting this on would mix "what do we print" with "when do we wake up".
 *
 * Every function here is pure and takes its instant, so a test can pin the
 * clock without mocking one.
 */

/** The wall-clock parts of an instant, as read in `timezone`. */
export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
}

export function zonedParts(instant: Date, timezone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // `hour12: false` renders midnight as 24 in some runtimes, not 00.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** The calendar date of an instant, in a zone, as YYYY-MM-DD. */
export function zonedDate(instant: Date, timezone: string): string {
  // `en-CA` formats as YYYY-MM-DD, so nothing has to be assembled by hand —
  // the same reason `lib/timezone.ts` uses it.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * A wall-clock date and `HH:MM` in `timezone` → the UTC instant it names.
 *
 * There is no standard API for this, so it is solved by correction: guess that
 * the local time is UTC, measure how far that guess lands from the target once
 * rendered back in the zone, and subtract the difference. One correction covers
 * every real offset, including the 45-minute ones.
 *
 * Returns an invalid `Date` on unparseable input rather than throwing — callers
 * differ on what a bad value means (a configured field is a node failure; a
 * column read is a skip), so the decision stays with them.
 */
export function zonedToUtc(date: string, hhmm: string, timezone: string): Date {
  const [hh = "00", mm = "00"] = hhmm.slice(0, 5).split(":");
  const guess = new Date(
    `${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00Z`,
  );
  if (Number.isNaN(guess.getTime())) return new Date(NaN);

  const rendered = zonedParts(guess, timezone);
  const renderedUtc = Date.UTC(
    rendered.year,
    rendered.month - 1,
    rendered.day,
    rendered.hour,
    rendered.minute,
  );

  return new Date(guess.getTime() + (guess.getTime() - renderedUtc));
}

/**
 * A `YYYY-MM-DD` plus (or minus) whole calendar days, still `YYYY-MM-DD`.
 *
 * Pure calendar arithmetic on a date with no time and no zone, so it never
 * needs one — which is the point. Anything that reduces to "which day" before
 * asking "at what hour" wants this rather than `addCalendarDays`, and doing it
 * on the string keeps a DST boundary from ever entering the question.
 *
 * Built at **noon UTC** so a date can never cross into its neighbour when the
 * runtime renders it back: midnight ± any real offset is still the same day
 * twelve hours either side.
 */
export function shiftCalendarDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return date;
  const shifted = new Date(Date.UTC(y, m - 1, d + days, 12));
  return shifted.toISOString().slice(0, 10);
}

/**
 * Add whole days while keeping the wall-clock time in `timezone`.
 *
 * "Wait 3 days" means the same time of day, three days later. `+ 3 × 86400000`
 * gives that only when no clock change falls in between; across a DST boundary
 * it lands an hour out, so an automation that should reach someone at 9am
 * reaches them at 8 or 10.
 */
export function addCalendarDays(from: Date, days: number, timezone: string): Date {
  const parts = zonedParts(from, timezone);

  // Constructed in UTC purely as calendar arithmetic — a date holder, not an
  // instant — so month ends and leap years are handled by `Date` itself.
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));

  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(parts.hour).padStart(2, "0");
  const mi = String(parts.minute).padStart(2, "0");

  return zonedToUtc(`${y}-${m}-${d}`, `${hh}:${mi}`, timezone);
}
