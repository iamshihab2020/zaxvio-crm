import type { customerNotes } from "@hvac-saas/database";

export type CustomerNote = typeof customerNotes.$inferSelect;
export type CustomerNoteInsert = typeof customerNotes.$inferInsert;
