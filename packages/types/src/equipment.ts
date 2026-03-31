import type { equipment, refrigerantLogs } from "@hvac-saas/database";

export type Equipment = typeof equipment.$inferSelect;
export type EquipmentInsert = typeof equipment.$inferInsert;
export type EquipmentUpdate = Partial<EquipmentInsert>;
export type RefrigerantLog = typeof refrigerantLogs.$inferSelect;
export type RefrigerantLogInsert = typeof refrigerantLogs.$inferInsert;
