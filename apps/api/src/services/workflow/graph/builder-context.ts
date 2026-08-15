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
  catalogItems,
  checklistTemplates,
  jobPipelineStages,
  member,
  pipelines,
  tags,
  tenants,
  user,
  workflows,
  and,
  asc,
  eq,
  isNull,
  ne,
  type getDb,
} from "@hvac-saas/database";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * How many rows a "bounded" list is allowed to be before it stops being one.
 *
 * A tenant with 400 catalog items would ship 400 rows on every node open. The
 * cap is not a correctness boundary — the picker still works — but a list that
 * silently truncates is worse than one that says so, hence `truncated` below.
 */
const BOUNDED_LIMIT = 200;

export interface BuilderContext {
  members: { id: string; name: string; email: string; image: string | null }[];
  pipelines: { id: string; name: string }[];
  /** Flat, each carrying its pipeline id — the stage picker filters client-side
   *  off the sibling `pipelineId` rather than making a second request. */
  stages: { id: string; label: string; pipelineId: string; lifecycle: string }[];
  tags: { id: string; name: string; color: string | null }[];
  checklists: { id: string; name: string; serviceType: string | null }[];
  catalogItems: { id: string; name: string; unitPrice: string | null }[];
  /** Other automations, for `workflow.run`. Excludes the one being edited —
   *  offering an automation itself as its own sub-run is a loop with a picker. */
  workflows: { id: string; name: string; isActive: boolean }[];
  /** Which of the above hit `BOUNDED_LIMIT`, so the panel can say so instead of
   *  quietly showing a prefix and letting the author conclude a row is missing. */
  truncated: string[];
}

export async function loadBuilderContext(
  db: Db,
  tenantId: string,
  /** The automation being edited, excluded from the `workflow.run` picker. */
  excludeWorkflowId?: string,
): Promise<BuilderContext> {
  // `user` has no tenant column, so membership is two hops: tenant →
  // organisation → member. Reading `user` directly and trusting the id is what
  // makes a cross-tenant assignment possible.
  const [tenant] = await db
    .select({ organizationId: tenants.organizationId })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const [
    members,
    pipelineRows,
    stageRows,
    tagRows,
    checklistRows,
    catalogRows,
    workflowRows,
  ] = await Promise.all([
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

    db
      .select({ id: tags.id, name: tags.name, color: tags.color })
      .from(tags)
      .where(eq(tags.tenantId, tenantId))
      .orderBy(asc(tags.name))
      .limit(BOUNDED_LIMIT + 1),

    db
      .select({
        id: checklistTemplates.id,
        name: checklistTemplates.name,
        serviceType: checklistTemplates.serviceType,
      })
      .from(checklistTemplates)
      .where(
        and(
          eq(checklistTemplates.tenantId, tenantId),
          // An automation must not be able to attach a template the tenant has
          // switched off — the switch is how they retire one, and a picker
          // ignoring it would quietly bring it back.
          eq(checklistTemplates.isActive, true),
        ),
      )
      .orderBy(asc(checklistTemplates.name))
      .limit(BOUNDED_LIMIT + 1),

    db
      .select({
        id: catalogItems.id,
        name: catalogItems.name,
        unitPrice: catalogItems.unitPrice,
      })
      .from(catalogItems)
      .where(
        and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.isActive, true)),
      )
      .orderBy(asc(catalogItems.name))
      .limit(BOUNDED_LIMIT + 1),

    db
      .select({
        id: workflows.id,
        name: workflows.name,
        isActive: workflows.isActive,
      })
      .from(workflows)
      .where(
        and(
          eq(workflows.tenantId, tenantId),
          isNull(workflows.archivedAt),
          // Offering an automation itself is a loop with a picker on it. The
          // engine's depth guard would catch it, but a control that can only
          // produce a caught error should not offer the option.
          excludeWorkflowId ? ne(workflows.id, excludeWorkflowId) : undefined,
        ),
      )
      .orderBy(asc(workflows.name))
      .limit(BOUNDED_LIMIT + 1),
  ]);

  const truncated: string[] = [];
  function cap<T>(rows: T[], name: string): T[] {
    if (rows.length > BOUNDED_LIMIT) {
      truncated.push(name);
      return rows.slice(0, BOUNDED_LIMIT);
    }
    return rows;
  }

  return {
    members,
    pipelines: pipelineRows,
    stages: stageRows,
    tags: cap(tagRows, "tags"),
    checklists: cap(checklistRows, "checklists"),
    catalogItems: cap(catalogRows, "catalogItems"),
    workflows: cap(workflowRows, "workflows"),
    truncated,
  };
}
