import { eq } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

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
export function tenantFilter(column: PgColumn, tenantId: string) {
  return eq(column, tenantId);
}
