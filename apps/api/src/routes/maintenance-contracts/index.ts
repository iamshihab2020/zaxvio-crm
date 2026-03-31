import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
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
} from "@hvac-saas/database";

const VALID_FREQUENCIES = [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
] as const;

type Frequency = (typeof VALID_FREQUENCIES)[number];

export default async function maintenanceContractRoutes(
  fastify: FastifyInstance,
) {
  /**
   * GET /maintenance-contracts
   * List contracts with search, pagination, filtering.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        page = "1",
        limit = "20",
        customerId,
        equipmentId,
        isActive,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(maintenanceContracts.tenantId, tenantId)];

      if (customerId) {
        filters.push(eq(maintenanceContracts.customerId, customerId));
      }

      if (equipmentId) {
        filters.push(eq(maintenanceContracts.equipmentId, equipmentId));
      }

      if (isActive === "true") {
        filters.push(eq(maintenanceContracts.isActive, true));
      } else if (isActive === "false") {
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
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
        maintenanceContracts.createdAt;
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { days = "30" } = request.query as Record<string, string>;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const daysNum = Math.max(1, parseInt(days, 10) || 30);

      const today = new Date().toISOString().split("T")[0];
      const futureDate = new Date(
        Date.now() + daysNum * 24 * 60 * 60 * 1000,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;

      if (!body.customerId || typeof body.customerId !== "string") {
        return reply.status(400).send({ message: "customerId is required" });
      }
      if (
        !body.contractName ||
        typeof body.contractName !== "string" ||
        !body.contractName.trim()
      ) {
        return reply
          .status(400)
          .send({ message: "contractName is required" });
      }
      if (!body.startDate || typeof body.startDate !== "string") {
        return reply.status(400).send({ message: "startDate is required" });
      }
      if (!body.endDate || typeof body.endDate !== "string") {
        return reply.status(400).send({ message: "endDate is required" });
      }

      const db = getDb();

      // Verify customer
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            eq(customers.id, body.customerId as string),
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
              eq(equipment.id, body.equipmentId as string),
            ),
          )
          .then((r) => r[0]);

        if (!equip) {
          return reply.status(404).send({ message: "Equipment not found" });
        }
      }

      // Validate frequency
      let frequency: Frequency | undefined;
      if (body.frequency) {
        if (
          !VALID_FREQUENCIES.includes(body.frequency as Frequency)
        ) {
          return reply.status(400).send({
            message: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`,
          });
        }
        frequency = body.frequency as Frequency;
      }

      const [item] = await db
        .insert(maintenanceContracts)
        .values({
          tenantId,
          customerId: body.customerId as string,
          equipmentId: body.equipmentId
            ? (body.equipmentId as string)
            : null,
          contractName: (body.contractName as string).trim(),
          startDate: body.startDate as string,
          endDate: body.endDate as string,
          frequency: frequency ?? "annual",
          visitsPerYear: body.visitsPerYear
            ? parseInt(String(body.visitsPerYear), 10)
            : 2,
          annualPrice: body.annualPrice
            ? String(parseFloat(String(body.annualPrice)))
            : null,
          notes: body.notes ? (body.notes as string).trim() : null,
        })
        .returning();

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: body.customerId as string,
        type: "agreement.created",
        description: `Service agreement created: ${(body.contractName as string).trim()}`,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;
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
        const val = (body.contractName as string).trim();
        if (val !== existing.contractName) {
          updates.contractName = val;
          changedFields.push("contractName");
        }
      }

      for (const field of ["startDate", "endDate"] as const) {
        if (body[field] !== undefined) {
          const val = body[field] as string;
          if (val !== existing[field]) {
            updates[field] = val;
            changedFields.push(field);
          }
        }
      }

      if (body.frequency !== undefined) {
        if (
          !VALID_FREQUENCIES.includes(body.frequency as Frequency)
        ) {
          return reply.status(400).send({
            message: `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`,
          });
        }
        if (body.frequency !== existing.frequency) {
          updates.frequency = body.frequency;
          changedFields.push("frequency");
        }
      }

      if (body.visitsPerYear !== undefined) {
        const val = parseInt(String(body.visitsPerYear), 10);
        if (val !== existing.visitsPerYear) {
          updates.visitsPerYear = val;
          changedFields.push("visitsPerYear");
        }
      }

      if (body.annualPrice !== undefined) {
        const val = body.annualPrice
          ? String(parseFloat(String(body.annualPrice)))
          : null;
        if (val !== existing.annualPrice) {
          updates.annualPrice = val;
          changedFields.push("annualPrice");
        }
      }

      if (body.equipmentId !== undefined) {
        const val = body.equipmentId ? (body.equipmentId as string) : null;
        if (val !== existing.equipmentId) {
          updates.equipmentId = val;
          changedFields.push("equipmentId");
        }
      }

      if (body.isActive !== undefined) {
        const val = Boolean(body.isActive);
        if (val !== existing.isActive) {
          updates.isActive = val;
          changedFields.push("isActive");
        }
      }

      if (body.notes !== undefined) {
        const val = body.notes ? (body.notes as string).trim() : null;
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
}
