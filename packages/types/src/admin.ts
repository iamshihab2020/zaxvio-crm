import type {
  adminUsers,
  adminAuditLog,
  adminImpersonationSessions,
  platformEvents,
} from "@hvac-saas/database";

export type AdminUser = typeof adminUsers.$inferSelect;
export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type AdminImpersonationSession =
  typeof adminImpersonationSessions.$inferSelect;
export type PlatformEvent = typeof platformEvents.$inferSelect;
