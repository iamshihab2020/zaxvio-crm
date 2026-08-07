import {
  tenants,
  tenantMemberRates,
  and,
  eq,
} from "@hvac-saas/database";
import type { Db } from "../../lib/tenant-guards.js";

/**
 * Resolve the hourly cost rate to apply to a job's labour.
 *
 * Precedence: the assignee's per-member override, then the tenant default,
 * then null. Null is a real answer — "labour cost is unknown" — and callers
 * must not turn it into 0. A zero rate would report every job's labour as free,
 * which is the single most misleading thing this feature could say.
 *
 * The resolved value is *snapshotted* onto `jobs.labor_cost_rate` by the caller
 * rather than joined at read time, so raising a rate next year does not
 * retroactively change what last year's jobs cost.
 */
export async function resolveLaborCostRate(
  db: Db,
  tenantId: string,
  userId: string | null | undefined,
): Promise<string | null> {
  if (userId) {
    const [override] = await db
      .select({ rate: tenantMemberRates.hourlyCostRate })
      .from(tenantMemberRates)
      .where(
        and(
          eq(tenantMemberRates.tenantId, tenantId),
          eq(tenantMemberRates.userId, userId),
        ),
      );
    if (override?.rate) return override.rate;
  }

  const [tenant] = await db
    .select({ rate: tenants.defaultLaborCostRate })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  return tenant?.rate ?? null;
}
