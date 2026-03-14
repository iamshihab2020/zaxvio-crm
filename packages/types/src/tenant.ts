import type { tenants } from "@hvac-saas/database";

export type Tenant = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;
export type TenantUpdate = Partial<TenantInsert>;
