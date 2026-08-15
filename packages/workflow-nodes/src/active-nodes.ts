/**
 * The ship gate.
 *
 * A node definition can land — with its config form, its palette entry and its
 * documentation — before its executor exists. This list is what stops the
 * palette offering something that would fail at run time.
 *
 * Two rules make it safe:
 *   1. A test asserts every id here has both a definition AND an executor.
 *      Without that assertion the whitelist is decoration.
 *   2. A node with a `coming-soon` tag renders GREYED IN THE PALETTE rather
 *      than being hidden. It signals a roadmap and answers "does this thing
 *      even do X?" before a user goes looking for a competitor that does.
 *
 * `sms.send` is the standing example: the schema has an `sms` conversation
 * channel and every send path is a stub, so it is visible, greyed, and honest.
 */
export const ACTIVE_NODES: readonly string[] = [
  "trigger.manual",
  "trigger.job.completed",
  "trigger.invoice.paid",
  "trigger.invoice.overdue",
  "trigger.quote.accepted",
  "trigger.booking.created",
  "trigger.customer.created",
  "trigger.job.created",
  "trigger.job.stageChanged",
  "trigger.job.assigned",
  "trigger.quote.sent",
  "trigger.booking.cancelled",
  "trigger.job.scheduled",
  "trigger.job.cancelled",
  "trigger.booking.rescheduled",
  "trigger.customer.tagAdded",
  "trigger.invoice.sent",
  "trigger.invoice.paymentRecorded",
  "trigger.quote.declined",
  "trigger.quote.expired",
  "trigger.equipment.created",
  "trigger.message.received",
  "email.send",
  "notification.internal",
  "customer.addNote",
  "job.moveStage",
  "job.assign",
  "condition.if",
  "delay.wait",
  "logic.merge",
  "split.branch",
  "goal.event",
  "logic.stop",
  "customer.addTag",
  "customer.removeTag",
  "customer.update",
  "job.create",
  "job.update",
  "data.setFields",
  "data.math",
  "data.format",
  "workflow.run",
  "logic.switch",
  "logic.goto",
  "logic.loop",
  "trigger.webhook",
  "trigger.schedule.daily",
  "trigger.schedule.weekly",
  "trigger.equipment.warrantyExpiring",
  "trigger.contract.expiring",
  "trigger.contract.visitDue",
  "trigger.quote.viewed",
  "http.request",
  "webhook.send",
] as const;

export const ACTIVE_NODE_SET: ReadonlySet<string> = new Set(ACTIVE_NODES);

/**
 * Node ids that have ever shipped.
 *
 * Node ids are a permanent public API: every saved automation stores the string,
 * so removing or renaming one orphans a customer's work. This list only ever
 * grows, and a test fails the build if an entry disappears from the registry.
 *
 * Deprecating a node means tagging it `deprecated` and hiding it from the
 * palette — never deleting it.
 */
export const RELEASED_NODE_IDS: readonly string[] = [
  "trigger.manual",
  "trigger.job.completed",
  "trigger.invoice.paid",
  "trigger.invoice.overdue",
  "trigger.quote.accepted",
  "trigger.booking.created",
  "trigger.customer.created",
  "trigger.job.created",
  "trigger.job.stageChanged",
  "trigger.job.assigned",
  "trigger.quote.sent",
  "trigger.booking.cancelled",
  "trigger.job.scheduled",
  "trigger.job.cancelled",
  "trigger.booking.rescheduled",
  "trigger.customer.tagAdded",
  "trigger.invoice.sent",
  "trigger.invoice.paymentRecorded",
  "trigger.quote.declined",
  "trigger.quote.expired",
  "trigger.equipment.created",
  "trigger.message.received",
  "email.send",
  "notification.internal",
  "customer.addNote",
  "job.moveStage",
  "job.assign",
  "condition.if",
  "delay.wait",
  "logic.merge",
  "split.branch",
  "goal.event",
  "logic.stop",
  "customer.addTag",
  "customer.removeTag",
  "customer.update",
  "job.create",
  "job.update",
  "data.setFields",
  "data.math",
  "data.format",
  "workflow.run",
  "logic.switch",
  "logic.goto",
  "logic.loop",
  "trigger.webhook",
  "trigger.schedule.daily",
  "trigger.schedule.weekly",
  "trigger.equipment.warrantyExpiring",
  "trigger.contract.expiring",
  "trigger.contract.visitDue",
  "trigger.quote.viewed",
  "http.request",
  "webhook.send",
] as const;
