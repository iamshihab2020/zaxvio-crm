import { pipelines } from "@hvac-saas/database";

export type Pipeline = typeof pipelines.$inferSelect;
export type PipelineInsert = typeof pipelines.$inferInsert;
