import type {
  notifications,
  notificationReads,
  notificationChannelConfig,
  notificationDeliveries,
} from "@hvac-saas/database";

export type Notification = typeof notifications.$inferSelect;
export type NotificationInsert = typeof notifications.$inferInsert;
export type NotificationRead = typeof notificationReads.$inferSelect;
export type NotificationChannelConfig =
  typeof notificationChannelConfig.$inferSelect;
export type NotificationChannelConfigInsert =
  typeof notificationChannelConfig.$inferInsert;
export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;

/** Notification enriched with read status for the current user */
export interface NotificationWithReadStatus extends Notification {
  isRead: boolean;
}

/** Notification types matching the DB enum */
export type NotificationType = Notification["type"];

/** Channel preference defaults when no config row exists */
export const NOTIFICATION_CHANNEL_DEFAULTS: Record<
  string,
  { inApp: boolean; email: boolean; sms: boolean; voice: boolean }
> = {
  booking_received: { inApp: true, email: true, sms: false, voice: false },
  job_status_changed: { inApp: true, email: true, sms: false, voice: false },
  invoice_paid: { inApp: true, email: true, sms: false, voice: false },
  customer_created: { inApp: true, email: false, sms: false, voice: false },
  quote_accepted: { inApp: true, email: true, sms: false, voice: false },
  quote_declined: { inApp: true, email: true, sms: false, voice: false },
  invoice_overdue: { inApp: true, email: true, sms: false, voice: false },
  team_member_joined: { inApp: true, email: false, sms: false, voice: false },
};
