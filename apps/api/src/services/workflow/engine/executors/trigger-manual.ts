/**
 * `trigger.manual` — the run already started; this node just marks where.
 *
 * Trigger executors exist and do nothing on purpose. The alternative is a
 * branch in the traverser saying "if this is a trigger, skip it", and that
 * branch is where "why did my trigger not appear in the run log" comes from —
 * a node that ran is a node with a log row, and the replay view depends on it.
 */

import type { Executor } from "./types.js";

const triggerManual: Executor = async ({ ctx }) => ({
  output: {
    startedBy: ctx.trigger.event ?? "manual",
    subjectType: ctx.subject?.type ?? null,
    subjectId: ctx.subject?.id ?? null,
  },
});

export default triggerManual;
