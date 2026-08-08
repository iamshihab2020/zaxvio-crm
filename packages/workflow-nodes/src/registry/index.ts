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

// ── communication ───────────────────────────────────────────────────────────
import emailSend from "./communication/email-send.js";
import notificationInternal from "./communication/notification-internal.js";

// ── crm actions ─────────────────────────────────────────────────────────────
import customerAddNote from "./actions/customer-add-note.js";

// ── logic ───────────────────────────────────────────────────────────────────
import logicStop from "./logic/stop.js";

export const NODE_DEFINITIONS: NodeDefinition[] = [
  triggerManual,
  triggerJobCompleted,
  triggerInvoicePaid,
  triggerInvoiceOverdue,
  triggerQuoteAccepted,
  triggerBookingCreated,
  triggerCustomerCreated,
  emailSend,
  notificationInternal,
  customerAddNote,
  logicStop,
];
