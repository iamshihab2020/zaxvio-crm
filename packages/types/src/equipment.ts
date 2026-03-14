import type { equipment, refrigerantLogs } from "@hvac-saas/database";

export type Equipment = typeof equipment.$inferSelect;
export type EquipmentInsert = typeof equipment.$inferInsert;
export type RefrigerantLog = typeof refrigerantLogs.$inferSelect;
