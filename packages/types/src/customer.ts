import type { customers } from "@hvac-saas/database";

export type Customer = typeof customers.$inferSelect;
export type CustomerInsert = typeof customers.$inferInsert;
export type CustomerUpdate = Partial<CustomerInsert>;
