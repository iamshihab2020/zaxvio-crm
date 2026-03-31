import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  equipment,
  refrigerantLogs,
  customers,
  customerActivities,
  jobs,
  maintenanceContracts,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
} from "@hvac-saas/database";

export default async function equipmentRoutes(fastify: FastifyInstance) {
  /**
   * GET /equipment
   * List equipment with search, pagination, optional customerId filter.
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
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(equipment.tenantId, tenantId)];

      if (customerId) {
        filters.push(eq(equipment.customerId, customerId));
      }

      if (search) {
        filters.push(
          or(
            ilike(equipment.equipmentType, `%${search}%`),
            ilike(equipment.brand, `%${search}%`),
            ilike(equipment.model, `%${search}%`),
            ilike(equipment.serialNumber, `%${search}%`),
          )!,
        );
      }

      const whereClause = and(...filters);

      const sortColumnMap = {
        createdAt: equipment.createdAt,
        equipmentType: equipment.equipmentType,
        brand: equipment.brand,
        installDate: equipment.installDate,
        warrantyExpiry: equipment.warrantyExpiry,
      } as const;
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
        equipment.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: equipment.id,
            tenantId: equipment.tenantId,
            customerId: equipment.customerId,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
            equipmentType: equipment.equipmentType,
            brand: equipment.brand,
            model: equipment.model,
            serialNumber: equipment.serialNumber,
            installDate: equipment.installDate,
            warrantyExpiry: equipment.warrantyExpiry,
            location: equipment.location,
            notes: equipment.notes,
            createdAt: equipment.createdAt,
            updatedAt: equipment.updatedAt,
          })
          .from(equipment)
          .leftJoin(customers, eq(equipment.customerId, customers.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(equipment)
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
   * GET /equipment/:id
   * Get a single equipment item.
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
          id: equipment.id,
          tenantId: equipment.tenantId,
          customerId: equipment.customerId,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          equipmentType: equipment.equipmentType,
          brand: equipment.brand,
          model: equipment.model,
          serialNumber: equipment.serialNumber,
          installDate: equipment.installDate,
          warrantyExpiry: equipment.warrantyExpiry,
          location: equipment.location,
          notes: equipment.notes,
          createdAt: equipment.createdAt,
          updatedAt: equipment.updatedAt,
        })
        .from(equipment)
        .leftJoin(customers, eq(equipment.customerId, customers.id))
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!item) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      return reply.send({ data: item });
    },
  );

  /**
   * POST /equipment
   * Create a new equipment item.
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
        !body.equipmentType ||
        typeof body.equipmentType !== "string" ||
        !body.equipmentType.trim()
      ) {
        return reply.status(400).send({ message: "equipmentType is required" });
      }

      // Verify customer belongs to tenant
      const db = getDb();
      const customer = await db
        .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
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

      const [item] = await db
        .insert(equipment)
        .values({
          tenantId,
          customerId: body.customerId as string,
          equipmentType: (body.equipmentType as string).trim(),
          brand: body.brand ? (body.brand as string).trim() : null,
          model: body.model ? (body.model as string).trim() : null,
          serialNumber: body.serialNumber
            ? (body.serialNumber as string).trim()
            : null,
          installDate: body.installDate
            ? (body.installDate as string)
            : null,
          warrantyExpiry: body.warrantyExpiry
            ? (body.warrantyExpiry as string)
            : null,
          location: body.location
            ? (body.location as string).trim()
            : null,
          notes: body.notes ? (body.notes as string).trim() : null,
        })
        .returning();

      // Log customer activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: body.customerId as string,
        type: "equipment.created",
        description: `Asset added: ${(body.equipmentType as string).trim()}${body.brand ? ` (${body.brand})` : ""}`,
        performedBy: userId,
      });

      return reply.status(201).send({ data: item });
    },
  );

  /**
   * PATCH /equipment/:id
   * Update an equipment item.
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
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      const updates: Record<string, unknown> = {};
      const changedFields: string[] = [];

      const stringFields = [
        "equipmentType",
        "brand",
        "model",
        "serialNumber",
        "location",
        "notes",
      ] as const;

      for (const field of stringFields) {
        if (body[field] !== undefined) {
          const newVal = body[field]
            ? (body[field] as string).trim()
            : null;
          if (newVal !== existing[field]) {
            updates[field] = newVal;
            changedFields.push(field);
          }
        }
      }

      const dateFields = ["installDate", "warrantyExpiry"] as const;
      for (const field of dateFields) {
        if (body[field] !== undefined) {
          const newVal = body[field] ? (body[field] as string) : null;
          if (newVal !== existing[field]) {
            updates[field] = newVal;
            changedFields.push(field);
          }
        }
      }

      if (changedFields.length === 0) {
        return reply.status(400).send({ message: "No fields to update" });
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(equipment)
        .set(updates)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .returning();

      // Log customer activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: existing.customerId,
        type: "equipment.updated",
        description: `Asset updated: ${updated.equipmentType}`,
        metadata: { changedFields },
        performedBy: userId,
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /equipment/:id
   * Hard delete an equipment item.
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
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      await db
        .delete(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        );

      // Log customer activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: existing.customerId,
        type: "equipment.deleted",
        description: `Asset removed: ${existing.equipmentType}${existing.brand ? ` (${existing.brand})` : ""}`,
        performedBy: userId,
      });

      return reply.send({ message: "Equipment deleted" });
    },
  );

  // =============================================
  // Refrigerant Logs (sub-resource of equipment)
  // =============================================

  /**
   * GET /equipment/:id/refrigerant-logs
   * List refrigerant logs for a specific equipment item.
   */
  fastify.get(
    "/:id/refrigerant-logs",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { page = "1", limit = "20" } = request.query as Record<
        string,
        string
      >;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify equipment exists and belongs to tenant
      const equip = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!equip) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClause = and(
        eq(refrigerantLogs.tenantId, tenantId),
        eq(refrigerantLogs.equipmentId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(refrigerantLogs)
          .where(whereClause)
          .orderBy(desc(refrigerantLogs.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(refrigerantLogs)
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
   * POST /equipment/:id/refrigerant-logs
   * Create a refrigerant log entry for equipment.
   */
  fastify.post(
    "/:id/refrigerant-logs",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      // Verify equipment exists and belongs to tenant
      const equip = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!equip) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      if (
        !body.refrigerantType ||
        typeof body.refrigerantType !== "string" ||
        !body.refrigerantType.trim()
      ) {
        return reply
          .status(400)
          .send({ message: "refrigerantType is required" });
      }

      const validActions = ["added", "recovered", "recycled"];
      if (!body.action || !validActions.includes(body.action as string)) {
        return reply.status(400).send({
          message:
            "action is required and must be one of: added, recovered, recycled",
        });
      }

      if (body.quantity === undefined || body.quantity === null) {
        return reply.status(400).send({ message: "quantity is required" });
      }
      const qty = parseFloat(String(body.quantity));
      if (isNaN(qty) || qty <= 0) {
        return reply
          .status(400)
          .send({ message: "quantity must be a positive number" });
      }

      const [log] = await db
        .insert(refrigerantLogs)
        .values({
          tenantId,
          equipmentId: id,
          jobId: body.jobId ? (body.jobId as string) : null,
          refrigerantType: (body.refrigerantType as string).trim(),
          action: body.action as "added" | "recovered" | "recycled",
          quantity: String(qty),
          unit: body.unit ? (body.unit as string).trim() : "lbs",
          technicianName: body.technicianName
            ? (body.technicianName as string).trim()
            : null,
          epaCertNumber: body.epaCertNumber
            ? (body.epaCertNumber as string).trim()
            : null,
          notes: body.notes ? (body.notes as string).trim() : null,
        })
        .returning();

      return reply.status(201).send({ data: log });
    },
  );

  // =============================================
  // Service History (aggregated timeline)
  // =============================================

  /**
   * GET /equipment/:id/history
   * Service history: linked jobs, agreements, and refrigerant logs.
   */
  fastify.get(
    "/:id/history",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify equipment exists
      const equip = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), eq(equipment.id, id)),
        )
        .then((r) => r[0]);

      if (!equip) {
        return reply.status(404).send({ message: "Equipment not found" });
      }

      const [serviceJobs, agreements, logs] = await Promise.all([
        db
          .select({
            id: jobs.id,
            jobNumber: jobs.jobNumber,
            title: jobs.title,
            status: jobs.status,
            serviceType: jobs.serviceType,
            scheduledDate: jobs.scheduledDate,
            completedAt: jobs.completedAt,
            totalAmount: jobs.totalAmount,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .where(
            and(
              eq(jobs.tenantId, tenantId),
              eq(jobs.equipmentId, id),
            ),
          )
          .orderBy(desc(jobs.scheduledDate))
          .limit(50),
        db
          .select({
            id: maintenanceContracts.id,
            contractName: maintenanceContracts.contractName,
            startDate: maintenanceContracts.startDate,
            endDate: maintenanceContracts.endDate,
            frequency: maintenanceContracts.frequency,
            isActive: maintenanceContracts.isActive,
            annualPrice: maintenanceContracts.annualPrice,
          })
          .from(maintenanceContracts)
          .where(
            and(
              eq(maintenanceContracts.tenantId, tenantId),
              eq(maintenanceContracts.equipmentId, id),
            ),
          )
          .orderBy(desc(maintenanceContracts.createdAt)),
        db
          .select()
          .from(refrigerantLogs)
          .where(
            and(
              eq(refrigerantLogs.tenantId, tenantId),
              eq(refrigerantLogs.equipmentId, id),
            ),
          )
          .orderBy(desc(refrigerantLogs.createdAt))
          .limit(50),
      ]);

      return reply.send({
        data: {
          jobs: serviceJobs,
          agreements,
          refrigerantLogs: logs,
        },
      });
    },
  );
}
