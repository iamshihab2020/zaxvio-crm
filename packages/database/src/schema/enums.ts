import { pgEnum } from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
]);

export const jobPriorityEnum = pgEnum("job_priority", [
  "standard",
  "urgent",
  "emergency",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
]);

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
]);

export const serviceTypeEnum = pgEnum("service_type", [
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
]);

export const itemTypeEnum = pgEnum("item_type", [
  "labor",
  "part",
  "material",
  "service_call",
  "other",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "check",
  "credit_card",
  "bank_transfer",
  "other",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "paused",
  "past_due",
  "cancelled",
  "expired",
]);

export const referralSourceEnum = pgEnum("referral_source", [
  "organic",
  "affiliate",
  "direct",
  "referral",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "login",
  "job_created",
  "invoice_sent",
  "booking_received",
  "customer_created",
]);

export const refrigerantActionEnum = pgEnum("refrigerant_action", [
  "added",
  "recovered",
  "recycled",
]);

export const serviceFrequencyEnum = pgEnum("service_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
]);

export const adminTierEnum = pgEnum("admin_tier", [
  "super_admin",
  "support",
  "billing_admin",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "booking_received",
  "booking_cancelled",
  "job_status_changed",
  "invoice_paid",
  "customer_created",
  "quote_accepted",
  "quote_declined",
  "invoice_overdue",
  "team_member_joined",
  "message_received",
  /**
   * Raised by the `notification.internal` automation node.
   *
   * **One value, not one per node.** A tenant who mutes "automations" means all
   * of them, and `notification_channel_config` is keyed on this enum — a value
   * per node kind would mean a row per node kind per user, and a preferences
   * page nobody could read. What the notification is *about* belongs in its
   * title and metadata, not in its type.
   */
  "workflow_alert",
]);

export const notificationChannelEnum = pgEnum("notification_channel", [
  "in_app",
  "email",
  "sms",
  "voice",
]);

export const deliveryStatusEnum = pgEnum("delivery_status", [
  "pending",
  "sent",
  "delivered",
  "failed",
]);

export const photoTagEnum = pgEnum("photo_tag", ["before", "after", "general"]);

/**
 * What a job cost you outside its line items. Line items record what was
 * *billed*; these record what was *spent* — the supply-house run, the permit,
 * the sub. Deliberately coarse: a contractor entering this on a phone will not
 * pick from twenty categories.
 */
export const expenseCategoryEnum = pgEnum("expense_category", [
  "material",
  "subcontractor",
  "permit",
  "fuel",
  "equipment_rental",
  "other",
]);

// ── Workflow automation ──────────────────────────────────────────────────────

/**
 * What an automation run is *about*.
 *
 * Polymorphic on purpose. This is service management, so an automation is as
 * often about a job or an invoice as about a customer — and the system this was
 * ported from hard-coded a contact id, then needed a second nullable column the
 * moment a second subject appeared. Generalise once.
 *
 * Every one of these tables carries a `customer_id`, which is why the execution
 * context can always resolve the customer behind whatever the subject is.
 */
export const workflowSubjectTypeEnum = pgEnum("workflow_subject_type", [
  "customer",
  "job",
  "invoice",
  "quote",
  "booking",
  "equipment",
  "maintenance_contract",
]);

/**
 * `waiting` splits on `resume_at`: set means a delay, null means a goal wait.
 * `cancelled` is deliberately distinct from `failed` — a crash is a bug worth
 * notifying about, while "stop chasing this invoice, it was paid" is the
 * automation working, and the failure notification skips it for that reason.
 */
export const workflowExecutionStatusEnum = pgEnum("workflow_execution_status", [
  "running",
  "waiting",
  "completed",
  "failed",
  "cancelled",
]);

/** How a run started. Drives quota accounting and the dry-run behaviour. */
export const workflowExecutionSourceEnum = pgEnum("workflow_execution_source", [
  "event",
  "manual",
  "test",
  "webhook",
  "schedule",
  "sub",
  "replay",
]);

/**
 * `skipped` and `waiting` are written as well as the terminal states — the
 * replay view depends on it. A disabled node that leaves no row reads as a node
 * that was never reached, which is the opposite of what happened.
 */
export const nodeExecutionStatusEnum = pgEnum("node_execution_status", [
  "running",
  "completed",
  "failed",
  "waiting",
  "skipped",
]);

/**
 * Outbox row lifecycle.
 *
 * `failed` is a **dead letter**, not a transient state: it is where a row lands
 * after its retries are spent, and it stays there for 30 days so an operator
 * can actually see it. `cancelled` is for rows whose workflow was deleted
 * before they were claimed — nothing went wrong, there is just nothing to do.
 */
export const workflowEventStatusEnum = pgEnum("workflow_event_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);
