import { eq } from "@hvac-saas/database";

/**
 * Returns an `eq()` filter for tenant isolation.
 * Use in every tenant-scoped query's WHERE clause.
 *
 * @example
 * const results = await db
 *   .select()
 *   .from(jobs)
 *   .where(tenantFilter(jobs.tenantId, tenantId));
 */
export function tenantFilter(column: Parameters<typeof eq>[0], tenantId: string) {
  return eq(column, tenantId);
}
