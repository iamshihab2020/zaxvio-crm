/**
 * Ownership re-checks, at **execution** time.
 *
 * A node config's `memberId` or `pipelineId` was validated when the graph was
 * saved. That is not enough:
 *
 * - the row can be deleted between saving and running, and a run three weeks
 *   later is the normal case for a delayed workflow;
 * - an automation can be duplicated, exported, or seeded from a template into a
 *   different workspace, carrying its ids with it;
 * - there is **no row-level security underneath** (wf-00 D-16), so an id in a
 *   saved config is client-supplied data in exactly the way a request body is.
 *
 * The 2026-08-06 audit found three domains writing a client-supplied FK with no
 * tenant check. This is the same class, one layer further from the request, and
 * therefore easier to forget.
 */

import {
  catalogItems,
  checklistTemplates,
  customers,
  equipment,
  jobPipelineStages,
  jobs,
  maintenanceContracts,
  pipelines,
  tags,
  workflows,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";
import { isOrgMember } from "../../../lib/tenant-guards.js";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Every checker below is the same two-column question — does a row with this id
 * exist **in this tenant** — and each is written out rather than generated from
 * a table object.
 *
 * A generic helper taking `{ id, tenantId }` needs `as never` on all three
 * Drizzle positions to typecheck, and [[strict-rules]] §4 bans that for exactly
 * the reason it would bite here: the cast that silences the column-type
 * complaint also silences a genuine mismatch, and this is the file whose whole
 * job is refusing ids. Nine explicit copies of a two-predicate `WHERE` are worth
 * more than one clever one, provided every copy carries the tenant predicate —
 * which is what the test at the bottom of this module enumerates.
 */

/**
 * Is this user a member of the workspace's organisation?
 *
 * Two hops, because `user` has no tenant column: tenant → organisation →
 * membership. Reading `user` directly and trusting the id is what makes a
 * cross-tenant email possible.
 */
export async function assertOrgMember(
  db: Db,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  // Delegated rather than reimplemented: this was one of three copies, and
  // `lib/tenant-guards.ts` exists because a check with nothing to import gets
  // rewritten or skipped. The name stays — inside the engine, "assert" is the
  // vocabulary every other ownership helper here uses.
  return isOrgMember(db, tenantId, userId);
}

export async function assertPipeline(
  db: Db,
  tenantId: string,
  pipelineId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, pipelineId)));
  return row !== undefined;
}

export async function assertStage(
  db: Db,
  tenantId: string,
  stageId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jobPipelineStages.id })
    .from(jobPipelineStages)
    .where(
      and(
        eq(jobPipelineStages.tenantId, tenantId),
        eq(jobPipelineStages.id, stageId),
      ),
    );
  return row !== undefined;
}

export async function assertCustomer(
  db: Db,
  tenantId: string,
  customerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)));
  return row !== undefined;
}

export async function assertJob(
  db: Db,
  tenantId: string,
  jobId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)));
  return row !== undefined;
}

export async function assertCatalogItem(
  db: Db,
  tenantId: string,
  catalogItemId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: catalogItems.id })
    .from(catalogItems)
    .where(
      and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, catalogItemId)),
    );
  return row !== undefined;
}

export async function assertChecklist(
  db: Db,
  tenantId: string,
  checklistId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: checklistTemplates.id })
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.tenantId, tenantId),
        eq(checklistTemplates.id, checklistId),
      ),
    );
  return row !== undefined;
}

export async function assertEquipment(
  db: Db,
  tenantId: string,
  equipmentId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: equipment.id })
    .from(equipment)
    .where(and(eq(equipment.tenantId, tenantId), eq(equipment.id, equipmentId)));
  return row !== undefined;
}

export async function assertContract(
  db: Db,
  tenantId: string,
  contractId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: maintenanceContracts.id })
    .from(maintenanceContracts)
    .where(
      and(
        eq(maintenanceContracts.tenantId, tenantId),
        eq(maintenanceContracts.id, contractId),
      ),
    );
  return row !== undefined;
}

export async function assertTag(
  db: Db,
  tenantId: string,
  tagId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: tags.id })
    .from(tags)
    .where(and(eq(tags.tenantId, tenantId), eq(tags.id, tagId)));
  return row !== undefined;
}

/**
 * A workflow id in a config — `workflow.run` calling another automation.
 *
 * Archived is deliberately **not** excluded here. This answers "is it yours",
 * and "is it runnable" is the caller's separate question; folding them together
 * would make an archived automation report as a cross-tenant id, which is a
 * different problem with a different fix.
 */
export async function assertWorkflow(
  db: Db,
  tenantId: string,
  workflowId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: workflows.id })
    .from(workflows)
    .where(and(eq(workflows.tenantId, tenantId), eq(workflows.id, workflowId)));
  return row !== undefined;
}

/**
 * Ownership kinds that actually have a checker below.
 *
 * The two callers need opposite defaults, and conflating them is a bug in one
 * direction or the other:
 *
 * - **The engine** must fail closed. An id it cannot verify must not be used,
 *   because that is the whole point of this file.
 * - **The publish validator** must fail open. It reports problems the author is
 *   expected to fix, and "you do not own this customer" is unfixable and untrue
 *   when the real cause is that nobody has written `assertCustomer` yet.
 *
 * **All eleven kinds now have a checker**, so this set and `OWNERSHIP_KINDS` are
 * currently identical and the two defaults agree. That is worth stating rather
 * than assuming: while eight of them were missing, the engine refused every node
 * carrying a customer, job, tag or catalog picker at run time — a picker could
 * be drawn, configured, saved and published, and then fail on execution with
 * "you do not own this", which reads as a tenancy bug rather than as
 * unimplemented. The set stays as a separate declaration precisely so the next
 * kind added to `OWNERSHIP_KINDS` does not silently inherit a checker it lacks.
 *
 * Add a kind here in the same commit as its checker, never before.
 */
export const CHECKABLE_OWNERSHIP_KINDS: ReadonlySet<string> = new Set([
  "member",
  "pipeline",
  "stage",
  "customer",
  "job",
  "catalogItem",
  "checklist",
  "equipment",
  "contract",
  "tag",
  "workflow",
]);

/**
 * Dispatch by `ownership` kind, so the node executor can check a property
 * generically from its declaration rather than each executor remembering.
 *
 * Kinds with no checker yet return **false**, not true. An unchecked id is the
 * failure mode this file exists to prevent, and a permissive default would make
 * adding a new ownership kind silently unsafe — the safe direction is a node
 * that refuses until someone writes the check.
 */
export async function assertOwnership(
  db: Db,
  tenantId: string,
  kind: string,
  id: string,
): Promise<boolean> {
  switch (kind) {
    case "member":
      return assertOrgMember(db, tenantId, id);
    case "pipeline":
      return assertPipeline(db, tenantId, id);
    case "stage":
      return assertStage(db, tenantId, id);
    case "customer":
      return assertCustomer(db, tenantId, id);
    case "job":
      return assertJob(db, tenantId, id);
    case "catalogItem":
      return assertCatalogItem(db, tenantId, id);
    case "checklist":
      return assertChecklist(db, tenantId, id);
    case "equipment":
      return assertEquipment(db, tenantId, id);
    case "contract":
      return assertContract(db, tenantId, id);
    case "tag":
      return assertTag(db, tenantId, id);
    case "workflow":
      return assertWorkflow(db, tenantId, id);
    default:
      return false;
  }
}
