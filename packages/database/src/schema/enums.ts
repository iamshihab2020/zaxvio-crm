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

export const adminTierEnum = pgEnum("admin_tier", [
  "super_admin",
  "support",
  "billing_admin",
]);
