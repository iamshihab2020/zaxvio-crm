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
import triggerJobScheduled from "./trigger-job-scheduled.js";
import triggerJobCancelled from "./trigger-job-cancelled.js";
import triggerBookingRescheduled from "./trigger-booking-rescheduled.js";
import triggerCustomerTagAdded from "./trigger-customer-tag-added.js";
import triggerInvoiceSent from "./trigger-invoice-sent.js";
import triggerInvoicePaymentRecorded from "./trigger-invoice-payment-recorded.js";
import triggerQuoteDeclined from "./trigger-quote-declined.js";
import triggerQuoteExpired from "./trigger-quote-expired.js";
import triggerEquipmentCreated from "./trigger-equipment-created.js";
import triggerMessageReceived from "./trigger-message-received.js";
import triggerWebhook from "./trigger-webhook.js";
import triggerScheduleDaily from "./trigger-schedule-daily.js";
import triggerScheduleWeekly from "./trigger-schedule-weekly.js";
import triggerEquipmentWarrantyExpiring from "./trigger-equipment-warranty-expiring.js";
import triggerContractExpiring from "./trigger-contract-expiring.js";
import triggerContractVisitDue from "./trigger-contract-visit-due.js";
import triggerQuoteViewed from "./trigger-quote-viewed.js";
import httpRequest from "./http-request.js";
import webhookSend from "./webhook-send.js";
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
import customerUpdate from "./customer-update.js";
import jobCreate from "./job-create.js";
import jobUpdate from "./job-update.js";
import workflowRun from "./workflow-run.js";
import logicSwitch from "./logic-switch.js";
import logicGoto from "./logic-goto.js";
import logicLoop from "./logic-loop.js";
import customerAddTag from "./customer-add-tag.js";
import customerRemoveTag from "./customer-remove-tag.js";
import dataSetFields from "./data-set-fields.js";
import dataMath from "./data-math.js";
import dataFormat from "./data-format.js";

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
  "trigger.job.scheduled": triggerJobScheduled,
  "trigger.job.cancelled": triggerJobCancelled,
  "trigger.booking.rescheduled": triggerBookingRescheduled,
  "trigger.customer.tagAdded": triggerCustomerTagAdded,
  "trigger.invoice.sent": triggerInvoiceSent,
  "trigger.invoice.paymentRecorded": triggerInvoicePaymentRecorded,
  "trigger.quote.declined": triggerQuoteDeclined,
  "trigger.quote.expired": triggerQuoteExpired,
  "trigger.equipment.created": triggerEquipmentCreated,
  "trigger.message.received": triggerMessageReceived,
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
  "customer.addTag": customerAddTag,
  "customer.removeTag": customerRemoveTag,
  "customer.update": customerUpdate,
  "job.create": jobCreate,
  "job.update": jobUpdate,
  "data.setFields": dataSetFields,
  "data.math": dataMath,
  "data.format": dataFormat,
  "workflow.run": workflowRun,
  "logic.switch": logicSwitch,
  "logic.goto": logicGoto,
  "logic.loop": logicLoop,
  "trigger.webhook": triggerWebhook,
  "trigger.schedule.daily": triggerScheduleDaily,
  "trigger.schedule.weekly": triggerScheduleWeekly,
  "trigger.equipment.warrantyExpiring": triggerEquipmentWarrantyExpiring,
  "trigger.contract.expiring": triggerContractExpiring,
  "trigger.contract.visitDue": triggerContractVisitDue,
  "trigger.quote.viewed": triggerQuoteViewed,
  "http.request": httpRequest,
  "webhook.send": webhookSend,
};

export function getExecutor(nodeType: string): Executor | undefined {
  return EXECUTORS[nodeType];
}

export * from "./types.js";
