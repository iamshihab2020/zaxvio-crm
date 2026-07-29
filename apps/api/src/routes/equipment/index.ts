import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import {
  getDb,
  equipment,
  refrigerantLogs,
  customers,
  customerActivities,
  jobs,
  quotes,
  maintenanceContracts,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  isNull,
  isNotNull,
  inArray,
} from "@hvac-saas/database";
import {
  idParam,
  equipmentListQuery,
  refrigerantLogListQuery,
  createEquipmentBody,
  updateEquipmentBody,
  addRefrigerantLogBody,
} from "../../lib/schemas/equipment.js";
import { containsPattern } from "../../lib/search.js";

const equipmentRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /equipment
   * List equipment with search, pagination, optional customerId filter.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: equipmentListQuery },
    },
    async (request, reply) => {
      const {
        search = "",
        page,
        limit,
        customerId,
        sortBy,
        sortOrder,
        showArchived,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const filters = [eq(equipment.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(equipment.archivedAt) : isNull(equipment.archivedAt));

      if (customerId) {
        filters.push(eq(equipment.customerId, customerId));
      }

      if (search) {
        filters.push(
          or(
            ilike(equipment.equipmentType, containsPattern(search)),
            ilike(equipment.brand, containsPattern(search)),
            ilike(equipment.model, containsPattern(search)),
            ilike(equipment.serialNumber, containsPattern(search)),
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
      const sortCol = sortColumnMap[sortBy] ?? equipment.createdAt;
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
    {
      preHandler: [requireTenant],
      schema: { body: createEquipmentBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;

      // Verify customer belongs to tenant
      const db = getDb();
      const customer = await db
        .select({ id: customers.id, firstName: customers.firstName, lastName: customers.lastName })
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

      const [item] = await db
        .insert(equipment)
        .values({
          tenantId,
          customerId: body.customerId,
          equipmentType: body.equipmentType,
          brand: body.brand ?? null,
          model: body.model ?? null,
          serialNumber: body.serialNumber ?? null,
          installDate: body.installDate ?? null,
          warrantyExpiry: body.warrantyExpiry ?? null,
          location: body.location ?? null,
          notes: body.notes ?? null,
        })
        .returning();

      // Log customer activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: body.customerId,
        type: "equipment.created",
        description: `Asset added: ${body.equipmentType}${body.brand ? ` (${body.brand})` : ""}`,
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateEquipmentBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
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
          const newVal = body[field] ?? null;
          if (newVal !== existing[field]) {
            updates[field] = newVal;
            changedFields.push(field);
          }
        }
      }

      const dateFields = ["installDate", "warrantyExpiry"] as const;
      for (const field of dateFields) {
        if (body[field] !== undefined) {
          const newVal = body[field] ?? null;
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: refrigerantLogListQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { page, limit } = request.query;
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

      const pageNum = page;
      const limitNum = limit;
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: addRefrigerantLogBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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

      const [log] = await db
        .insert(refrigerantLogs)
        .values({
          tenantId,
          equipmentId: id,
          jobId: body.jobId ?? null,
          refrigerantType: body.refrigerantType,
          action: body.action,
          quantity: String(body.quantity),
          unit: body.unit,
          technicianName: body.technicianName ?? null,
          epaCertNumber: body.epaCertNumber ?? null,
          notes: body.notes ?? null,
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
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

      const [serviceJobs, agreements, relatedQuotes, logs] = await Promise.all([
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
          .select({
            id: quotes.id,
            quoteNumber: quotes.quoteNumber,
            status: quotes.status,
            issuedDate: quotes.issuedDate,
            totalAmount: quotes.totalAmount,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
          .where(
            and(
              eq(quotes.tenantId, tenantId),
              eq(quotes.equipmentId, id),
            ),
          )
          .orderBy(desc(quotes.createdAt))
          .limit(50),
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
          quotes: relatedQuotes,
          refrigerantLogs: logs,
        },
      });
    },
  );
  /**
   * POST /equipment/bulk-archive
   * Soft-archive multiple equipment items by setting archivedAt.
   */
  fastify.post(
    "/bulk-archive",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(
            eq(equipment.tenantId, tenantId),
            inArray(equipment.id, ids),
            isNull(equipment.archivedAt),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found or already archived",
      }));

      if (validIds.length > 0) {
        await db
          .update(equipment)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(equipment.tenantId, tenantId), inArray(equipment.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /equipment/bulk-restore
   * Restore multiple archived equipment items by clearing archivedAt.
   */
  fastify.post(
    "/bulk-restore",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(
            eq(equipment.tenantId, tenantId),
            inArray(equipment.id, ids),
            isNotNull(equipment.archivedAt),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found or not archived",
      }));

      if (validIds.length > 0) {
        await db
          .update(equipment)
          .set({ archivedAt: null, updatedAt: new Date() })
          .where(
            and(eq(equipment.tenantId, tenantId), inArray(equipment.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /equipment/bulk-delete
   * Hard delete multiple equipment items.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: equipment.id })
        .from(equipment)
        .where(
          and(eq(equipment.tenantId, tenantId), inArray(equipment.id, ids)),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .delete(equipment)
          .where(
            and(eq(equipment.tenantId, tenantId), inArray(equipment.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );
};
export default equipmentRoutes;
