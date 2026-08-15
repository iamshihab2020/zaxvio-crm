/**
 * `trigger.schedule.daily`.
 *
 * `localDate` is the automation's own today, resolved in its own timezone by the
 * clock that fired it. Put on the output because it is what a message means by
 * "today" — and computing it again here, from the server's clock, would give a
 * different answer for any tenant not in UTC.
 */

import type { Executor } from "./types.js";

const triggerScheduleDaily: Executor = async ({ ctx }) => ({
  output: {
    localDate: ctx.trigger.payload?.localDate ?? null,
    timezone: ctx.trigger.payload?.timezone ?? null,
  },
});

export default triggerScheduleDaily;
