import { jobPipelineStages } from "@hvac-saas/database";

export type PipelineStage = typeof jobPipelineStages.$inferSelect;
export type PipelineStageInsert = typeof jobPipelineStages.$inferInsert;
