/**
 * `delay.wait` — pause the run, durably.
 *
 * The executor's whole job is to work out **when** and then throw `DelayPause`.
 * Everything after that already exists: `execute.ts` catches the signal,
 * serialises the context and writes `resume_at`, and the resume worker picks the
 * row up later. A pause is a database row, never a timer — a three-day wait
 * outlives every process that could hold one in memory.
 *
 * ## Days are calendar days, not 24-hour blocks
 *
 * "Wait 3 days" means the same time of day, three days later. Adding
 * `3 × 86400000` gives that only when no clock change falls in between; across a
 * DST boundary it lands an hour out, so an automation that should reach someone
 * at 9am reaches them at 8 or 10.
 *
 * Minutes and hours are the opposite: an hour is an hour, and someone asking to
 * wait two hours across the spring-forward would be surprised to wait one. So
 * the two are computed differently on purpose — small units in real time, large
 * units on the tenant's calendar. Both live in `../zoned-time.js`.
 *
 * ## And then pushed into working hours
 *
 * A relative wait says nothing about the hour it lands on, so "3 days after the
 * job" routinely comes due at 2am. `nextWorkingMoment` moves it to the next
 * moment the business is open — it **defers**, it never cancels the send.
 */

import { DelayPause, NodeFailure } from "../errors.js";
import { addCalendarDays, zonedToUtc } from "../zoned-time.js";
import { nextWorkingMoment } from "../working-hours.js";
import type { Executor } from "./types.js";

type Unit = "minutes" | "hours" | "days" | "weeks";

const MS: Record<"minutes" | "hours", number> = {
  minutes: 60_000,
  hours: 3_600_000,
};

/** Guards a typo turning a 2-day wait into a 2-year one. */
const MAX_DAYS = 365;

const delayWait: Executor = async ({ db, ctx, params, node }) => {
  const mode = params.mode === "until" ? "until" : "for";
  const now = new Date();

  let resumeAt =
    mode === "until"
      ? absolute(params, ctx.timezone, node.label)
      : relative(params, ctx.timezone, now, node.label);

  // Only for a relative wait, and only when asked for. An explicit "until 1
  // September at 6pm" is honoured as written.
  let deferral: string | null = null;
  if (mode === "for" && params.resumeDuring !== "anytime") {
    const moment = await nextWorkingMoment(db, ctx.tenantId, ctx.timezone, resumeAt);
    resumeAt = moment.at;
    deferral = moment.reason;
  }

  // Already past. Resumed immediately rather than skipped: the author asked for
  // the automation to continue *after* that moment, and it is after it.
  // Skipping the rest of the automation because a date has passed is the
  // opposite of what was asked for.
  if (resumeAt.getTime() <= now.getTime()) {
    return {
      output: { waitedUntil: resumeAt.toISOString(), skipped: true },
    };
  }

  throw new DelayPause(resumeAt, node.id, false, deferral);
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

  const at = zonedToUtc(date, time, timezone);
  if (Number.isNaN(at.getTime())) {
    throw new NodeFailure(
      `delay.wait could not read ${date} ${time}`,
      `The "${label}" step has a date that could not be read. Open it and set the date again.`,
    );
  }
  return at;
}

export default delayWait;
