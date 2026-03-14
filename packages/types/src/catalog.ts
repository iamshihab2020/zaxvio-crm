import type { catalogItems } from "@hvac-saas/database";

export type CatalogItem = typeof catalogItems.$inferSelect;
export type CatalogItemInsert = typeof catalogItems.$inferInsert;
export type CatalogItemUpdate = Partial<CatalogItemInsert>;
