/**
 * Preconditions every mutating job handler shares.
 *
 * These were written out by hand at each call site, which is why they covered
 * **4 of 14** mutating handlers. The gaps were not random: you could not *add* a
 * line item to an archived job, but you could edit or delete one — and both of
 * those recalculate the job's totals, so the money on an archived job was
 * editable through the two verbs nobody guarded. Toggling a checklist item can
 * auto-add a line item, which routed around the one guard that did exist.
 *
 * A guard that must be remembered is a guard that will be forgotten. Two lines
 * at the top of a handler, one import, no way to half-apply it.
 */

import {
  getDb,
  jobs,
  customers,
  equipment,
  bookings,
  catalogItems,
  and,
  eq,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface GuardedJob {
  id: string;
  tenantId: string;
  status: string;
  stageId: string | null;
  pipelineId: string | null;
  customerId: string;
  archivedAt: Date | null;
}

export type JobGuard =
  | { ok: true; job: GuardedJob }
  | { ok: false; status: 404 | 400; message: string };

/**
 * Load a job for mutation: it must exist, belong to this tenant, and not be
 * archived. Archiving is the product's "safe" way to put a job aside, so
 * anything that changes it afterwards is a surprise the user did not ask for.
 *
 * Usage:
 *   const guard = await loadEditableJob(db, tenantId, id);
 *   if (!guard.ok) return reply.status(guard.status).send({ message: guard.message });
 */
export async function loadEditableJob(
  db: Db,
  tenantId: string,
  jobId: string,
): Promise<JobGuard> {
  const [job] = await db
    .select({
      id: jobs.id,
      tenantId: jobs.tenantId,
      status: jobs.status,
      stageId: jobs.stageId,
      pipelineId: jobs.pipelineId,
      customerId: jobs.customerId,
      archivedAt: jobs.archivedAt,
    })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));

  const gate = assertEditable(job);
  return gate ?? { ok: true, job };
}

/**
 * The same rule for handlers that have already fetched the whole row and need
 * every column. Returns the refusal, or null when the job may be modified —
 * so the message and the status code exist in exactly one place.
 */
export function assertEditable(
  job: { archivedAt: Date | null } | undefined,
): { ok: false; status: 404 | 400; message: string } | null {
  if (!job) return { ok: false, status: 404, message: "Job not found" };
  if (job.archivedAt) {
    return {
      ok: false,
      status: 400,
      message: "Cannot modify an archived job. Restore it first.",
    };
  }
  return null;
}

/**
 * Tenant-ownership checks for the foreign keys a request supplies.
 *
 * Four FKs were written straight from the request body with no check —
 * `bookingId`, `equipmentId`, `catalogItemId` and a document's `customerId`.
 * Not a read leak, since every later query filters by its own `tenantId`, but a
 * row pointing at another tenant's record could be *written*, which is an
 * integrity hole and a support ticket nobody can explain. `POST /line-items`
 * was the clearest: `if (catalogItem)` fell through when the item belonged to
 * someone else and stored the id anyway.
 */
async function owns(
  db: Db,
  tenantId: string,
  id: string,
  table: typeof customers | typeof equipment | typeof bookings | typeof catalogItems,
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
