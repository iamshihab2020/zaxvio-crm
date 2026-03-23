import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  checklistTemplates,
  checklistItems,
  catalogItems,
  eq,
  and,
  asc,
  desc,
  count,
  sql,
} from "@hvac-saas/database";

export default async function checklistRoutes(fastify: FastifyInstance) {
  /**
   * GET /checklists
   * List checklist templates with item counts.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { serviceType, showInactive } = request.query as Record<
        string,
        string | undefined
      >;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const filters = [eq(checklistTemplates.tenantId, tenantId)];

      if (showInactive !== "true") {
        filters.push(eq(checklistTemplates.isActive, true));
      }

      if (serviceType) {
        filters.push(
          eq(checklistTemplates.serviceType, serviceType as never),
        );
      }

      const whereClause = and(...filters);

      const data = await db
        .select({
          id: checklistTemplates.id,
          tenantId: checklistTemplates.tenantId,
          serviceType: checklistTemplates.serviceType,
          name: checklistTemplates.name,
          isActive: checklistTemplates.isActive,
          createdAt: checklistTemplates.createdAt,
          itemCount: sql<number>`(
            SELECT COUNT(*) FROM checklist_items
            WHERE checklist_items.template_id = ${checklistTemplates.id}
          )`.as("item_count"),
        })
        .from(checklistTemplates)
        .where(whereClause)
        .orderBy(desc(checklistTemplates.createdAt));

      return reply.send({ data });
    },
  );

  /**
   * GET /checklists/:id
   * Single template with items + catalog names.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const template = await db
        .select()
        .from(checklistTemplates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!template) {
        return reply.status(404).send({ message: "Checklist template not found" });
      }

      const items = await db
        .select({
          id: checklistItems.id,
          templateId: checklistItems.templateId,
          label: checklistItems.label,
          isRequired: checklistItems.isRequired,
          catalogItemId: checklistItems.catalogItemId,
          sortOrder: checklistItems.sortOrder,
          createdAt: checklistItems.createdAt,
          catalogItemName: catalogItems.name,
          catalogItemPrice: catalogItems.unitPrice,
        })
        .from(checklistItems)
        .leftJoin(
          catalogItems,
          eq(checklistItems.catalogItemId, catalogItems.id),
        )
        .where(
          and(
            eq(checklistItems.tenantId, tenantId),
            eq(checklistItems.templateId, id),
          ),
        )
        .orderBy(asc(checklistItems.sortOrder));

      return reply.send({ data: { ...template, items } });
    },
  );

  /**
   * POST /checklists
   * Create template + items in one request.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;

      if (!body.name || !(body.name as string).trim()) {
        return reply.status(400).send({ message: "name is required" });
      }
      if (!body.serviceType) {
        return reply.status(400).send({ message: "serviceType is required" });
      }

      const db = getDb();

      const [template] = await db
        .insert(checklistTemplates)
        .values({
          tenantId,
          name: (body.name as string).trim(),
          serviceType: body.serviceType as never,
          isActive: body.isActive !== false,
        })
        .returning();

      // Insert items if provided
      const bodyItems = body.items as Array<{
        label: string;
        isRequired?: boolean;
        catalogItemId?: string | null;
        sortOrder?: number;
      }> | undefined;

      if (bodyItems && bodyItems.length > 0) {
        await db.insert(checklistItems).values(
          bodyItems.map((item, idx) => ({
            tenantId,
            templateId: template.id,
            label: item.label.trim(),
            isRequired: item.isRequired ?? true,
            catalogItemId: item.catalogItemId || null,
            sortOrder: item.sortOrder ?? idx,
          })),
        );
      }

      // Re-fetch with items
      const items = await db
        .select()
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.tenantId, tenantId),
            eq(checklistItems.templateId, template.id),
          ),
        )
        .orderBy(asc(checklistItems.sortOrder));

      return reply.status(201).send({ data: { ...template, items } });
    },
  );

  /**
   * PATCH /checklists/:id
   * Update template metadata (name, serviceType, isActive).
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
        .select({ id: checklistTemplates.id })
        .from(checklistTemplates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Checklist template not found" });
      }

      const updates: Record<string, unknown> = {};
      if (body.name !== undefined) updates.name = (body.name as string).trim();
      if (body.serviceType !== undefined) updates.serviceType = body.serviceType;
      if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      const [updated] = await db
        .update(checklistTemplates)
        .set(updates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        )
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /checklists/:id
   * Delete template (cascades items).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: checklistTemplates.id })
        .from(checklistTemplates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Checklist template not found" });
      }

      await db
        .delete(checklistTemplates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        );

      return reply.send({ message: "Checklist template deleted" });
    },
  );

  // ===== ITEMS =====

  /**
   * POST /checklists/:id/items
   * Add an item to a template.
   */
  fastify.post(
    "/:id/items",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      // Verify template exists
      const template = await db
        .select({ id: checklistTemplates.id })
        .from(checklistTemplates)
        .where(
          and(
            eq(checklistTemplates.tenantId, tenantId),
            eq(checklistTemplates.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!template) {
        return reply.status(404).send({ message: "Checklist template not found" });
      }

      if (!body.label || !(body.label as string).trim()) {
        return reply.status(400).send({ message: "label is required" });
      }

      const [item] = await db
        .insert(checklistItems)
        .values({
          tenantId,
          templateId: id,
          label: (body.label as string).trim(),
          isRequired: body.isRequired !== false,
          catalogItemId: (body.catalogItemId as string) || null,
          sortOrder: (body.sortOrder as number) ?? 0,
        })
        .returning();

      return reply.status(201).send({ data: item });
    },
  );

  /**
   * PATCH /checklists/:id/items/:itemId
   * Update a checklist item.
   */
  fastify.patch(
    "/:id/items/:itemId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, itemId } = request.params as {
        id: string;
        itemId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      const existing = await db
        .select({ id: checklistItems.id })
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.tenantId, tenantId),
            eq(checklistItems.templateId, id),
            eq(checklistItems.id, itemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Checklist item not found" });
      }

      const updates: Record<string, unknown> = {};
      if (body.label !== undefined) updates.label = (body.label as string).trim();
      if (body.isRequired !== undefined) updates.isRequired = Boolean(body.isRequired);
      if (body.catalogItemId !== undefined) updates.catalogItemId = (body.catalogItemId as string) || null;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      const [updated] = await db
        .update(checklistItems)
        .set(updates)
        .where(eq(checklistItems.id, itemId))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /checklists/:id/items/:itemId
   * Delete a checklist item.
   */
  fastify.delete(
    "/:id/items/:itemId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, itemId } = request.params as {
        id: string;
        itemId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: checklistItems.id })
        .from(checklistItems)
        .where(
          and(
            eq(checklistItems.tenantId, tenantId),
            eq(checklistItems.templateId, id),
            eq(checklistItems.id, itemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Checklist item not found" });
      }

      await db.delete(checklistItems).where(eq(checklistItems.id, itemId));

      return reply.send({ message: "Checklist item deleted" });
    },
  );
}
