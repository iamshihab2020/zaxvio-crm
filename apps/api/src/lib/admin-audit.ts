import { getDb, adminAuditLog } from "@hvac-saas/database";

export type AdminAction =
  | "impersonate_start"
  | "impersonate_end"
  | "tenant_deactivate"
  | "tenant_activate"
  | "trial_extend"
  | "subscription_override"
  | "tenant_edit"
  | "tenant_delete";

export async function logAdminAction(
  adminUserId: string,
  action: AdminAction,
  targetTenantId: string | null,
  metadata: Record<string, unknown> | null,
  ipAddress: string | null,
) {
  const db = getDb();
  await db.insert(adminAuditLog).values({
    adminUserId,
    action,
    targetTenantId,
    metadata,
    ipAddress,
  });
}
