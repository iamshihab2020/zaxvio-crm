import type {
  adminAuditLog,
  adminImpersonationSessions,
  platformEvents,
} from "@hvac-saas/database";

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type AdminImpersonationSession =
  typeof adminImpersonationSessions.$inferSelect;
export type PlatformEvent = typeof platformEvents.$inferSelect;
