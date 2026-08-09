/**
 * Everything the builder's pickers need, in **one** request.
 *
 * A config panel with a member picker, a pipeline picker and a stage picker
 * would otherwise fire three server actions the moment a node is selected — and
 * five by P7, sequentially, because each one is its own hook. The reference
 * implementation does exactly that and its own audit names it as the thing that
 * makes opening a node feel slow.
 *
 * Small, bounded lists only. Anything that can grow without limit — customers,
 * jobs, invoices — is a searchable picker with its own endpoint, not a payload
 * shipped on open.
 */

import {
  jobPipelineStages,
  member,
  pipelines,
  tenants,
  user,
  and,
  asc,
  eq,
  type getDb,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

export interface BuilderContext {
  members: { id: string; name: string; email: string; image: string | null }[];
  pipelines: { id: string; name: string }[];
  /** Flat, each carrying its pipeline id — the stage picker filters client-side
   *  off the sibling `pipelineId` rather than making a second request. */
  stages: { id: string; label: string; pipelineId: string; lifecycle: string }[];
}

export async function loadBuilderContext(
  db: Db,
  tenantId: string,
): Promise<BuilderContext> {
  // `user` has no tenant column, so membership is two hops: tenant →
  // organisation → member. Reading `user` directly and trusting the id is what
  // makes a cross-tenant assignment possible.
  const [tenant] = await db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const [members, pipelineRows, stageRows] = await Promise.all([
    tenant?.organizationId
      ? db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(eq(member.organizationId, tenant.organizationId))
          .orderBy(asc(user.name))
      : Promise.resolve([]),

    db
      .select({ id: pipelines.id, name: pipelines.name })
      .from(pipelines)
      .where(eq(pipelines.tenantId, tenantId))
      .orderBy(asc(pipelines.name)),

    db
      .select({
        id: jobPipelineStages.id,
        // `label` is what a person calls the stage; `name` is its slug. A
        // picker showing the slug is a picker showing the wrong column.
        label: jobPipelineStages.label,
        pipelineId: jobPipelineStages.pipelineId,
        lifecycle: jobPipelineStages.lifecycle,
      })
      .from(jobPipelineStages)
      .where(eq(jobPipelineStages.tenantId, tenantId))
      .orderBy(asc(jobPipelineStages.sortOrder)),
  ]);

  return { members, pipelines: pipelineRows, stages: stageRows };
}
