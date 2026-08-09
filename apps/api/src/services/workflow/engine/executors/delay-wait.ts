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
 *
 * ## `untilField` reads the variable raw, not interpolated
 *
 * The date to count from is named by its **path** — `booking.date` — and
 * resolved here through `VARIABLE_MAP`. It is deliberately not a text field
 * holding `{{booking.date}}`: interpolation renders variables for people, so
 * that token resolves to "Aug 12, 2026", and reading a date back out of a
 * localised display string is exactly the "guess the format from the value's
 * shape" mistake `interpolate.ts` refuses to make. A path carries no braces, so
 * the interpolator passes it through untouched and the raw value is still a
 * value when it arrives.
 *
 * This is not a node re-resolving its own parameters. The field's content *is*
 * a reference, the same way `stageId` is — `params.dateField` arrives fully
 * interpolated and happens to name a variable.
 */

import { VARIABLE_MAP, type ExecutionContext } from "@hvac-saas/workflow-nodes";
import { DelayPause, NodeFailure, WorkflowStopped } from "../errors.js";
import { addCalendarDays, shiftCalendarDate, zonedDate, zonedToUtc } from "../zoned-time.js";
import { nextWorkingMoment } from "../working-hours.js";
import type { Executor, ExecutorOutput } from "./types.js";

type Unit = "minutes" | "hours" | "days" | "weeks";

const MS: Record<"minutes" | "hours", number> = {
  minutes: 60_000,
  hours: 3_600_000,
};

/** Guards a typo turning a 2-day wait into a 2-year one. */
const MAX_DAYS = 365;

const MODES = ["for", "until", "untilField"] as const;
type Mode = (typeof MODES)[number];

