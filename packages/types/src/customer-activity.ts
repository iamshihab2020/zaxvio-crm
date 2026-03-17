import type { customerActivities } from "@hvac-saas/database";

export type CustomerActivity = typeof customerActivities.$inferSelect;
export type CustomerActivityInsert = typeof customerActivities.$inferInsert;
