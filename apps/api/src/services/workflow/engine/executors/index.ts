/**
 * Every executor, keyed by node id.
 *
 * Explicit static imports, like the definition registry — never a glob. A test
 * asserts that every id in `ACTIVE_NODES` has both a definition and an entry
 * here, which is what stops the palette offering a node that would fail the
 * moment somebody ran it.
 */

import type { Executor } from "./types.js";

import triggerManual from "./trigger-manual.js";
import triggerJobCompleted from "./trigger-job-completed.js";
import triggerInvoicePaid from "./trigger-invoice-paid.js";
import triggerInvoiceOverdue from "./trigger-invoice-overdue.js";
import triggerQuoteAccepted from "./trigger-quote-accepted.js";
import triggerBookingCreated from "./trigger-booking-created.js";
import triggerCustomerCreated from "./trigger-customer-created.js";
import triggerJobCreated from "./trigger-job-created.js";
import triggerJobStageChanged from "./trigger-job-stage-changed.js";
import triggerJobAssigned from "./trigger-job-assigned.js";
import triggerQuoteSent from "./trigger-quote-sent.js";
import triggerBookingCancelled from "./trigger-booking-cancelled.js";
import emailSend from "./email-send.js";
import notificationInternal from "./notification-internal.js";
import customerAddNote from "./customer-add-note.js";
import jobMoveStage from "./job-move-stage.js";
import jobAssign from "./job-assign.js";
import conditionIf from "./condition-if.js";
import logicMerge from "./logic-merge.js";
import splitBranch from "./split-branch.js";
import goalEvent from "./goal-event.js";
import delayWait from "./delay-wait.js";
import logicStop from "./logic-stop.js";

export const EXECUTORS: Readonly<Record<string, Executor>> = {
  "trigger.manual": triggerManual,
  "trigger.job.completed": triggerJobCompleted,
  "trigger.invoice.paid": triggerInvoicePaid,
  "trigger.invoice.overdue": triggerInvoiceOverdue,
  "trigger.quote.accepted": triggerQuoteAccepted,
  "trigger.booking.created": triggerBookingCreated,
  "trigger.customer.created": triggerCustomerCreated,
  "trigger.job.created": triggerJobCreated,
  "trigger.job.stageChanged": triggerJobStageChanged,
  "trigger.job.assigned": triggerJobAssigned,
  "trigger.quote.sent": triggerQuoteSent,
  "trigger.booking.cancelled": triggerBookingCancelled,
  "email.send": emailSend,
  "notification.internal": notificationInternal,
  "customer.addNote": customerAddNote,
  "job.moveStage": jobMoveStage,
  "job.assign": jobAssign,
  "condition.if": conditionIf,
  "logic.merge": logicMerge,
  "split.branch": splitBranch,
  "goal.event": goalEvent,
  "delay.wait": delayWait,
  "logic.stop": logicStop,
};

export function getExecutor(nodeType: string): Executor | undefined {
  return EXECUTORS[nodeType];
}

export * from "./types.js";
