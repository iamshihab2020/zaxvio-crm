import { z } from "zod";
import { idParam, boundedText } from "./common.js";

export { idParam };

/**
 * Zod schemas for job time tracking.
 *
 * The date fields here are `datetime`, not `isoDate`. A time entry is a moment,
 * not a day — but the reason to be strict is the same one BOOK-04 established:
 * these values reach `timestamptz` columns, where Postgres accepts 'infinity'
 * and 'epoch' quite happily and produces a row that matches no window ever
 * queried. `z.string().datetime()` refuses both, and refuses a bare date, which
 * would otherwise silently mean midnight UTC.
 */
const isoDateTime = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO 8601 date-time" });

/** Money as a string, because the column is `numeric(10,2)`. */
const moneyString = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "Must be a valid amount");

/**
 * Twelve hours, matching the sweep's auto-stop ceiling.
 *
 * The two numbers have to agree: a manual entry the sweep would have refused to
 * let run is an entry the sweep would flag, and letting one in by hand while
 * closing the other automatically would make the same duration mean two
 * different things depending on how it was recorded.
 */
export const MAX_ENTRY_HOURS = 12;

// ── Params ────────────────────────────────────────────────────────────────────

export const timeEntryParams = z.object({
  id: z.string().uuid(),
  entryId: z.string().uuid(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

/**
 * Start the clock.
 *
 * There is no `startedAt`: the server stamps it. A client-supplied start would
 * let a wrong device clock — or a curious user — shift the beginning of a
 * running timer, and the one thing a stopwatch has over a text box is that
 * nobody typed the number.
 */
export const startTimerBody = z.object({
  note: boundedText(500).optional(),
});

export const stopTimerBody = z.object({
  note: boundedText(500).optional(),
});

/**
 * A manual entry, or a correction to one.
 *
 * `userId` is optional and owner/admin-only: the common case is recording your
 * own time, and the uncommon one is an owner entering it for a tech who forgot.
 * Absent means "me", which keeps the ordinary path from having to name itself.
 */
export const createTimeEntryBody = z.object({
  startedAt: isoDateTime,
  endedAt: isoDateTime,
  userId: z.string().min(1).optional(),
  note: boundedText(500).optional(),
  /**
   * Only honoured for owners and admins; a member's entry always takes the
   * resolved rate. Present at all so a correction can restate what a historic
   * hour actually cost, rather than silently repricing it at today's rate.
   */
  hourlyCostRate: moneyString.nullable().optional(),
});

export const updateTimeEntryBody = z.object({
  startedAt: isoDateTime.optional(),
  endedAt: isoDateTime.optional(),
  // Nullable so a note can be cleared, not just changed.
  note: boundedText(500).nullable().optional(),
  hourlyCostRate: moneyString.nullable().optional(),
});

/*
 * There is deliberately no list filter. `GET /jobs/:id/time-entries` returns
 * every entry on the job, because "how long did this job take" is the question
 * the tab exists to answer and it has no per-person form. A `userId` filter with
 * no control rendering it would be a declared-with-no-consumer surface, which is
 * the shape this project keeps finding as a defect.
 */
