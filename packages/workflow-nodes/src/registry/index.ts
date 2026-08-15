import type { NodeDefinition } from "../node-definition.js";

/**
 * The node registry.
 *
 * ⚠️ **EXPLICIT STATIC IMPORTS ONLY. NEVER a glob, `import.meta.glob`, or
 * `require.context`.** The reference implementation records an out-of-memory
 * failure during Next.js "Collecting page data" caused by exactly that, and a
 * hosted build is the worst place to discover it. A test walks this directory
 * and fails if a file here is not imported below, so the rule is enforced
 * without using the thing it forbids.
 *
 * Adding a node: create the module, add one import, add one line to the array,
 * add its id to `active-nodes.ts` once its executor exists.
 */

// ── triggers ────────────────────────────────────────────────────────────────
import triggerManual from "./triggers/manual.js";
import triggerJobCompleted from "./triggers/job-completed.js";
import triggerInvoicePaid from "./triggers/invoice-paid.js";
import triggerInvoiceOverdue from "./triggers/invoice-overdue.js";
import triggerQuoteAccepted from "./triggers/quote-accepted.js";
import triggerBookingCreated from "./triggers/booking-created.js";
import triggerCustomerCreated from "./triggers/customer-created.js";
import triggerJobCreated from "./triggers/job-created.js";
import triggerJobStageChanged from "./triggers/job-stage-changed.js";
import triggerJobAssigned from "./triggers/job-assigned.js";
import triggerQuoteSent from "./triggers/quote-sent.js";
import triggerBookingCancelled from "./triggers/booking-cancelled.js";
import triggerJobScheduled from "./triggers/job-scheduled.js";
import triggerJobCancelled from "./triggers/job-cancelled.js";
import triggerBookingRescheduled from "./triggers/booking-rescheduled.js";
import triggerCustomerTagAdded from "./triggers/customer-tag-added.js";
import triggerInvoiceSent from "./triggers/invoice-sent.js";
import triggerInvoicePaymentRecorded from "./triggers/invoice-payment-recorded.js";
import triggerQuoteDeclined from "./triggers/quote-declined.js";
import triggerQuoteExpired from "./triggers/quote-expired.js";
import triggerEquipmentCreated from "./triggers/equipment-created.js";
import triggerMessageReceived from "./triggers/message-received.js";

// ── P9 triggers ─────────────────────────────────────────────────────────────
import triggerWebhook from "./triggers/webhook.js";
import triggerScheduleDaily from "./triggers/schedule-daily.js";
import triggerScheduleWeekly from "./triggers/schedule-weekly.js";
import triggerEquipmentWarrantyExpiring from "./triggers/equipment-warranty-expiring.js";
import triggerContractExpiring from "./triggers/contract-expiring.js";
import triggerContractVisitDue from "./triggers/contract-visit-due.js";
import triggerQuoteViewed from "./triggers/quote-viewed.js";

// ── P10 integration ─────────────────────────────────────────────────────────
import httpRequest from "./integration/http-request.js";
import webhookSend from "./integration/webhook-send.js";

// ── communication ───────────────────────────────────────────────────────────
import emailSend from "./communication/email-send.js";
import notificationInternal from "./communication/notification-internal.js";

// ── crm actions ─────────────────────────────────────────────────────────────
import customerAddNote from "./actions/customer-add-note.js";
import jobMoveStage from "./actions/job-move-stage.js";
import jobAssign from "./actions/job-assign.js";

// ── logic ───────────────────────────────────────────────────────────────────
import conditionIf from "./logic/condition-if.js";
import logicMerge from "./logic/merge.js";
import splitBranch from "./logic/split-branch.js";
import goalEvent from "./logic/goal-event.js";
import delayWait from "./timing/delay-wait.js";
import logicStop from "./logic/stop.js";

// ── P7 breadth ──────────────────────────────────────────────────────────────
import customerAddTag from "./actions/customer-add-tag.js";
import customerRemoveTag from "./actions/customer-remove-tag.js";
import customerUpdate from "./actions/customer-update.js";
import jobCreate from "./actions/job-create.js";
import jobUpdate from "./actions/job-update.js";
import dataSetFields from "./data/set-fields.js";
import dataMath from "./data/math.js";
import dataFormat from "./data/format.js";
import workflowRun from "./logic/workflow-run.js";
import logicSwitch from "./logic/switch.js";
import logicGoto from "./logic/goto.js";
import logicLoop from "./logic/loop.js";

export const NODE_DEFINITIONS: NodeDefinition[] = [
  triggerManual,
  triggerJobCompleted,
  triggerInvoicePaid,
  triggerInvoiceOverdue,
  triggerQuoteAccepted,
  triggerBookingCreated,
  triggerCustomerCreated,
  triggerJobCreated,
  triggerJobStageChanged,
  triggerJobAssigned,
  triggerQuoteSent,
  triggerBookingCancelled,
  triggerJobScheduled,
  triggerJobCancelled,
  triggerBookingRescheduled,
  triggerCustomerTagAdded,
  triggerInvoiceSent,
  triggerInvoicePaymentRecorded,
  triggerQuoteDeclined,
  triggerQuoteExpired,
  triggerEquipmentCreated,
  triggerMessageReceived,
  emailSend,
  notificationInternal,
  customerAddNote,
  jobMoveStage,
  jobAssign,
  conditionIf,
  delayWait,
  logicMerge,
  splitBranch,
  goalEvent,
  logicStop,
  customerAddTag,
  customerRemoveTag,
  customerUpdate,
  jobCreate,
  jobUpdate,
  dataSetFields,
  dataMath,
  dataFormat,
  workflowRun,
  logicSwitch,
  logicGoto,
  logicLoop,
  triggerWebhook,
  triggerScheduleDaily,
  triggerScheduleWeekly,
  triggerEquipmentWarrantyExpiring,
  triggerContractExpiring,
  triggerContractVisitDue,
  triggerQuoteViewed,
  httpRequest,
  webhookSend,
];
