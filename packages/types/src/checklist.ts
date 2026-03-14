import type {
  checklistTemplates,
  checklistItems,
  jobChecklistCompletions,
} from "@hvac-saas/database";

export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type JobChecklistCompletion =
  typeof jobChecklistCompletions.$inferSelect;
