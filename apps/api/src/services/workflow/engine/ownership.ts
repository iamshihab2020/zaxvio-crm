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
  jobPipelineStages,
  member,
  pipelines,
  tenants,
  and,
  eq,
  type getDb,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

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
  const [tenant] = await db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId));
  if (!tenant?.organizationId) return false;

  const [row] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.organizationId, tenant.organizationId),
        eq(member.userId, userId),
      ),
    );
  return row !== undefined;
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
 *   when the real cause is that nobody has written `assertCustomer` yet. Eight
 *   of the eleven kinds are in that state right now, so blocking on them would
 *   make every automation with a customer picker unpublishable.
 *
 * Exported so the validator can skip what it cannot judge, while the engine
 * keeps refusing it. Add a kind here in the same commit as its checker.
 */
export const CHECKABLE_OWNERSHIP_KINDS: ReadonlySet<string> = new Set([
  "member",
  "pipeline",
  "stage",
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
    default:
      return false;
  }
}
