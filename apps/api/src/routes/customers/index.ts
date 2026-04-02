import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { idParam } from "../../lib/schemas/common.js";
import { assignTagBody, tagIdParam } from "../../lib/schemas/customers.js";
import {
  getDb,
  customers,
  customerNotes,
  customerActivities,
  customerTags,
  tags,
  user,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
} from "@hvac-saas/database";

export default async function customerRoutes(fastify: FastifyInstance) {
  /**
   * GET /customers
   * List customers with search, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        page = "1",
        limit = "20",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const baseFilter = eq(customers.tenantId, tenantId);

      const searchFilter = search
        ? or(
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
            ilike(customers.email, `%${search}%`),
            ilike(customers.phone, `%${search}%`),
          )
        : undefined;

      const whereClause = searchFilter
        ? and(baseFilter, searchFilter)
        : baseFilter;

      // Determine sort column
      const sortColumnMap = {
        createdAt: customers.createdAt,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
      } as const;
      const sortCol = sortColumnMap[sortBy as keyof typeof sortColumnMap] ?? customers.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customers)
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
   * POST /customers
   * Create a new customer + log activity.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;

      if (!body.firstName || !body.lastName) {
        return reply
          .status(400)
          .send({ message: "firstName and lastName are required" });
      }

      const db = getDb();
      const [customer] = await db
        .insert(customers)
        .values({
          tenantId,
          firstName: body.firstName as string,
          lastName: body.lastName as string,
          email: (body.email as string) || null,
          phone: (body.phone as string) || null,
          address: (body.address as string) || null,
          city: (body.city as string) || null,
          state: (body.state as string) || null,
          zipCode: (body.zipCode as string) || null,
          notes: (body.notes as string) || null,
        })
        .returning();

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: customer.id,
        type: "customer.created",
        description: `Customer ${customer.firstName} ${customer.lastName} was created`,
        performedBy: userId,
      });

      emitPlatformEvent(tenantId, "customer_created", userId);

      dispatchNotification({
        tenantId,
        type: "customer_created",
        title: `New customer: ${customer.firstName} ${customer.lastName}`,
        description: `${customer.firstName} ${customer.lastName} was added to your customer list`,
        entityType: "customer",
        entityId: customer.id,
        actorId: userId,
        metadata: { customerName: `${customer.firstName} ${customer.lastName}` },
      });

      return reply.status(201).send({ data: customer });
    },
  );

  /**
   * GET /customers/:id
   * Get a single customer by ID.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const customer = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);

      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      return reply.send({ data: customer });
    },
  );

  /**
   * PATCH /customers/:id
   * Update a customer + log activity with changed fields.
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

      // Fetch existing for comparison
      const existing = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      const allowedFields = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zipCode",
        "notes",
      ] as const;

      const fieldLabels: Record<string, string> = {
        firstName: "First Name",
        lastName: "Last Name",
        email: "Email",
        phone: "Phone",
        address: "Address",
        city: "City",
        state: "State",
        zipCode: "ZIP Code",
        notes: "Notes",
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const changedFields: string[] = [];

      for (const field of allowedFields) {
        if (field in body) {
          const oldVal = existing[field] ?? "";
          const newVal = body[field] ?? "";
          if (oldVal !== newVal) {
            changedFields.push(field);
          }
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(customers)
        .set(updates)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .returning();

      // Log activity if fields actually changed
      if (changedFields.length > 0) {
        const readableFields = changedFields
          .map((f) => fieldLabels[f] ?? f)
          .join(", ");
        await db.insert(customerActivities).values({
          tenantId,
          customerId: id,
          type: "customer.updated",
          description: `Updated ${readableFields}`,
          metadata: { changedFields },
          performedBy: userId,
        });
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /customers/:id
   * Delete a customer (hard delete, cascades via FK).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      await db
        .delete(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));

      return reply.send({ message: "Customer deleted" });
    },
  );

  // ===== NOTES SUB-RESOURCE =====

  /**
   * GET /customers/:id/notes
   * List notes for a customer (newest first, with author name).
   */
  fastify.get(
    "/:id/notes",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const { page = "1", limit = "20" } = request.query as Record<string, string>;
      const db = getDb();

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClause = and(
        eq(customerNotes.tenantId, tenantId),
        eq(customerNotes.customerId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: customerNotes.id,
            customerId: customerNotes.customerId,
            content: customerNotes.content,
            createdBy: customerNotes.createdBy,
            createdAt: customerNotes.createdAt,
            updatedAt: customerNotes.updatedAt,
            authorName: user.name,
          })
          .from(customerNotes)
          .leftJoin(user, eq(customerNotes.createdBy, user.id))
          .where(whereClause)
          .orderBy(desc(customerNotes.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customerNotes)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalResult[0]?.total ?? 0,
        },
      });
    },
  );

  /**
   * POST /customers/:id/notes
   * Create a note + log activity.
   */
  fastify.post(
    "/:id/notes",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;

      if (!body.content || typeof body.content !== "string" || !body.content.trim()) {
        return reply.status(400).send({ message: "content is required" });
      }

      const db = getDb();

      const [note] = await db
        .insert(customerNotes)
        .values({
          tenantId,
          customerId: id,
          content: body.content.trim(),
          createdBy: userId,
        })
        .returning();

      // Log activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: id,
        type: "note.created",
        description: "Added a note",
        performedBy: userId,
      });

      return reply.status(201).send({ data: note });
    },
  );

  /**
   * PATCH /customers/:id/notes/:noteId
   * Update a note's content.
   */
  fastify.patch(
    "/:id/notes/:noteId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, noteId } = request.params as { id: string; noteId: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      const existing = await db
        .select({ id: customerNotes.id })
        .from(customerNotes)
        .where(
          and(
            eq(customerNotes.tenantId, tenantId),
            eq(customerNotes.customerId, id),
            eq(customerNotes.id, noteId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Note not found" });
      }

      const [updated] = await db
        .update(customerNotes)
        .set({
          content: (body.content as string).trim(),
          updatedAt: new Date(),
        })
        .where(eq(customerNotes.id, noteId))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /customers/:id/notes/:noteId
   * Delete a note.
   */
  fastify.delete(
    "/:id/notes/:noteId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, noteId } = request.params as { id: string; noteId: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: customerNotes.id })
        .from(customerNotes)
        .where(
          and(
            eq(customerNotes.tenantId, tenantId),
            eq(customerNotes.customerId, id),
            eq(customerNotes.id, noteId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Note not found" });
      }

      await db.delete(customerNotes).where(eq(customerNotes.id, noteId));

      return reply.send({ message: "Note deleted" });
    },
  );

  // ===== ACTIVITIES SUB-RESOURCE =====

  /**
   * GET /customers/:id/activities
   * List activities for a customer (newest first, with performer name).
   */
  fastify.get(
    "/:id/activities",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const { page = "1", limit = "20" } = request.query as Record<string, string>;
      const db = getDb();

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClause = and(
        eq(customerActivities.tenantId, tenantId),
        eq(customerActivities.customerId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: customerActivities.id,
            customerId: customerActivities.customerId,
            type: customerActivities.type,
            description: customerActivities.description,
            metadata: customerActivities.metadata,
            performedBy: customerActivities.performedBy,
            createdAt: customerActivities.createdAt,
            performerName: user.name,
          })
          .from(customerActivities)
          .leftJoin(user, eq(customerActivities.performedBy, user.id))
          .where(whereClause)
          .orderBy(desc(customerActivities.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customerActivities)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalResult[0]?.total ?? 0,
        },
      });
    },
  );

  // ===== TAGS SUB-RESOURCE =====

  /**
   * GET /customers/:id/tags
   * List tags assigned to this customer.
   */
  fastify.get(
    "/:id/tags",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify customer belongs to this tenant
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);
      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      const data = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          assignedAt: customerTags.createdAt,
        })
        .from(customerTags)
        .innerJoin(tags, eq(customerTags.tagId, tags.id))
        .where(
          and(
            eq(customerTags.customerId, id),
            eq(tags.tenantId, tenantId),
          ),
        )
        .orderBy(tags.name);

      return reply.send({ data });
    },
  );

  /**
   * POST /customers/:id/tags
   * Assign a tag to a customer.
   */
  fastify.post(
    "/:id/tags",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: assignTagBody },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { tagId } = request.body as { tagId: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify customer belongs to this tenant
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);
      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      // Verify tag belongs to this tenant
      const tag = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, tagId)))
        .then((r) => r[0]);
      if (!tag) {
        return reply.status(404).send({ message: "Tag not found" });
      }

      const [assignment] = await db
        .insert(customerTags)
        .values({
          customerId: id,
          tagId,
        })
        .onConflictDoNothing()
        .returning();

      return reply.status(201).send({ data: assignment ?? { message: "Already assigned" } });
    },
  );

  /**
   * DELETE /customers/:id/tags/:tagId
   * Remove a tag from a customer.
   */
  fastify.delete(
    "/:id/tags/:tagId",
    {
      preHandler: [requireTenant],
      schema: { params: tagIdParam },
    },
    async (request, reply) => {
      const { id, tagId } = request.params as { id: string; tagId: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify customer belongs to this tenant
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);
      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      await db
        .delete(customerTags)
        .where(
          and(
            eq(customerTags.customerId, id),
            eq(customerTags.tagId, tagId),
          ),
        );

      return reply.send({ message: "Tag removed" });
    },
  );
}
