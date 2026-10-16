/**
 * The two clock producers. P9.
 *
 * The only events in the taxonomy with **no subject at all**. A daily schedule
 * is not about a customer or a job; whatever it acts on, it finds. That is why
 * `workflow_schedule_state` exists rather than the enrolment dedup covering it —
 * enrolment is keyed on a subject, and there isn't one.
 *
 * They are also the only events **addressed to one trigger step** rather than
 * broadcast. The clock decides "it is 09:00 for this step of this automation",
 * so the event says which step, and the matcher delivers it there and nowhere
 * else — see `scheduleTarget` in `events/system.ts` for the defect that made
 * this necessary (ONB-06).
 *
 * `dedupKey` is passed here as well as claimed by the caller, and the belt and
 * braces are deliberate: the claim stops two *instances* both dispatching, and
 * the queue's unique index stops one instance enqueuing twice if a tick is
 * retried between the claim and the emit. It is keyed on the **step**, never on
 * the tenant — a per-tenant key let the first automation to fire each day
 * silently swallow every other one's event.
 */

import { emitWorkflowEvent, type EmitDb } from "../emit.js";
import { isoDateTime, type ProducerContext } from "./shared.js";

export interface ScheduleDailyArgs extends ProducerContext {
  /** The automation whose trigger step this alarm belongs to. */
  workflowId: string;
  /** The trigger step itself — an automation may have more than one. */
  triggerNodeId: string;
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
    dedupKey: `schedule.daily:${args.workflowId}:${args.triggerNodeId}:${args.localDate}`,
    payload: {
      workflowId: args.workflowId,
      triggerNodeId: args.triggerNodeId,
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
    dedupKey: `schedule.weekly:${args.workflowId}:${args.triggerNodeId}:${args.isoWeek}`,
    payload: {
      workflowId: args.workflowId,
      triggerNodeId: args.triggerNodeId,
      localDate: args.localDate,
      isoWeek: args.isoWeek,
      timezone: args.timezone,
      firedAt: isoDateTime(new Date()),
    },
  });
}
