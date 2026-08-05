import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
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
import { ownsCatalogItem } from "../../lib/tenant-guards.js";
import {
  idParam,
  checklistItemParams,
  checklistListQuery,
  createChecklistTemplateBody,
  updateChecklistTemplateBody,
  addChecklistItemBody,
  updateChecklistItemBody,
} from "../../lib/schemas/checklists.js";

const checklistRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /checklists
   * List checklist templates with item counts.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: checklistListQuery },
    },
    async (request, reply) => {
      const { serviceType, showInactive } = request.query;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const filters = [eq(checklistTemplates.tenantId, tenantId)];

      if (!showInactive) {
        filters.push(eq(checklistTemplates.isActive, true));
      }

      if (serviceType) {
        filters.push(
          eq(checklistTemplates.serviceType, serviceType),
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
          // `${checklistTemplates.id}` renders as a bare `"id"`, which Postgres
          // binds to `checklist_items.id` inside the subquery — so the
          // condition was `checklist_items.template_id = checklist_items.id`
          // and every template reported 0 items. Same defect as the pipeline
          // and stage counts; the outer column has to be written out in full.
          itemCount: sql<number>`(
            SELECT COUNT(*)::int FROM checklist_items ci
            WHERE ci.template_id = checklist_templates.id
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
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
          and(
            eq(checklistItems.catalogItemId, catalogItems.id),
            eq(catalogItems.tenantId, tenantId),
          ),
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
    {
      preHandler: [requireTenant],
      schema: { body: createChecklistTemplateBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const db = getDb();

      const [template] = await db
        .insert(checklistTemplates)
        .values({
          tenantId,
          name: body.name,
          serviceType: body.serviceType,
          isActive: body.isActive,
        })
        .returning();

      if (body.items && body.items.length > 0) {
        await db.insert(checklistItems).values(
          body.items.map((item, idx) => ({
            tenantId,
            templateId: template.id,
            label: item.label,
            isRequired: item.isRequired ?? true,
            catalogItemId: item.catalogItemId ?? null,
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateChecklistTemplateBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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
      if (body.name !== undefined) updates.name = body.name;
      if (body.serviceType !== undefined) updates.serviceType = body.serviceType;
      if (body.isActive !== undefined) updates.isActive = body.isActive;

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
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: addChecklistItemBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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

      // Verifying the template is not the same as verifying the catalog item —
      // this is the check jobs and quotes do on the identical field.
      if (
        body.catalogItemId &&
        !(await ownsCatalogItem(db, tenantId, body.catalogItemId))
      ) {
        return reply.status(400).send({ message: "Catalog item not found" });
      }

      const [item] = await db
        .insert(checklistItems)
        .values({
          tenantId,
          templateId: id,
          label: body.label,
          isRequired: body.isRequired ?? true,
          catalogItemId: body.catalogItemId ?? null,
          sortOrder: body.sortOrder ?? 0,
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
    {
      preHandler: [requireTenant],
      schema: { params: checklistItemParams, body: updateChecklistItemBody },
    },
    async (request, reply) => {
      const { id, itemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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

      if (
        body.catalogItemId &&
        !(await ownsCatalogItem(db, tenantId, body.catalogItemId))
      ) {
        return reply.status(400).send({ message: "Catalog item not found" });
      }

      const updates: Record<string, unknown> = {};
      if (body.label !== undefined) updates.label = body.label;
      if (body.isRequired !== undefined) updates.isRequired = body.isRequired;
      if (body.catalogItemId !== undefined) updates.catalogItemId = body.catalogItemId ?? null;
      if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      const [updated] = await db
        .update(checklistItems)
        .set(updates)
        .where(and(eq(checklistItems.id, itemId), eq(checklistItems.tenantId, tenantId)))
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
    {
      preHandler: [requireTenant],
      schema: { params: checklistItemParams },
    },
    async (request, reply) => {
      const { id, itemId } = request.params;
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

      await db
        .delete(checklistItems)
        .where(and(eq(checklistItems.id, itemId), eq(checklistItems.tenantId, tenantId)));

      return reply.send({ message: "Checklist item deleted" });
    },
  );
};
export default checklistRoutes;