const delayWait: Executor = async ({ db, ctx, params, node }) => {
  const requested = typeof params.mode === "string" ? params.mode : "for";
  const mode: Mode = MODES.includes(requested as Mode) ? (requested as Mode) : "for";
  const now = new Date();

  // `untilField` can decide there is nothing to wait for at all — a booking
  // with no date, or a moment that has already gone — so it returns rather than
  // producing an instant like the other two.
  if (mode === "untilField") {
    const outcome = fromRecordDate(params, ctx, now, node.label);
    if (outcome.kind === "stop") throw new WorkflowStopped("cancelled", outcome.reason);
    if (outcome.kind === "now") return outcome.result;
    throw new DelayPause(outcome.at, node.id, false, outcome.note);
  }

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

type RecordWait =
  | { kind: "pause"; at: Date; note: string | null }
  | { kind: "now"; result: ExecutorOutput }
  | { kind: "stop"; reason: string };

/**
 * A date carried by the record, shifted by an offset and pinned to an hour.
 *
 * Every anchor is reduced to a **calendar day** and then given `atTime`, even
 * one that arrives as a full timestamp. That is a deliberate flattening: it is
 * one rule with no branches, it matches how the wait is described out loud
 * ("the morning before"), and it means the author cannot be surprised by a
 * reminder landing at 03:47 because that is when the row happened to be
 * written. An offset measured from a real timestamp is what `mode: "for"` is.
 */
function fromRecordDate(
  params: Record<string, unknown>,
  ctx: ExecutionContext,
  now: Date,
  label: string,
): RecordWait {
  const path = typeof params.dateField === "string" ? params.dateField.trim() : "";
  const variable = VARIABLE_MAP.get(path);

  // A path that is not a declared variable is a broken config, not a missing
  // value — it fails loudly rather than quietly waiting forever.
  if (!variable) {
    throw new NodeFailure(
      `delay.wait names an unknown date variable: ${path || "(empty)"}`,
      `The "${label}" step is set to wait for a date called "${path}", which is not something this automation can read. Open the step and pick the date again.`,
    );
  }

  const anchorDay = toCalendarDay(variable.resolve(ctx), ctx.timezone);

  // The record simply has no such date — a booking taken with no date, an
  // invoice with no due date. Not a failure: there is nothing to count back
  // from, and a failure notification here would fire for ordinary data.
  if (!anchorDay) {
    return {
      kind: "stop",
      reason: `Stopped at "${label}": this record has no ${variable.label.toLowerCase()}, so there was no date to wait for.`,
    };
  }

  const direction =
    params.offsetDirection === "on"
      ? "on"
      : params.offsetDirection === "after"
        ? "after"
        : "before";

  const raw = (params.offset ?? {}) as { amount?: unknown; unit?: unknown };
  const amount =
    direction === "on"
      ? 0
      : typeof raw.amount === "number"
        ? raw.amount
        : Number(raw.amount);
  const unit = (typeof raw.unit === "string" ? raw.unit : "days") as Unit;

  if (!Number.isFinite(amount) || amount < 0) {
    throw new NodeFailure(
      `delay.wait has no usable offset: ${JSON.stringify(raw)}`,
      `The "${label}" step does not say how far before or after ${variable.label.toLowerCase()} to wait.`,
    );
  }

  const time = typeof params.atTime === "string" ? params.atTime : "09:00";
  const sign = direction === "before" ? -1 : 1;

  // Day-sized units move the calendar day and keep the hour exactly; hours move
  // the instant. Same split as a relative wait, same reason — see the header.
  const days = unit === "weeks" ? amount * 7 : unit === "days" ? amount : 0;
  const targetDay = shiftCalendarDate(anchorDay, sign * days);

  let at = zonedToUtc(targetDay, time, ctx.timezone);
  if (Number.isNaN(at.getTime())) {
    throw new NodeFailure(
      `delay.wait could not read ${targetDay} ${time}`,
      `The "${label}" step has a time that could not be read. Open it and set the time again.`,
    );
  }
  if (unit === "hours" && amount > 0) {
    at = new Date(at.getTime() + sign * amount * MS.hours);
  }

  // Data-driven, so this is not a typo guard like MAX_DAYS — it is a bound on
  // how long one run may hold a row open. A booking two years out is real; a
  // run parked on it for two years is not something to do silently.
  const horizonMs = MAX_DAYS * 86_400_000;
  if (at.getTime() - now.getTime() > horizonMs) {
    throw new NodeFailure(
      `delay.wait would pause for more than ${MAX_DAYS} days`,
      `The "${label}" step would wait until ${zonedDate(at, ctx.timezone)}, which is more than a year away. Automations cannot hold a run open that long — trigger this closer to the date instead.`,
    );
  }

  if (at.getTime() > now.getTime()) return { kind: "pause", at, note: null };

  // The moment has gone. Which of the two answers is right is genuinely the
  // author's call, so it is a field rather than a rule — see the definition.
  if (params.ifPassed === "resume") {
    return {
      kind: "now",
      result: {
        output: {
          waitedUntil: at.toISOString(),
          skipped: true,
          reason: "That moment had already passed, so this carried straight on.",
        },
      },
    };
  }

  return {
    kind: "stop",
    reason: `Stopped at "${label}": ${describeMissedMoment(variable.label, direction, amount, unit)} was ${zonedDate(at, ctx.timezone)}, which had already passed by the time this ran.`,
  };
}

/** "1 day before Booking date", for the run log. */
function describeMissedMoment(
  variableLabel: string,
  direction: "before" | "on" | "after",
  amount: number,
  unit: Unit,
): string {
  const subject = variableLabel.toLowerCase();
  if (direction === "on") return `the wait until ${subject}`;
  const plural = amount === 1 ? unit.replace(/s$/, "") : unit;
  return `${amount} ${plural} ${direction} ${subject}`;
}

/**
 * Any shape a date variable can resolve to → `YYYY-MM-DD` in the tenant's zone.
 *
 * Postgres `date` columns arrive from Drizzle as `YYYY-MM-DD` strings and
 * `timestamptz` as `Date`s, so both are ordinary here. The date string is taken
 * **as written** rather than parsed into an instant first: `new Date("2026-08-12")`
 * is midnight UTC, which is 7pm the previous day in Chicago, and reading the
 * calendar day back out would move an appointment reminder to the wrong day.
 */
function toCalendarDay(value: unknown, timezone: string): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : zonedDate(value, timezone);
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const dateOnly = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  if (!dateOnly) return null;

  // A bare date is already the day it names, in whatever zone it was meant.
  if (trimmed.length === 10) return dateOnly[1];

  // A full timestamp names an instant, so which day it is depends on where you
  // are standing — read it in the tenant's zone.
  const instant = new Date(trimmed);
  return Number.isNaN(instant.getTime()) ? dateOnly[1] : zonedDate(instant, timezone);
}

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
