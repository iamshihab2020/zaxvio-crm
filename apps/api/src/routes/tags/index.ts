import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb, tags, eq, and } from "@hvac-saas/database";
import { idParam, createTagBody, updateTagBody } from "../../lib/schemas/tags.js";

const tagRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /tags
   * List all tags for the tenant.
   */
  f.get(
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
  f.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createTagBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const db = getDb();
      const [tag] = await db
        .insert(tags)
        .values({
          tenantId,
          name: body.name,
          color: body.color || null,
        })
        .returning();

      return reply.status(201).send({ data: tag });
    },
  );

  /**
   * PATCH /tags/:id
   * Update a tag.
   */
  f.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateTagBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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
      if ("name" in body) updates.name = body.name;
      if ("color" in body) updates.color = body.color || null;

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
};
export default tagRoutes;
