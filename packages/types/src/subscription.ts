import type { tenantSubscriptions } from "@hvac-saas/database";

export type TenantSubscription = typeof tenantSubscriptions.$inferSelect;
export type TenantSubscriptionInsert = typeof tenantSubscriptions.$inferInsert;
