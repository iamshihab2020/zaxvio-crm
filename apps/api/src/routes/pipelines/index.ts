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
  createPipelineBody,
  updatePipelineBody,
} from "../../lib/schemas/pipelines.js";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const pipelineRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /pipelines
   * List all pipelines for the tenant with stageCount and jobCount.
   */
  f.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select({
          id: pipelines.id,
          tenantId: pipelines.tenantId,
          name: pipelines.name,
          label: pipelines.label,
          isDefault: pipelines.isDefault,
          createdAt: pipelines.createdAt,
          updatedAt: pipelines.updatedAt,
          stageCount: sql<number>`(
            SELECT COUNT(*)::int FROM job_pipeline_stages
            WHERE job_pipeline_stages.pipeline_id = ${pipelines.id}
          )`,
          jobCount: sql<number>`(
            SELECT COUNT(*)::int FROM jobs
            WHERE jobs.pipeline_id = ${pipelines.id}
          )`,
        })
        .from(pipelines)
        .where(eq(pipelines.tenantId, tenantId))
        .orderBy(sql`${pipelines.isDefault} DESC`, asc(pipelines.label));

      return reply.send({ data });
    },
  );

  /**
   * POST /pipelines
   * Create a new pipeline. Optionally seed default stages.
   */
  f.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createPipelineBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const name = slugify(body.label);
      if (!name) {
        return reply
          .status(400)
          .send({ message: "Invalid label — must contain letters or numbers" });
      }

      // Check for duplicate name
      const existing = await db
        .select({ id: pipelines.id })
        .from(pipelines)
        .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.name, name)))
        .then((r) => r[0]);

      if (existing) {
        return reply
          .status(409)
          .send({ message: "A pipeline with that name already exists" });
      }

      const result = await db.transaction(async (tx) => {
        // If setting as default, unset the current default
        if (body.isDefault) {
          await tx
            .update(pipelines)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(pipelines.tenantId, tenantId),
                eq(pipelines.isDefault, true),
              ),
            );
        }

        const [pipeline] = await tx
          .insert(pipelines)
          .values({
            tenantId,
            name,
            label: body.label.trim(),
            isDefault: body.isDefault ?? false,
          })
          .returning();

        // Seed stages
        if (body.copyFromPipelineId) {
          // Copy stages from another pipeline
          const sourceStages = await tx
            .select()
            .from(jobPipelineStages)
            .where(
              and(
                eq(jobPipelineStages.tenantId, tenantId),
                eq(jobPipelineStages.pipelineId, body.copyFromPipelineId),
              ),
            )
            .orderBy(asc(jobPipelineStages.sortOrder));

          if (sourceStages.length > 0) {
            await tx.insert(jobPipelineStages).values(
              sourceStages.map((s) => ({
                tenantId,
                pipelineId: pipeline.id,
                name: s.name,
                label: s.label,
                color: s.color,
                sortOrder: s.sortOrder,
                isDefault: s.isDefault,
              })),
            );
          }
        } else if (body.seedDefaultStages !== false) {
          // Seed default stages unless explicitly disabled
          await tx.insert(jobPipelineStages).values([
            {
              tenantId,
              pipelineId: pipeline.id,
              name: "scheduled",
              label: "Scheduled",
              color: "blue",
              sortOrder: 0,
              isDefault: true,
            },
            {
              tenantId,
              pipelineId: pipeline.id,
              name: "in_progress",
              label: "In Progress",
              color: "brand",
              sortOrder: 1,
              isDefault: true,
            },
            {
              tenantId,
              pipelineId: pipeline.id,
              name: "completed",
              label: "Completed",
              color: "green",
              sortOrder: 2,
              isDefault: true,
            },
            {
              tenantId,
              pipelineId: pipeline.id,
              name: "cancelled",
              label: "Cancelled",
              color: "gray",
              sortOrder: 3,
              isDefault: true,
            },
          ]);
        }

        return pipeline;
      });

      return reply.status(201).send({ data: result });
    },
  );

  /**
   * PATCH /pipelines/:id
   * Update pipeline label and/or isDefault.
   */
  f.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updatePipelineBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(pipelines)
        .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Pipeline not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (body.label?.trim()) {
        updates.label = body.label.trim();
        const newName = slugify(body.label);

        if (newName && newName !== existing.name) {
          // Check for duplicate name
          const dup = await db
            .select({ id: pipelines.id })
            .from(pipelines)
            .where(
              and(
                eq(pipelines.tenantId, tenantId),
                eq(pipelines.name, newName),
              ),
            )
            .then((r) => r[0]);

          if (dup) {
            return reply
              .status(409)
              .send({ message: "A pipeline with that name already exists" });
          }
          updates.name = newName;
        }
      }

      if (body.isDefault === true && !existing.isDefault) {
        // Toggle default in a transaction
        await db.transaction(async (tx) => {
          await tx
            .update(pipelines)
            .set({ isDefault: false, updatedAt: new Date() })
            .where(
              and(
                eq(pipelines.tenantId, tenantId),
                eq(pipelines.isDefault, true),
              ),
            );
          updates.isDefault = true;
          await tx
            .update(pipelines)
            .set(updates)
            .where(
              and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)),
            );
        });

        const [updated] = await db
          .select()
          .from(pipelines)
          .where(eq(pipelines.id, id));
        return reply.send({ data: updated });
      }

      if (body.isDefault === false && existing.isDefault) {
        // Cannot unset default if it's the only pipeline
        const totalPipelines = await db
          .select({ total: count() })
          .from(pipelines)
          .where(eq(pipelines.tenantId, tenantId));

        if ((totalPipelines[0]?.total ?? 0) <= 1) {
          return reply.status(400).send({
            message:
              "Cannot unset default on the only pipeline. Set another pipeline as default first.",
          });
        }
      }

      const [updated] = await db
        .update(pipelines)
        .set(updates)
        .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /pipelines/:id
   * Blocked if jobs exist, if it's the only pipeline, or if it's the default.
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
        .from(pipelines)
        .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Pipeline not found" });
      }

      if (existing.isDefault) {
        return reply.status(400).send({
          message:
            "Cannot delete the default pipeline. Set another pipeline as default first.",
        });
      }

      // Check total pipeline count
      const totalPipelines = await db
        .select({ total: count() })
        .from(pipelines)
        .where(eq(pipelines.tenantId, tenantId));

      if ((totalPipelines[0]?.total ?? 0) <= 1) {
        return reply.status(400).send({
          message:
            "Cannot delete the last pipeline. At least one pipeline is required.",
        });
      }

      // Check if any jobs reference this pipeline
      const jobCountResult = await db
        .select({ total: count() })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.pipelineId, id)));

      const jobCount = jobCountResult[0]?.total ?? 0;
      if (jobCount > 0) {
        return reply.status(409).send({
          message: `Cannot delete pipeline: ${jobCount} job(s) are assigned to it. Move them first.`,
          jobCount,
        });
      }

      // Cascade deletes stages via FK ON DELETE CASCADE
      await db
        .delete(pipelines)
        .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.id, id)));

      return reply.send({ message: "Pipeline deleted" });
    },
  );
};
export default pipelineRoutes;
