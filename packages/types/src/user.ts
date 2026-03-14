import type { user, member } from "@hvac-saas/database";

export type User = typeof user.$inferSelect;
export type UserInsert = typeof user.$inferInsert;
export type Member = typeof member.$inferSelect;
export type MemberInsert = typeof member.$inferInsert;
