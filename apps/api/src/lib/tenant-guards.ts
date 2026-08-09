/**
 * "Does this id belong to the caller's tenant?"
 *
 * Every FK that arrives in a request body needs this, and the ones that didn't
 * have it were not the obscure endpoints — they were conversations, checklists
 * and calendar events, three domains that simply never went through an audit.
 * Jobs, invoices and quotes each grew their own copy of the same helper, which
 * is how the gap survived: there was nothing to import, so each new writer of a
 * client-supplied FK either rewrote the check or skipped it.
 *
 * This module is that thing to import. `job-guards.ts` re-exports it so the
 * existing call sites keep working.
 *
 * Note the shape: `owns` returns a boolean from a tenant-scoped SELECT rather
 * than fetching the row and letting the caller decide. `if (catalogItem)` reads
 * as a check but passes when the row belongs to somebody else — the version
 * that stores the id anyway is the one that keeps getting written.
 */

import {
  getDb,
  customers,
  equipment,
  bookings,
  catalogItems,
  and,
  eq,
} from "@hvac-saas/database";

// Omit $client so a transaction handle satisfies this too — job-stages.service.ts
// typed its Db as the bare ReturnType and could not be called from inside a tx.
export type Db = Omit<ReturnType<typeof getDb>, "$client">;

type OwnableTable =
  | typeof customers
  | typeof equipment
  | typeof bookings
  | typeof catalogItems;

async function owns(
  db: Db,
  tenantId: string,
  id: string,
  table: OwnableTable,
): Promise<boolean> {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.tenantId, tenantId), eq(table.id, id)));
  return Boolean(row);
}

export const ownsCustomer = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, customers);
export const ownsEquipment = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, equipment);
export const ownsBooking = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, bookings);
export const ownsCatalogItem = (db: Db, tenantId: string, id: string) =>
  owns(db, tenantId, id, catalogItems);

/**
 * Validate every optional FK on a request in one pass. Returns the first
 * offending field name, or null when all supplied ids belong to the tenant.
 */
export async function findForeignRef(
  db: Db,
  tenantId: string,
  refs: {
    customerId?: string | null;
    equipmentId?: string | null;
    bookingId?: string | null;
    catalogItemId?: string | null;
  },
): Promise<string | null> {
  const checks: [string, Promise<boolean>][] = [];
  if (refs.customerId) checks.push(["Customer", ownsCustomer(db, tenantId, refs.customerId)]);
  if (refs.equipmentId) checks.push(["Asset", ownsEquipment(db, tenantId, refs.equipmentId)]);
  if (refs.bookingId) checks.push(["Booking", ownsBooking(db, tenantId, refs.bookingId)]);
  if (refs.catalogItemId)
    checks.push(["Catalog item", ownsCatalogItem(db, tenantId, refs.catalogItemId)]);

  const results = await Promise.all(checks.map(([, p]) => p));
  const bad = results.findIndex((ok) => !ok);
  return bad === -1 ? null : checks[bad][0];
}
