import type { jobActivities } from "@hvac-saas/database";

export type JobActivity = typeof jobActivities.$inferSelect;
export type JobActivityInsert = typeof jobActivities.$inferInsert;
