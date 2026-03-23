import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  jobPipelineStages,
  jobs,
  tenants,
  eq,
  and,
  asc,
  count,
  sql,
} from "@hvac-saas/database";

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
 * Seed default stages for a tenant if they have none.
 * Returns the seeded (or existing) stages.
 */
async function ensureDefaultStages(db: ReturnType<typeof getDb>, tenantId: string) {
  const existing = await db
    .select({ id: jobPipelineStages.id })
    .from(jobPipelineStages)
    .where(eq(jobPipelineStages.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(jobPipelineStages).values(
    DEFAULT_STAGES.map((s) => ({
      tenantId,
      name: s.name,
      label: s.label,
      color: s.color,
      sortOrder: s.sortOrder,
      isDefault: s.isDefault,
    })),
  );
}

export { DEFAULT_STAGES };

export default async function pipelineStagesRoutes(fastify: FastifyInstance) {
  /**
   * GET /pipeline-stages
   * List stages sorted by sort_order. Auto-seeds defaults if empty.
   * Includes jobCount per stage.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Lazy-init: seed defaults if tenant has no stages
      await ensureDefaultStages(db, tenantId);

      const data = await db
        .select({
          id: jobPipelineStages.id,
          tenantId: jobPipelineStages.tenantId,
          name: jobPipelineStages.name,
          label: jobPipelineStages.label,
          color: jobPipelineStages.color,
          sortOrder: jobPipelineStages.sortOrder,
          isDefault: jobPipelineStages.isDefault,
          createdAt: jobPipelineStages.createdAt,
          updatedAt: jobPipelineStages.updatedAt,
          jobCount: sql<number>`(
            SELECT COUNT(*)::int FROM jobs
            WHERE jobs.tenant_id = ${jobPipelineStages.tenantId}
              AND jobs.status = ${jobPipelineStages.name}
          )`,
        })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.tenantId, tenantId))
        .orderBy(asc(jobPipelineStages.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * POST /pipeline-stages
   * Create a new stage. Auto-assigns next sortOrder.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as { label: string; color?: string };
      const db = getDb();

      if (!body.label?.trim()) {
        return reply.status(400).send({ message: "label is required" });
      }

      const name = slugify(body.label);
      if (!name) {
        return reply.status(400).send({ message: "Invalid label — must contain letters or numbers" });
      }

      // Check for duplicate name
      const existing = await db
        .select({ id: jobPipelineStages.id })
        .from(jobPipelineStages)
        .where(
          and(
            eq(jobPipelineStages.tenantId, tenantId),
            eq(jobPipelineStages.name, name),
          ),
        )
        .then((r) => r[0]);

      if (existing) {
        return reply.status(409).send({ message: "A stage with that name already exists" });
      }

      // Get next sort order
      const maxResult = await db
        .select({ max: sql<number>`COALESCE(MAX(sort_order), -1)` })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.tenantId, tenantId));

      const nextSortOrder = (maxResult[0]?.max ?? -1) + 1;

      const [stage] = await db
        .insert(jobPipelineStages)
        .values({
          tenantId,
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
  fastify.patch(
    "/reorder",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as { order: string[] };
      const db = getDb();

      if (!Array.isArray(body.order) || body.order.length === 0) {
        return reply.status(400).send({ message: "order array is required" });
      }

      // Update each stage's sortOrder in a single transaction
      await db.transaction(async (tx) => {
        for (let i = 0; i < body.order.length; i++) {
          await tx
            .update(jobPipelineStages)
            .set({ sortOrder: i, updatedAt: new Date() })
            .where(
              and(
                eq(jobPipelineStages.tenantId, tenantId),
                eq(jobPipelineStages.id, body.order[i]),
              ),
            );
        }
      });

      return reply.send({ message: "Reordered" });
    },
  );

  /**
   * PATCH /pipeline-stages/:id
   * Update label, color. If name changes, also update jobs.status.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as { label?: string; color?: string };
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
          // Check for duplicate name
          const dup = await db
            .select({ id: jobPipelineStages.id })
            .from(jobPipelineStages)
            .where(
              and(
                eq(jobPipelineStages.tenantId, tenantId),
                eq(jobPipelineStages.name, newName),
              ),
            )
            .then((r) => r[0]);

          if (dup) {
            return reply.status(409).send({ message: "A stage with that name already exists" });
          }

          updates.name = newName;

          // Update all jobs with old status name to new name
          await db
            .update(jobs)
            .set({ status: newName, updatedAt: new Date() })
            .where(
              and(
                eq(jobs.tenantId, tenantId),
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
   * Reject if jobs exist. Require at least 1 stage remaining.
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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

      // Check if any jobs use this stage
      const jobCountResult = await db
        .select({ total: count() })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
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

      // Ensure at least 1 stage remains
      const totalStages = await db
        .select({ total: count() })
        .from(jobPipelineStages)
        .where(eq(jobPipelineStages.tenantId, tenantId));

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
}
