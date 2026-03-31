import type { maintenanceContracts } from "@hvac-saas/database";

export type MaintenanceContract = typeof maintenanceContracts.$inferSelect;
export type MaintenanceContractInsert = typeof maintenanceContracts.$inferInsert;
export type MaintenanceContractUpdate = Partial<MaintenanceContractInsert>;
