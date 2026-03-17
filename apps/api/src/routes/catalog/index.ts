import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
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
} from "@hvac-saas/database";

export default async function catalogRoutes(fastify: FastifyInstance) {
  /**
   * GET /catalog
   * List catalog items with search, pagination, filtering.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        page = "1",
        limit = "20",
        itemType,
        showArchived = "false",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(catalogItems.tenantId, tenantId)];

      // Only show active items unless showArchived is true
      if (showArchived !== "true") {
        filters.push(eq(catalogItems.isActive, true));
      }

      // Filter by item type
      const validItemTypes = ["labor", "part", "material", "service_call", "other"];
      if (itemType && validItemTypes.includes(itemType)) {
        filters.push(
          eq(
            catalogItems.itemType,
            itemType as "labor" | "part" | "material" | "service_call" | "other",
          ),
        );
      }

      // Search across name, category, description
      if (search) {
        filters.push(
          or(
            ilike(catalogItems.name, `%${search}%`),
            ilike(catalogItems.category, `%${search}%`),
            ilike(catalogItems.description, `%${search}%`),
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;

      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        return reply.status(400).send({ message: "name is required" });
      }

      const validItemTypes = [
        "labor",
        "part",
        "material",
        "service_call",
        "other",
      ];
      if (!body.itemType || !validItemTypes.includes(body.itemType as string)) {
        return reply.status(400).send({
          message:
            "itemType is required and must be one of: labor, part, material, service_call, other",
        });
      }

      if (body.unitPrice === undefined || body.unitPrice === null) {
        return reply.status(400).send({ message: "unitPrice is required" });
      }
      const price = parseFloat(String(body.unitPrice));
      if (isNaN(price) || price < 0) {
        return reply
          .status(400)
          .send({ message: "unitPrice must be a non-negative number" });
      }

      const db = getDb();
      const [item] = await db
        .insert(catalogItems)
        .values({
          tenantId,
          name: (body.name as string).trim(),
          itemType: body.itemType as
            | "labor"
            | "part"
            | "material"
            | "service_call"
            | "other",
          unitPrice: String(price),
          unit: ((body.unit as string) || "each").trim(),
          category: body.category
            ? (body.category as string).trim()
            : null,
          description: body.description
            ? (body.description as string).trim()
            : null,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
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
        if (typeof body.name !== "string" || !body.name.trim()) {
          return reply.status(400).send({ message: "name cannot be empty" });
        }
        updates.name = (body.name as string).trim();
      }

      if (body.itemType !== undefined) {
        const validItemTypes = [
          "labor",
          "part",
          "material",
          "service_call",
          "other",
        ];
        if (!validItemTypes.includes(body.itemType as string)) {
          return reply.status(400).send({
            message:
              "itemType must be one of: labor, part, material, service_call, other",
          });
        }
        updates.itemType = body.itemType;
      }

      if (body.unitPrice !== undefined) {
        const price = parseFloat(String(body.unitPrice));
        if (isNaN(price) || price < 0) {
          return reply
            .status(400)
            .send({ message: "unitPrice must be a non-negative number" });
        }
        updates.unitPrice = String(price);
      }

      if (body.unit !== undefined) {
        updates.unit = body.unit ? (body.unit as string).trim() : "each";
      }

      if (body.category !== undefined) {
        updates.category = body.category
          ? (body.category as string).trim()
          : null;
      }

      if (body.description !== undefined) {
        updates.description = body.description
          ? (body.description as string).trim()
          : null;
      }

      if (body.isActive !== undefined) {
        updates.isActive = Boolean(body.isActive);
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
}
