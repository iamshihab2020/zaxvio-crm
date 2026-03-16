import type { tags, customerTags } from "@hvac-saas/database";

export type Tag = typeof tags.$inferSelect;
export type TagInsert = typeof tags.$inferInsert;
export type CustomerTag = typeof customerTags.$inferSelect;
