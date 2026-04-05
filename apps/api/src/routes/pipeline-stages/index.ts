import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  pipelines,
  jobPipelineStages,
  jobs,
  eq,
  and,
  asc,
  count,
  sql,
} from "@hvac-saas/database";
import {
  idParam,
  pipelineStagesQuery,
  createPipelineStageBody,
  reorderPipelineStagesBody,
  updatePipelineStageBody,
} from "../../lib/schemas/pipelines.js";

const DEFAULT_STAGES = [
  { name: "scheduled", label: "Scheduled", color: "blue", sortOrder: 0, isDefault: true },
  { name: "in_progress", label: "In Progress", color: "brand", sortOrder: 1, isDefault: true },
  { name: "completed", label: "Completed", color: "green", sortOrder: 2, isDefault: true },
  { name: "cancelled", label: "Cancelled", color: "gray", sortOrder: 3, isDefault: true },
] as const;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Get the tenant's default pipeline, creating one if none exists.
 */
async function getOrCreateDefaultPipeline(db: ReturnType<typeof getDb>, tenantId: string) {
  const existing = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isDefault, true)))
    .then((r) => r[0]);

  if (existing) return existing;

  // Check if any pipeline exists for this tenant
  const anyPipeline = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.tenantId, tenantId))
    .limit(1)
    .then((r) => r[0]);

  if (anyPipeline) return anyPipeline;

  // Create default pipeline
  const [pipeline] = await db
    .insert(pipelines)
    .values({
      tenantId,
      name: "default",
      label: "Default",
      isDefault: true,
    })
    .returning();

  return pipeline;
}

/**
 * Seed default stages for a pipeline if it has none.
 */
