import type { users } from "@hvac-saas/database";

export type User = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
