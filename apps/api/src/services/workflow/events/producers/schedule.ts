/**
 * The two clock producers. P9.
 *
 * The only events in the taxonomy with **no subject at all**. A daily schedule
 * is not about a customer or a job; whatever it acts on, it finds. That is why
 * `workflow_schedule_state` exists rather than the enrolment dedup covering it —
 * enrolment is keyed on a subject, and there isn't one.
 *
 * `dedupKey` is passed here as well as claimed by the caller, and the belt and
 * braces are deliberate: the claim stops two *instances* both dispatching, and
 * the queue's unique index stops one instance enqueuing twice if a tick is
 * retried between the claim and the emit.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import { isoDateTime, type ProducerContext } from "./shared.js";

export interface ScheduleDailyArgs extends ProducerContext {
  /** The local calendar date in the automation's zone — what "today" means. */
  localDate: string;
  timezone: string;
}

export function scheduleDaily(db: EmitDb, args: ScheduleDailyArgs) {
  return emitWorkflowEvent(db, {
    type: "schedule.daily",
    tenantId: args.tenantId,
    subject: null,
    actorUserId: args.actorUserId,
    dedupKey: `schedule.daily:${args.tenantId}:${args.localDate}`,
    payload: {
      localDate: args.localDate,
      timezone: args.timezone,
      firedAt: isoDateTime(new Date()),
    },
  });
}

export interface ScheduleWeeklyArgs extends ScheduleDailyArgs {
  /** ISO-8601 — `2026-W32`. Not "week of the month", which is ambiguous. */
  isoWeek: string;
}

export function scheduleWeekly(db: EmitDb, args: ScheduleWeeklyArgs) {
  return emitWorkflowEvent(db, {
    type: "schedule.weekly",
    tenantId: args.tenantId,
    subject: null,
    actorUserId: args.actorUserId,
    dedupKey: `schedule.weekly:${args.tenantId}:${args.isoWeek}`,
    payload: {
      localDate: args.localDate,
      isoWeek: args.isoWeek,
      timezone: args.timezone,
      firedAt: isoDateTime(new Date()),
    },
  });
}