async function ensureDefaultStages(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  pipelineId: string,
) {
  const existing = await db
    .select({ id: jobPipelineStages.id })
    .from(jobPipelineStages)
    .where(eq(jobPipelineStages.pipelineId, pipelineId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(jobPipelineStages).values(
    DEFAULT_STAGES.map((s) => ({
      tenantId,
      pipelineId,
      name: s.name,
      label: s.label,
      color: s.color,
      sortOrder: s.sortOrder,
      isDefault: s.isDefault,
    })),
  );
}

export { DEFAULT_STAGES, getOrCreateDefaultPipeline, ensureDefaultStages };

const pipelineStagesRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /pipeline-stages
   * List stages sorted by sort_order. Auto-seeds defaults if empty.
   * Accepts optional ?pipelineId= query param (defaults to default pipeline).
   * Includes jobCount per stage.
   */
  f.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: pipelineStagesQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { pipelineId: queryPipelineId } = request.query;
      const db = getDb();

      // Resolve pipeline
      let pipelineId = queryPipelineId;
      if (!pipelineId) {
        const defaultPipeline = await getOrCreateDefaultPipeline(db, tenantId);
        pipelineId = defaultPipeline.id;
      }

      // Lazy-init: seed defaults if pipeline has no stages
      await ensureDefaultStages(db, tenantId, pipelineId);

      const data = await db
        .select({
          id: jobPipelineStages.id,
          tenantId: jobPipelineStages.tenantId,
          pipelineId: jobPipelineStages.pipelineId,
          name: jobPipelineStages.name,
          label: jobPipelineStages.label,
          color: jobPipelineStages.color,
          sortOrder: jobPipelineStages.sortOrder,
          isDefault: jobPipelineStages.isDefault,
          createdAt: jobPipelineStages.createdAt,
          updatedAt: jobPipelineStages.updatedAt,
          jobCount: sql<number>`(
            SELECT COUNT(*)::int FROM jobs
            WHERE jobs.pipeline_id = ${jobPipelineStages.pipelineId}
              AND jobs.status = ${jobPipelineStages.name}
          )`,
        })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.pipelineId, pipelineId))
        .orderBy(asc(jobPipelineStages.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * POST /pipeline-stages
   * Create a new stage. Auto-assigns next sortOrder.
   * Requires pipelineId in body.
   */
  f.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createPipelineStageBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      // Validate pipeline belongs to tenant
      const pipeline = await db
        .select({ id: pipelines.id })
        .from(pipelines)
        .where(
          and(
            eq(pipelines.tenantId, tenantId),
            eq(pipelines.id, body.pipelineId),
          ),
        )
        .then((r) => r[0]);

      if (!pipeline) {
        return reply.status(404).send({ message: "Pipeline not found" });
      }

      const name = slugify(body.label);
      if (!name) {
        return reply.status(400).send({ message: "Invalid label — must contain letters or numbers" });
      }

      // Check for duplicate name within pipeline
      const existing = await db
        .select({ id: jobPipelineStages.id })
        .from(jobPipelineStages)
        .where(
          and(
            eq(jobPipelineStages.pipelineId, body.pipelineId),
            eq(jobPipelineStages.name, name),
          ),
        )
        .then((r) => r[0]);

      if (existing) {
        return reply.status(409).send({ message: "A stage with that name already exists in this pipeline" });
      }

      // Get next sort order within pipeline
      const maxResult = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.pipelineId, body.pipelineId));

      const nextSortOrder = (maxResult[0]?.max ?? -1) + 1;

      const [stage] = await db
        .insert(jobPipelineStages)
        .values({
          tenantId,
          pipelineId: body.pipelineId,
          name,
          label: body.label.trim(),
          color: body.color || "gray",
          sortOrder: nextSortOrder,
          isDefault: false,
        })
        .returning();

      return reply.status(201).send({ data: stage });
    },
  );

  /**
   * PATCH /pipeline-stages/reorder
   * Bulk update sortOrder. Body: { order: [stageId, stageId, ...] }
   */
  f.patch(
    "/reorder",
    {
      preHandler: [requireTenant],
      schema: { body: reorderPipelineStagesBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { order } = request.body;
      const db = getDb();

      // Update each stage's sortOrder in a single transaction
      await db.transaction(async (tx) => {
        for (let i = 0; i < order.length; i++) {
          await tx
            .update(jobPipelineStages)
            .set({ sortOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(jobPipelineStages.tenantId, tenantId),
                eq(jobPipelineStages.id, order[i]),
              ),
            );
        }
      });

      return reply.send({ message: "Reordered" });
    },
  );

  /**
   * PATCH /pipeline-stages/:id
   * Update label, color. If name changes, also update jobs.status within the pipeline.
   */
  f.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updatePipelineStageBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(jobPipelineStages)
        .where(
          and(
            eq(jobPipelineStages.tenantId, tenantId),
            eq(jobPipelineStages.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Stage not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (body.color) {
        updates.color = body.color;
      }

      if (body.label?.trim()) {
        updates.label = body.label.trim();
        const newName = slugify(body.label);

        if (newName && newName !== existing.name) {
          // Check for duplicate name within pipeline
          const dup = await db
            .select({ id: jobPipelineStages.id })
            .from(jobPipelineStages)
            .where(
              and(
                eq(jobPipelineStages.pipelineId, existing.pipelineId),
                eq(jobPipelineStages.name, newName),
              ),
            )
            .then((r) => r[0]);

          if (dup) {
            return reply.status(409).send({ message: "A stage with that name already exists in this pipeline" });
          }

          updates.name = newName;

          // Update all jobs with old status name within this pipeline
          await db
            .update(jobs)
            .set({ status: newName, updatedAt: new Date() })
            .where(
              and(
                eq(jobs.tenantId, tenantId),
                eq(jobs.pipelineId, existing.pipelineId),
                eq(jobs.status, existing.name),
              ),
            );
        }
      }

      const [updated] = await db
        .update(jobPipelineStages)
        .set(updates)
        .where(
          and(
            eq(jobPipelineStages.tenantId, tenantId),
            eq(jobPipelineStages.id, id),
          ),
        )
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /pipeline-stages/:id
   * Reject if jobs exist in this stage within the pipeline. Require at least 1 stage remaining.
   */
  f.delete(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select()
        .from(jobPipelineStages)
        .where(
          and(
            eq(jobPipelineStages.tenantId, tenantId),
            eq(jobPipelineStages.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Stage not found" });
      }

      // Check if any jobs use this stage within this pipeline
      const jobCountResult = await db
        .select({ total: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
            eq(jobs.pipelineId, existing.pipelineId),
            eq(jobs.status, existing.name),
          ),
        );

      const jobCount = jobCountResult[0]?.total ?? 0;
      if (jobCount > 0) {
        return reply.status(409).send({
          message: `Cannot delete stage: ${jobCount} job(s) are in this stage. Move them first.`,
          jobCount,
        });
      }

      // Ensure at least 1 stage remains in the pipeline
      const totalStages = await db
        .select({ total: count() })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.pipelineId, existing.pipelineId));

      if ((totalStages[0]?.total ?? 0) <= 1) {
        return reply.status(400).send({
          message: "Cannot delete the last stage. At least one stage is required.",
        });
      }

      await db
        .delete(jobPipelineStages)
        .where(
          and(
            eq(jobPipelineStages.tenantId, tenantId),
            eq(jobPipelineStages.id, id),
          ),
        );

      return reply.send({ message: "Stage deleted" });
    },
  );
};
export default pipelineStagesRoutes;
