/**
 * `trigger.schedule.weekly`.
 *
 * `isoWeek` — `2026-W32` — rather than "week of the month", which is ambiguous
 * at both ends of a month and disagrees between calendars. It is also the dedup
 * key's period component, so what the automation reads and what stopped it
 * running twice are the same string.
 */

import type { Executor } from "./types.js";

const triggerScheduleWeekly: Executor = async ({ ctx }) => ({
  output: {
    localDate: ctx.trigger.payload?.localDate ?? null,
    isoWeek: ctx.trigger.payload?.isoWeek ?? null,
    timezone: ctx.trigger.payload?.timezone ?? null,
  },
});

export default triggerScheduleWeekly;
