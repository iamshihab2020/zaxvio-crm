import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb, tags, eq, and } from "@hvac-saas/database";

export default async function tagRoutes(fastify: FastifyInstance) {
  /**
   * GET /tags
   * List all tags for the tenant.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select()
        .from(tags)
        .where(eq(tags.tenantId, tenantId))
        .orderBy(tags.name);

      return reply.send({ data });
    },
  );

  /**
   * POST /tags
   * Create a new tag.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;

      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        return reply.status(400).send({ message: "name is required" });
      }

      const db = getDb();
      const [tag] = await db
        .insert(tags)
        .values({
          tenantId,
          name: body.name.trim(),
          color: (body.color as string) || null,
        })
        .returning();

      return reply.status(201).send({ data: tag });
    },
  );

  /**
   * PATCH /tags/:id
   * Update a tag.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Tag not found" });
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if ("name" in body) updates.name = (body.name as string).trim();
      if ("color" in body) updates.color = (body.color as string) || null;

      const [updated] = await db
        .update(tags)
        .set(updates)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, id)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /tags/:id
   * Delete a tag (cascades to customerTags).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Tag not found" });
      }

      await db
        .delete(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, id)));

      return reply.send({ message: "Tag deleted" });
    },
  );
}
