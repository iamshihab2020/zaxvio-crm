// Enum values as const arrays — usable at runtime for validation, dropdowns, etc.
// These mirror the pgEnum definitions in @hvac-saas/database

export const JOB_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ["standard", "urgent", "emergency"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "partially_paid",
  "overdue",
  "void",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const SERVICE_TYPES = [
  "installation",
  "repair",
  "maintenance",
  "inspection",
  "emergency",
  "consultation",
  "other",
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const ITEM_TYPES = [
  "labor",
  "part",
  "material",
  "service_call",
  "other",
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const PAYMENT_METHODS = [
  "cash",
  "check",
  "credit_card",
  "bank_transfer",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "paused",
  "past_due",
  "cancelled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const REFERRAL_SOURCES = [
  "organic",
  "affiliate",
  "direct",
  "referral",
] as const;
export type ReferralSource = (typeof REFERRAL_SOURCES)[number];

export const EVENT_TYPES = [
  "login",
  "job_created",
  "invoice_sent",
  "booking_received",
  "customer_created",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const REFRIGERANT_ACTIONS = [
  "added",
  "recovered",
  "recycled",
] as const;
export type RefrigerantAction = (typeof REFRIGERANT_ACTIONS)[number];
