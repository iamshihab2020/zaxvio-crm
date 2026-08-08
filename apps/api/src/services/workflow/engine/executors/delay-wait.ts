/**
 * `delay.wait` — pause the run, durably.
 *
 * The executor's whole job is to work out **when** and then throw `DelayPause`.
 * Everything after that already exists: `execute.ts` catches the signal,
 * serialises the context and writes `resume_at`, and the resume worker picks
 * the row up later. A pause is a database row, never a timer — a three-day wait
 * outlives every process that could hold one in memory.
 *
 * ## Days are calendar days, not 24-hour blocks
 *
 * "Wait 3 days" means the same time of day, three days later. Adding
 * `3 × 86400000` gives that only when no clock change falls in between; across
 * a DST boundary it lands an hour out, so an automation that should reach
 * someone at 9am reaches them at 8 or 10.
 *
 * Minutes and hours are the opposite: an hour is an hour, and a user asking to
 * wait two hours across the spring-forward would be surprised to wait one. So
 * the two are computed differently on purpose — small units in real time, large
 * units on the tenant's calendar.
 */

import { DelayPause, NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

type Unit = "minutes" | "hours" | "days" | "weeks";

const MS: Record<"minutes" | "hours", number> = {
  minutes: 60_000,
  hours: 3_600_000,
};

/** Guards a typo turning a 2-day wait into a 2-year one. */
const MAX_DAYS = 365;

const delayWait: Executor = async ({ ctx, params, node }) => {
  const mode = params.mode === "until" ? "until" : "for";
  const now = new Date();

  const resumeAt =
    mode === "until"
      ? absolute(params, ctx.timezone, node.label)
      : relative(params, ctx.timezone, now, node.label);

  // Already past. Resumed immediately rather than skipped: the author asked for
  // the automation to continue *after* that moment, and it is after it.
  // Skipping the rest of the automation because a date has passed is the
  // opposite of what was asked for.
  if (resumeAt.getTime() <= now.getTime()) {
    return { output: { waitedUntil: resumeAt.toISOString(), skipped: true } };
  }

  throw new DelayPause(resumeAt, node.id);
};

/** now + n units, on the tenant's calendar for days and weeks. */
function relative(
  params: Record<string, unknown>,
  timezone: string,
  now: Date,
  label: string,
): Date {
  const raw = (params.duration ?? {}) as { amount?: unknown; unit?: unknown };
  const amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
  const unit = (typeof raw.unit === "string" ? raw.unit : "days") as Unit;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new NodeFailure(
      `delay.wait has no usable duration: ${JSON.stringify(raw)}`,
      `The "${label}" step has no length of time set, so the automation had no idea how long to wait.`,
    );
  }

  const days = unit === "weeks" ? amount * 7 : unit === "days" ? amount : 0;
  if (days > MAX_DAYS) {
    throw new NodeFailure(
      `delay.wait exceeds ${MAX_DAYS} days`,
      `The "${label}" step waits longer than a year, which is almost always a typo. Shorten it, or split the automation.`,
    );
  }

  if (unit === "minutes" || unit === "hours") {
    return new Date(now.getTime() + amount * MS[unit]);
  }

  return addCalendarDays(now, days, timezone);
}

/** A date and time the author fixed, read in the tenant's zone. */
function absolute(
  params: Record<string, unknown>,
  timezone: string,
  label: string,
): Date {
  const date = typeof params.untilDate === "string" ? params.untilDate : "";
  const time = typeof params.untilTime === "string" ? params.untilTime : "09:00";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new NodeFailure(
      `delay.wait has no usable date: ${date}`,
      `The "${label}" step has no date set, so the automation had nothing to wait for.`,
    );
  }

  return zonedToUtc(date, time, timezone);
}

/**
 * Add whole days while keeping the wall-clock time in `timezone`.
 *
 * Read the current local date and time in the tenant's zone, move the calendar
 * date, then convert back. That keeps 9am at 9am across a clock change, which
 * `+n × 86400000` does not.
 */
function addCalendarDays(from: Date, days: number, timezone: string): Date {
  const parts = zonedParts(from, timezone);

  // Constructed in UTC purely as calendar arithmetic — this is a date holder,
  // not an instant, so month-end and leap years are handled by `Date` itself.
  const shifted = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day + days),
  );

  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");

  return zonedToUtc(
    `${y}-${m}-${d}`,
    `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`,
    timezone,
  );
}

/** The wall-clock parts of an instant, in a given zone. */
function zonedParts(instant: Date, timezone: string) {
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
    // `en-CA` renders midnight as 24 rather than 00 in some runtimes.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/**
 * A wall-clock date and time in `timezone` → the UTC instant it names.
 *
 * There is no standard API for this, so it is solved by correction: guess that
 * the local time is UTC, measure how far that guess lands from the target once
 * rendered back in the zone, and subtract the difference. One correction is
 * enough for every real offset, including the 45-minute ones.
 */
function zonedToUtc(date: string, time: string, timezone: string): Date {
  const [hh = "9", mm = "0"] = time.split(":");
  const guess = new Date(`${date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00Z`);

  if (Number.isNaN(guess.getTime())) {
    throw new NodeFailure(
      `delay.wait could not read ${date} ${time}`,
      "That date could not be read. Open the step and set it again.",
    );
  }

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

export default delayWait;
