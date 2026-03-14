import type { jobs, jobLineItems, jobPhotos } from "@hvac-saas/database";

export type Job = typeof jobs.$inferSelect;
export type JobInsert = typeof jobs.$inferInsert;
export type JobUpdate = Partial<JobInsert>;
export type JobLineItem = typeof jobLineItems.$inferSelect;
export type JobPhoto = typeof jobPhotos.$inferSelect;
