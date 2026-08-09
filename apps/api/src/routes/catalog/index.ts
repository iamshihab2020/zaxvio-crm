import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { bulkIdsBody, bulkToggleActiveBody } from "../../lib/schemas/bulk.js";
import {
  idParam,
  catalogListQuery,
  createCatalogItemBody,
  updateCatalogItemBody,
} from "../../lib/schemas/catalog.js";
import {
  getDb,
  catalogItems,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
  inArray,
} from "@hvac-saas/database";
import { containsPattern } from "../../lib/search.js";

const catalogRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /catalog
   * List catalog items with search, pagination, filtering.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant], schema: { querystring: catalogListQuery } },
    async (request, reply) => {
      const {
        search = "",
        page,
        limit,
        itemType,
        showArchived,
        sortBy,
        sortOrder,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(catalogItems.tenantId, tenantId)];

      // Only show active items unless showArchived is true
      if (!showArchived) {
        filters.push(eq(catalogItems.isActive, true));
      }

      // Filter by item type
      if (itemType) {
        filters.push(
          eq(catalogItems.itemType, itemType),
        );
      }

      // Search across name, category, description
      if (search) {
        filters.push(
          or(
            ilike(catalogItems.name, containsPattern(search)),
            ilike(catalogItems.category, containsPattern(search)),
            ilike(catalogItems.description, containsPattern(search)),
          )!,
        );
      }

      const whereClause = and(...filters);

      // Sort column mapping
      const sortColumnMap = {
        createdAt: catalogItems.createdAt,
        name: catalogItems.name,
        unitPrice: catalogItems.unitPrice,
        category: catalogItems.category,
        itemType: catalogItems.itemType,
      } as const;
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
        catalogItems.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(catalogItems)
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(catalogItems)
          .where(whereClause),
      ]);

      const total = totalResult[0]?.total ?? 0;

      return reply.send({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    },
  );

  /**
   * GET /catalog/categories
   * Return distinct category strings for the tenant.
   */
  fastify.get(
    "/categories",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const result = await db
        .selectDistinct({ category: catalogItems.category })
        .from(catalogItems)
        .where(
          and(
            eq(catalogItems.tenantId, tenantId),
            sql`${catalogItems.category} IS NOT NULL`,
            sql`${catalogItems.category} != ''`,
          ),
        )
        .orderBy(asc(catalogItems.category));

      const categories = result.map((r) => r.category).filter(Boolean) as string[];

      return reply.send({ data: categories });
    },
  );

  /**
   * GET /catalog/:id
   * Get a single catalog item by ID.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const item = await db
        .select()
        .from(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, id)),
        )
        .then((r) => r[0]);

      if (!item) {
        return reply.status(404).send({ message: "Catalog item not found" });
      }

      return reply.send({ data: item });
    },
  );

  /**
   * POST /catalog
   * Create a new catalog item.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant], schema: { body: createCatalogItemBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const db = getDb();
      const [item] = await db
        .insert(catalogItems)
        .values({
          tenantId,
          name: body.name.trim(),
          itemType: body.itemType,
          unitPrice: String(body.unitPrice),
          // `== null` catches both undefined and null, and both mean the same
          // thing here: cost unknown. Storing "0" instead would report this
          // item as pure profit forever.
          unitCost: body.unitCost == null ? null : String(body.unitCost),
          unit: (body.unit || "each").trim(),
          category: body.category ? body.category.trim() : null,
          description: body.description ? body.description.trim() : null,
        })
        .returning();

      return reply.status(201).send({ data: item });
    },
  );

  /**
   * PATCH /catalog/:id
   * Update a catalog item.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam, body: updateCatalogItemBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, id)),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Catalog item not found" });
      }

      const updates: Record<string, unknown> = {};

      if (body.name !== undefined) {
        updates.name = body.name.trim();
      }

      if (body.itemType !== undefined) {
        updates.itemType = body.itemType;
      }

      if (body.unitPrice !== undefined) {
        updates.unitPrice = String(body.unitPrice);
      }

      // `undefined` = field absent, leave it alone. `null` = the user cleared
      // it, which must be writable — cost is the one field where "I no longer
      // know this" is a legitimate state to return to.
      if (body.unitCost !== undefined) {
        updates.unitCost = body.unitCost === null ? null : String(body.unitCost);
      }

      if (body.unit !== undefined) {
        updates.unit = body.unit ? body.unit.trim() : "each";
      }

      if (body.category !== undefined) {
        updates.category = body.category ? body.category.trim() : null;
      }

      if (body.description !== undefined) {
        updates.description = body.description ? body.description.trim() : null;
      }

      if (body.isActive !== undefined) {
        updates.isActive = body.isActive;
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      const [updated] = await db
        .update(catalogItems)
        .set(updates)
        .where(
          and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, id)),
        )
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /catalog/:id
   * Hard delete a catalog item.
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, id)),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Catalog item not found" });
      }

      await db
        .delete(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), eq(catalogItems.id, id)),
        );

      return reply.send({ message: "Catalog item deleted" });
    },
  );
  /**
   * POST /catalog/bulk-delete
   * Hard delete multiple catalog items.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), inArray(catalogItems.id, ids)),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .delete(catalogItems)
          .where(
            and(eq(catalogItems.tenantId, tenantId), inArray(catalogItems.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /catalog/bulk-toggle-active
   * Set isActive to a specific value for multiple catalog items.
   */
  fastify.post(
    "/bulk-toggle-active",
    { preHandler: [requireTenant], schema: { body: bulkToggleActiveBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids, isActive } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: catalogItems.id })
        .from(catalogItems)
        .where(
          and(eq(catalogItems.tenantId, tenantId), inArray(catalogItems.id, ids)),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .update(catalogItems)
          .set({ isActive })
          .where(
            and(eq(catalogItems.tenantId, tenantId), inArray(catalogItems.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );
};
export default catalogRoutes;
