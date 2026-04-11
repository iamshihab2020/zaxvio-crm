import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { idParam, paginationQuery } from "../../lib/schemas/common.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import {
  assignTagBody,
  createCustomerBody,
  createNoteBody,
  customerListQuery,
  noteIdParam,
  tagIdParam,
  updateCustomerBody,
  updateNoteBody,
} from "../../lib/schemas/customers.js";
import {
  getDb,
  customers,
  customerNotes,
  customerActivities,
  customerTags,
  tags,
  jobPhotos,
  jobs,
  user,
  eq,
  and,
  or,
  ilike,
  isNull,
  isNotNull,
  inArray,
  desc,
  asc,
  count,
  sql,
} from "@hvac-saas/database";

const customerRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /customers
   * List customers with search, pagination, sorting.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: customerListQuery },
    },
    async (request, reply) => {
      const { search = "", page, limit, sortBy, sortOrder, showArchived } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const offset = (page - 1) * limit;

      const baseFilter = eq(customers.tenantId, tenantId);
      const archiveFilter = showArchived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt);

      const searchFilter = search
        ? or(
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
            ilike(customers.email, `%${search}%`),
            ilike(customers.phone, `%${search}%`),
          )
        : undefined;

      const whereClause = and(baseFilter, archiveFilter, searchFilter);

      const sortColumnMap = {
        createdAt: customers.createdAt,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
      } as const;
      const sortCol = sortColumnMap[sortBy] ?? customers.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limit)
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
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * GET /customers/stats
   * Aggregate customer counts in a single query.
   */
  fastify.get(
    "/stats",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const [result] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          withEmail: sql<number>`COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')`,
          withPhone: sql<number>`COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '')`,
          withAddress: sql<number>`COUNT(*) FILTER (WHERE address IS NOT NULL OR city IS NOT NULL)`,
        })
        .from(customers)
        .where(eq(customers.tenantId, tenantId));

      return reply.send({
        data: {
          total: Number(result.total),
          withEmail: Number(result.withEmail),
          withPhone: Number(result.withPhone),
          withAddress: Number(result.withAddress),
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
    {
      preHandler: [requireTenant],
      schema: { body: createCustomerBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { firstName, lastName, email, phone, address, city, state, zipCode, notes } = request.body;

      const db = getDb();
      const [customer] = await db
        .insert(customers)
        .values({
          tenantId,
          firstName,
          lastName,
          email: email || null,
          phone: phone || null,
          address: address || null,
          city: city || null,
          state: state || null,
          zipCode: zipCode || null,
          notes: notes || null,
        })
        .returning();

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
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateCustomerBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body;
      const db = getDb();

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
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
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

  // ===== BULK OPERATIONS =====

  /**
   * POST /customers/bulk-archive
   * Archive multiple customers (set archived_at).
   */
  fastify.post(
    "/bulk-archive",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, ids), isNull(customers.archivedAt)));

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(customers)
          .set({ archivedAt: new Date() })
          .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, eligibleIds)));
      }

      const errors = skippedCount > 0
        ? [{ id: "N/A", message: `${skippedCount} customer(s) already archived or not found` }]
        : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /customers/bulk-restore
   * Restore multiple archived customers.
   */
  fastify.post(
    "/bulk-restore",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, ids), isNotNull(customers.archivedAt)));

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(customers)
          .set({ archivedAt: null })
          .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, eligibleIds)));
      }

      const errors = skippedCount > 0
        ? [{ id: "N/A", message: `${skippedCount} customer(s) not archived or not found` }]
        : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /customers/bulk-delete
   * Permanently delete multiple customers.
   */
  fastify.post(
    "/bulk-delete",
    {
      preHandler: [requireTenant],
      schema: { body: bulkIdsBody },
    },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, ids)));

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .delete(customers)
          .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, eligibleIds)));
      }

      const errors = skippedCount > 0
        ? [{ id: "N/A", message: `${skippedCount} customer(s) not found` }]
        : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  // ===== NOTES SUB-RESOURCE =====

  /**
   * GET /customers/:id/notes
   * List notes for a customer (newest first, with author name).
   */
  fastify.get(
    "/:id/notes",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: paginationQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { page, limit } = request.query;
      const db = getDb();

      const offset = (page - 1) * limit;

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
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customerNotes)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page,
          limit,
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: createNoteBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { content } = request.body;

      const db = getDb();

      const [note] = await db
        .insert(customerNotes)
        .values({
          tenantId,
          customerId: id,
          content,
          createdBy: userId,
        })
        .returning();

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
    {
      preHandler: [requireTenant],
      schema: { params: noteIdParam, body: updateNoteBody },
    },
    async (request, reply) => {
      const { id, noteId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { content } = request.body;
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
        .set({ content, updatedAt: new Date() })
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
    {
      preHandler: [requireTenant],
      schema: { params: noteIdParam },
    },
    async (request, reply) => {
      const { id, noteId } = request.params;
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
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: paginationQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { page, limit } = request.query;
      const db = getDb();

      const offset = (page - 1) * limit;

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
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customerActivities)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page,
          limit,
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
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

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
      const { id } = request.params;
      const { tagId } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);
      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

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
        .values({ customerId: id, tagId })
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
      const { id, tagId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

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

  // ===== PHOTOS =====

  /**
   * GET /customers/:id/photos
   * All photos across all jobs for a customer, newest first.
   */
  fastify.get(
    "/:id/photos",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

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
          id: jobPhotos.id,
          jobId: jobPhotos.jobId,
          storagePath: jobPhotos.storagePath,
          caption: jobPhotos.caption,
          tag: jobPhotos.tag,
          uploadedBy: jobPhotos.uploadedBy,
          fileSize: jobPhotos.fileSize,
          takenAt: jobPhotos.takenAt,
          createdAt: jobPhotos.createdAt,
          uploaderName: user.name,
          jobTitle: jobs.title,
          jobScheduledDate: jobs.scheduledDate,
          jobNumber: jobs.jobNumber,
        })
        .from(jobPhotos)
        .innerJoin(jobs, eq(jobPhotos.jobId, jobs.id))
        .leftJoin(user, eq(jobPhotos.uploadedBy, user.id))
        .where(
          and(
            eq(jobPhotos.tenantId, tenantId),
            eq(jobs.customerId, id),
          ),
        )
        .orderBy(desc(jobPhotos.createdAt));

      return reply.send({ data });
    },
  );
};
export default customerRoutes;
