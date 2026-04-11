import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { bulkIdsBody, bulkToggleActiveBody } from "../../lib/schemas/bulk.js";
import {
  getDb,
  maintenanceContracts,
  customers,
  equipment,
  customerActivities,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  lte,
  gte,
  sql,
  inArray,
} from "@hvac-saas/database";
import {
  idParam,
  maintenanceContractListQuery,
  expiringContractsQuery,
  createMaintenanceContractBody,
  updateMaintenanceContractBody,
} from "../../lib/schemas/equipment.js";

const maintenanceContractRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /maintenance-contracts
   * List contracts with search, pagination, filtering.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: maintenanceContractListQuery },
    },
    async (request, reply) => {
      const {
        search = "",
        page,
        limit,
        customerId,
        equipmentId,
        isActive,
        sortBy,
        sortOrder,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(maintenanceContracts.tenantId, tenantId)];

      if (customerId) {
        filters.push(eq(maintenanceContracts.customerId, customerId));
      }

      if (equipmentId) {
        filters.push(eq(maintenanceContracts.equipmentId, equipmentId));
      }

      if (isActive === true) {
        filters.push(eq(maintenanceContracts.isActive, true));
      } else if (isActive === false) {
        filters.push(eq(maintenanceContracts.isActive, false));
      }

      if (search) {
        filters.push(
          or(
            ilike(maintenanceContracts.contractName, `%${search}%`),
            ilike(maintenanceContracts.notes, `%${search}%`),
          )!,
        );
      }

      const whereClause = and(...filters);

      const sortColumnMap = {
        createdAt: maintenanceContracts.createdAt,
        contractName: maintenanceContracts.contractName,
        startDate: maintenanceContracts.startDate,
        endDate: maintenanceContracts.endDate,
        annualPrice: maintenanceContracts.annualPrice,
      } as const;
      const sortCol = sortColumnMap[sortBy] ?? maintenanceContracts.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: maintenanceContracts.id,
            tenantId: maintenanceContracts.tenantId,
            customerId: maintenanceContracts.customerId,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
            equipmentId: maintenanceContracts.equipmentId,
            equipmentType: equipment.equipmentType,
            equipmentBrand: equipment.brand,
            contractName: maintenanceContracts.contractName,
            startDate: maintenanceContracts.startDate,
            endDate: maintenanceContracts.endDate,
            frequency: maintenanceContracts.frequency,
            visitsPerYear: maintenanceContracts.visitsPerYear,
            annualPrice: maintenanceContracts.annualPrice,
            isActive: maintenanceContracts.isActive,
            notes: maintenanceContracts.notes,
            createdAt: maintenanceContracts.createdAt,
            updatedAt: maintenanceContracts.updatedAt,
          })
          .from(maintenanceContracts)
          .leftJoin(
            customers,
            eq(maintenanceContracts.customerId, customers.id),
          )
          .leftJoin(
            equipment,
            eq(maintenanceContracts.equipmentId, equipment.id),
          )
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(maintenanceContracts)
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
   * GET /maintenance-contracts/expiring
   * Contracts expiring within N days.
   */
  fastify.get(
    "/expiring",
    {
      preHandler: [requireTenant],
      schema: { querystring: expiringContractsQuery },
    },
    async (request, reply) => {
      const { days } = request.query;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date(
        Date.now() + days * 24 * 60 * 60 * 1000,
      )
        .toISOString()
        .split("T")[0];

      const data = await db
        .select({
          id: maintenanceContracts.id,
          contractName: maintenanceContracts.contractName,
          customerId: maintenanceContracts.customerId,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          endDate: maintenanceContracts.endDate,
          annualPrice: maintenanceContracts.annualPrice,
          isActive: maintenanceContracts.isActive,
        })
        .from(maintenanceContracts)
        .leftJoin(
          customers,
          eq(maintenanceContracts.customerId, customers.id),
        )
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.isActive, true),
            gte(maintenanceContracts.endDate, today),
            lte(maintenanceContracts.endDate, futureDate),
          ),
        )
        .orderBy(asc(maintenanceContracts.endDate));

      return reply.send({ data });
    },
  );

  /**
   * GET /maintenance-contracts/:id
   * Get a single contract.
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

      const item = await db
        .select({
          id: maintenanceContracts.id,
          tenantId: maintenanceContracts.tenantId,
          customerId: maintenanceContracts.customerId,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          equipmentId: maintenanceContracts.equipmentId,
          equipmentType: equipment.equipmentType,
          equipmentBrand: equipment.brand,
          contractName: maintenanceContracts.contractName,
          startDate: maintenanceContracts.startDate,
          endDate: maintenanceContracts.endDate,
          frequency: maintenanceContracts.frequency,
          visitsPerYear: maintenanceContracts.visitsPerYear,
          annualPrice: maintenanceContracts.annualPrice,
          isActive: maintenanceContracts.isActive,
          notes: maintenanceContracts.notes,
          renewalReminderSentAt: maintenanceContracts.renewalReminderSentAt,
          createdAt: maintenanceContracts.createdAt,
          updatedAt: maintenanceContracts.updatedAt,
        })
        .from(maintenanceContracts)
        .leftJoin(
          customers,
          eq(maintenanceContracts.customerId, customers.id),
        )
        .leftJoin(
          equipment,
          eq(maintenanceContracts.equipmentId, equipment.id),
        )
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!item) {
        return reply
          .status(404)
          .send({ message: "Service agreement not found" });
      }

      return reply.send({ data: item });
    },
  );

  /**
   * POST /maintenance-contracts
   * Create a service agreement.
   */
  fastify.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createMaintenanceContractBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;

      const db = getDb();

      // Verify customer
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, body.customerId),
          ),
        )
        .then((r) => r[0]);

      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      // Verify equipment if provided
      if (body.equipmentId) {
        const equip = await db
          .select({ id: equipment.id })
          .from(equipment)
          .where(
            and(
              eq(equipment.tenantId, tenantId),
              eq(equipment.id, body.equipmentId),
            ),
          )
          .then((r) => r[0]);

        if (!equip) {
          return reply.status(404).send({ message: "Equipment not found" });
        }
      }

      const [item] = await db
        .insert(maintenanceContracts)
        .values({
          tenantId,
          customerId: body.customerId,
          equipmentId: body.equipmentId ?? null,
          contractName: body.contractName,
          startDate: body.startDate,
          endDate: body.endDate,
          frequency: body.frequency,
          visitsPerYear: body.visitsPerYear,
          annualPrice: body.annualPrice != null ? String(body.annualPrice) : null,
          notes: body.notes ?? null,
        })
        .returning();

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: body.customerId,
        type: "agreement.created",
        description: `Service agreement created: ${body.contractName}`,
        performedBy: userId,
      });

      return reply.status(201).send({ data: item });
    },
  );

  /**
   * PATCH /maintenance-contracts/:id
   * Update a service agreement.
   */
  fastify.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateMaintenanceContractBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply
          .status(404)
          .send({ message: "Service agreement not found" });
      }

      const updates: Record<string, unknown> = {};
      const changedFields: string[] = [];

      if (body.contractName !== undefined) {
        if (body.contractName !== existing.contractName) {
          updates.contractName = body.contractName;
          changedFields.push("contractName");
        }
      }

      for (const field of ["startDate", "endDate"] as const) {
        if (body[field] !== undefined) {
          if (body[field] !== existing[field]) {
            updates[field] = body[field];
            changedFields.push(field);
          }
        }
      }

      if (body.frequency !== undefined) {
        if (body.frequency !== existing.frequency) {
          updates.frequency = body.frequency;
          changedFields.push("frequency");
        }
      }

      if (body.visitsPerYear !== undefined) {
        if (body.visitsPerYear !== existing.visitsPerYear) {
          updates.visitsPerYear = body.visitsPerYear;
          changedFields.push("visitsPerYear");
        }
      }

      if (body.annualPrice !== undefined) {
        const val = body.annualPrice != null ? String(body.annualPrice) : null;
        if (val !== existing.annualPrice) {
          updates.annualPrice = val;
          changedFields.push("annualPrice");
        }
      }

      if (body.equipmentId !== undefined) {
        const val = body.equipmentId ?? null;
        if (val !== existing.equipmentId) {
          updates.equipmentId = val;
          changedFields.push("equipmentId");
        }
      }

      if (body.isActive !== undefined) {
        if (body.isActive !== existing.isActive) {
          updates.isActive = body.isActive;
          changedFields.push("isActive");
        }
      }

      if (body.notes !== undefined) {
        const val = body.notes ?? null;
        if (val !== existing.notes) {
          updates.notes = val;
          changedFields.push("notes");
        }
      }

      if (changedFields.length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(maintenanceContracts)
        .set(updates)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.id, id),
          ),
        )
        .returning();

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: existing.customerId,
        type: "agreement.updated",
        description: `Service agreement updated: ${updated.contractName}`,
        metadata: { changedFields },
        performedBy: userId,
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /maintenance-contracts/:id
   * Hard delete a service agreement.
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
      const userId = request.authUser.userId;
      const db = getDb();

      const existing = await db
        .select()
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.id, id),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply
          .status(404)
          .send({ message: "Service agreement not found" });
      }

      await db
        .delete(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            eq(maintenanceContracts.id, id),
          ),
        );

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: existing.customerId,
        type: "agreement.deleted",
        description: `Service agreement removed: ${existing.contractName}`,
        performedBy: userId,
      });

      return reply.send({ message: "Service agreement deleted" });
    },
  );
  /**
   * POST /maintenance-contracts/bulk-delete
   * Hard delete multiple service agreements.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: maintenanceContracts.id })
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            inArray(maintenanceContracts.id, ids),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .delete(maintenanceContracts)
          .where(
            and(
              eq(maintenanceContracts.tenantId, tenantId),
              inArray(maintenanceContracts.id, validIds),
            ),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /maintenance-contracts/bulk-toggle-active
   * Set isActive to a specific value for multiple service agreements.
   */
  fastify.post(
    "/bulk-toggle-active",
    { preHandler: [requireTenant], schema: { body: bulkToggleActiveBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids, isActive } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: maintenanceContracts.id })
        .from(maintenanceContracts)
        .where(
          and(
            eq(maintenanceContracts.tenantId, tenantId),
            inArray(maintenanceContracts.id, ids),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .update(maintenanceContracts)
          .set({ isActive, updatedAt: new Date() })
          .where(
            and(
              eq(maintenanceContracts.tenantId, tenantId),
              inArray(maintenanceContracts.id, validIds),
            ),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );
};
export default maintenanceContractRoutes;
