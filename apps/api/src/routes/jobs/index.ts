import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  jobs,
  jobLineItems,
  jobPhotos,
  jobActivities,
  jobChecklistCompletions,
  checklistTemplates,
  checklistItems,
  catalogItems,
  customers,
  customerActivities,
  equipment,
  tenants,
  user,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
  gte,
  lte,
} from "@hvac-saas/database";
import { getSupabaseAdmin } from "@hvac-saas/database";
import { attachChecklistToJob } from "../../lib/job-helpers.js";
import {
  updateLineItemBody,
  lineItemParam,
  photoParam,
  addPhotoBody,
} from "../../lib/schemas/jobs.js";

// ========== HELPERS ==========

async function recalculateJobTotals(
  db: ReturnType<typeof getDb>,
  jobId: string,
  tenantId: string,
) {
  // Sum all line items (quantity * unit_price since total is generated)
  const result = await db
    .select({
      subtotal: sql<string>`COALESCE(SUM(quantity * unit_price), 0)`,
    })
    .from(jobLineItems)
    .where(
      and(eq(jobLineItems.jobId, jobId), eq(jobLineItems.tenantId, tenantId)),
    );

  const subtotal = result[0]?.subtotal ?? "0";

  // Get job's tax rate
  const [job] = await db
    .select({ taxRate: jobs.taxRate })
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));

  const taxRate = parseFloat(job?.taxRate ?? "0");
  const subtotalNum = parseFloat(subtotal);
  const taxAmount = subtotalNum * taxRate;
  const totalAmount = subtotalNum + taxAmount;

  await db
    .update(jobs)
    .set({
      subtotal: subtotalNum.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.tenantId, tenantId)));
}

// ========== ROUTES ==========

export default async function jobRoutes(fastify: FastifyInstance) {
  // ===== JOBS CRUD =====

  /**
   * GET /jobs
   * List jobs with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        status,
        customerId,
        serviceType,
        priority,
        dateFrom,
        dateTo,
        page = "1",
        limit = "20",
        sortBy = "scheduledDate",
        sortOrder = "desc",
      } = request.query as Record<string, string | undefined>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "20", 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(jobs.tenantId, tenantId)];

      if (search) {
        filters.push(
          or(
            ilike(jobs.jobNumber, `%${search}%`),
            ilike(jobs.title, `%${search}%`),
            ilike(jobs.description, `%${search}%`),
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
          )!,
        );
      }

      if (status) {
        filters.push(eq(jobs.status, status as never));
      }
      if (customerId) {
        filters.push(eq(jobs.customerId, customerId));
      }
      if (serviceType) {
        filters.push(eq(jobs.serviceType, serviceType as never));
      }
      if (priority) {
        filters.push(eq(jobs.priority, priority as never));
      }
      if (dateFrom) {
        filters.push(gte(jobs.scheduledDate, dateFrom));
      }
      if (dateTo) {
        filters.push(lte(jobs.scheduledDate, dateTo));
      }

      const whereClause = and(...filters);

      // Sort
      const sortColumnMap = {
        scheduledDate: jobs.scheduledDate,
        createdAt: jobs.createdAt,
        jobNumber: jobs.jobNumber,
        status: jobs.status,
        priority: jobs.priority,
        totalAmount: jobs.totalAmount,
      } as const;
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ?? jobs.scheduledDate;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: jobs.id,
            tenantId: jobs.tenantId,
            customerId: jobs.customerId,
            bookingId: jobs.bookingId,
            jobNumber: jobs.jobNumber,
            status: jobs.status,
            priority: jobs.priority,
            serviceType: jobs.serviceType,
            title: jobs.title,
            description: jobs.description,
            scheduledDate: jobs.scheduledDate,
            scheduledStart: jobs.scheduledStart,
            scheduledEnd: jobs.scheduledEnd,
            address: jobs.address,
            subtotal: jobs.subtotal,
            taxRate: jobs.taxRate,
            taxAmount: jobs.taxAmount,
            totalAmount: jobs.totalAmount,
            notes: jobs.notes,
            completedAt: jobs.completedAt,
            createdAt: jobs.createdAt,
            updatedAt: jobs.updatedAt,
            equipmentId: jobs.equipmentId,
            equipmentType: equipment.equipmentType,
            equipmentBrand: equipment.brand,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
          .leftJoin(equipment, eq(jobs.equipmentId, equipment.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(jobs)
          .leftJoin(customers, eq(jobs.customerId, customers.id))
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
   * GET /jobs/:id
   * Get a single job with customer, line items, checklist, photo count.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const jobRow = await db
        .select({
          id: jobs.id,
          tenantId: jobs.tenantId,
          customerId: jobs.customerId,
          bookingId: jobs.bookingId,
          jobNumber: jobs.jobNumber,
          status: jobs.status,
          priority: jobs.priority,
          serviceType: jobs.serviceType,
          title: jobs.title,
          description: jobs.description,
          scheduledDate: jobs.scheduledDate,
          scheduledStart: jobs.scheduledStart,
          scheduledEnd: jobs.scheduledEnd,
          address: jobs.address,
          subtotal: jobs.subtotal,
          taxRate: jobs.taxRate,
          taxAmount: jobs.taxAmount,
          totalAmount: jobs.totalAmount,
          notes: jobs.notes,
          completedAt: jobs.completedAt,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt,
          equipmentId: jobs.equipmentId,
          equipmentType: equipment.equipmentType,
          equipmentBrand: equipment.brand,
          equipmentModel: equipment.model,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
        })
        .from(jobs)
        .leftJoin(customers, eq(jobs.customerId, customers.id))
        .leftJoin(equipment, eq(jobs.equipmentId, equipment.id))
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!jobRow) {
        return reply.status(404).send({ message: "Job not found" });
      }

      const [lineItems, checklist, photoCountResult] = await Promise.all([
        db
          .select()
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, id),
            ),
          )
          .orderBy(asc(jobLineItems.sortOrder)),
        db
          .select({
            id: jobChecklistCompletions.id,
            checklistItemId: jobChecklistCompletions.checklistItemId,
            isCompleted: jobChecklistCompletions.isCompleted,
            completedBy: jobChecklistCompletions.completedBy,
            completedAt: jobChecklistCompletions.completedAt,
            label: checklistItems.label,
            isRequired: checklistItems.isRequired,
            catalogItemId: checklistItems.catalogItemId,
            sortOrder: checklistItems.sortOrder,
            catalogItemName: catalogItems.name,
            catalogItemPrice: catalogItems.unitPrice,
          })
          .from(jobChecklistCompletions)
          .innerJoin(
            checklistItems,
            eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
          )
          .leftJoin(
            catalogItems,
            eq(checklistItems.catalogItemId, catalogItems.id),
          )
          .where(
            and(
              eq(jobChecklistCompletions.tenantId, tenantId),
              eq(jobChecklistCompletions.jobId, id),
            ),
          )
          .orderBy(asc(checklistItems.sortOrder)),
        db
          .select({ total: count() })
          .from(jobPhotos)
          .where(
            and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.jobId, id)),
          ),
      ]);

      return reply.send({
        data: {
          ...jobRow,
          lineItems,
          checklist,
          photoCount: photoCountResult[0]?.total ?? 0,
        },
      });
    },
  );

  /**
   * POST /jobs
   * Create a new job. Auto-attaches checklist if template exists.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;

      // Validate required fields
      if (!body.customerId || !body.serviceType || !body.title || !body.scheduledDate) {
        return reply.status(400).send({
          message: "customerId, serviceType, title, and scheduledDate are required",
        });
      }

      const db = getDb();

      // Validate customer exists and belongs to tenant
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
        return reply.status(400).send({ message: "Customer not found" });
      }

      const [job] = await db
        .insert(jobs)
        .values({
          tenantId,
          customerId: body.customerId as string,
          bookingId: (body.bookingId as string) || null,
          equipmentId: (body.equipmentId as string) || null,
          jobNumber: "", // Auto-generated by DB trigger
          serviceType: body.serviceType as never,
          title: body.title as string,
          description: (body.description as string) || null,
          scheduledDate: body.scheduledDate as string,
          scheduledStart: (body.scheduledStart as string) || null,
          scheduledEnd: (body.scheduledEnd as string) || null,
          address: (body.address as string) || null,
          priority: (body.priority as never) || "standard",
          status: (body.status as string) || undefined,
          taxRate: (body.taxRate as string) || "0",
          notes: (body.notes as string) || null,
        })
        .returning();

      // Auto-attach checklist
      await attachChecklistToJob(
        db,
        job.id,
        tenantId,
        body.serviceType as string,
        userId,
      );

      // Log job activity
      await db.insert(jobActivities).values({
        tenantId,
        jobId: job.id,
        type: "job.created",
        description: `Job created for ${customer.firstName} ${customer.lastName}`,
        performedBy: userId,
      });

      // Log customer activity
      await db.insert(customerActivities).values({
        tenantId,
        customerId: body.customerId as string,
        type: "job.created",
        description: `Job ${job.jobNumber || "new"} created`,
        metadata: { jobId: job.id },
        performedBy: userId,
      });

      // Re-fetch to get auto-generated jobNumber
      const [created] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, job.id));

      emitPlatformEvent(tenantId, "job_created", userId);

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * PATCH /jobs/:id
   * Update job fields (not status — use PATCH /jobs/:id/status).
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
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Job not found" });
      }

      const allowedFields = [
        "title",
        "description",
        "priority",
        "serviceType",
        "scheduledDate",
        "scheduledStart",
        "scheduledEnd",
        "address",
        "notes",
        "taxRate",
        "equipmentId",
      ] as const;

      const fieldLabels: Record<string, string> = {
        title: "Title",
        description: "Description",
        priority: "Priority",
        serviceType: "Service Type",
        scheduledDate: "Scheduled Date",
        scheduledStart: "Scheduled Start",
        scheduledEnd: "Scheduled End",
        address: "Address",
        notes: "Notes",
        taxRate: "Tax Rate",
        equipmentId: "Asset",
      };

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      const changedFields: string[] = [];

      for (const field of allowedFields) {
        if (field in body) {
          const oldVal = existing[field] ?? "";
          const newVal = body[field] ?? "";
          if (String(oldVal) !== String(newVal)) {
            changedFields.push(field);
          }
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(jobs)
        .set(updates)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .returning();

      // Recalculate totals if tax rate changed
      if (changedFields.includes("taxRate")) {
        await recalculateJobTotals(db, id, tenantId);
      }

      // Log activity
      if (changedFields.length > 0) {
        const readableFields = changedFields
          .map((f) => fieldLabels[f] ?? f)
          .join(", ");
        await db.insert(jobActivities).values({
          tenantId,
          jobId: id,
          type: "job.updated",
          description: `Updated ${readableFields}`,
          metadata: { changedFields },
          performedBy: userId,
        });
      }

      // Re-fetch after potential recalculation
      const [final] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, id));

      return reply.send({ data: final });
    },
  );

  /**
   * PATCH /jobs/:id/status
   * Status workflow: scheduled→in_progress, scheduled→cancelled,
   * in_progress→completed (requires all required checklist items),
   * in_progress→cancelled.
   */
  fastify.patch(
    "/:id/status",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as { status: string };
      const db = getDb();

      if (!body.status) {
        return reply.status(400).send({ message: "status is required" });
      }

      const existing = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Job not found" });
      }

      // No state machine restriction — any status can move to any other
      if (existing.status === body.status) {
        return reply.status(400).send({
          message: "Job is already in that status",
        });
      }

      // Gate: completion requires all required checklist items
      if (body.status === "completed") {
        const incompleteRequired = await db
          .select({ id: jobChecklistCompletions.id })
          .from(jobChecklistCompletions)
          .innerJoin(
            checklistItems,
            eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
          )
          .where(
            and(
              eq(jobChecklistCompletions.jobId, id),
              eq(jobChecklistCompletions.tenantId, tenantId),
              eq(checklistItems.isRequired, true),
              eq(jobChecklistCompletions.isCompleted, false),
            ),
          );

        if (incompleteRequired.length > 0) {
          return reply.status(400).send({
            message: `Cannot complete job: ${incompleteRequired.length} required checklist item(s) not completed`,
          });
        }
      }

      const updateData: Record<string, unknown> = {
        status: body.status,
        updatedAt: new Date(),
      };
      if (body.status === "completed") {
        updateData.completedAt = new Date();
      }

      const [updated] = await db
        .update(jobs)
        .set(updateData)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .returning();

      // Log activity
      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "job.status_changed",
        description: `Status changed from ${existing.status} to ${body.status}`,
        metadata: { from: existing.status, to: body.status },
        performedBy: userId,
      });

      dispatchNotification({
        tenantId,
        type: "job_status_changed",
        title: `Job ${existing.jobNumber ?? ""} moved to ${body.status}`,
        description: `Job status changed from ${existing.status} to ${body.status}`,
        entityType: "job",
        entityId: id,
        actorId: userId,
        metadata: { jobNumber: existing.jobNumber, from: existing.status, to: body.status },
      });

      // E-05: Job completion email to customer (fire-and-forget)
      if (body.status === "completed" && existing.customerId) {
        const { sendJobCompletionEmail } = await import("../../lib/email.js");

        const [emailCustomer, emailTenant, emailLineItems] = await Promise.all([
          db.select().from(customers).where(eq(customers.id, existing.customerId)).then((r) => r[0]),
          db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]),
          db.select().from(jobLineItems).where(and(eq(jobLineItems.jobId, id), eq(jobLineItems.tenantId, tenantId))),
        ]);

        if (emailCustomer?.email) {
          const subtotal = emailLineItems.reduce((sum, li) => sum + Number(li.total ?? 0), 0);
          const taxRate = Number(existing.taxRate ?? 0);
          const taxAmount = subtotal * taxRate;
          const total = subtotal + taxAmount;

          sendJobCompletionEmail({
            to: emailCustomer.email,
            props: {
              customerName: `${emailCustomer.firstName} ${emailCustomer.lastName}`.trim(),
              businessName: emailTenant?.businessName ?? "HVAC Service",
              businessLogoUrl: emailTenant?.logoUrl ?? null,
              businessPhone: emailTenant?.phone ?? null,
              businessAddress: emailTenant?.address ?? null,
              jobTitle: existing.title ?? "Service",
              serviceType: existing.serviceType ?? "General",
              completedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              lineItems: emailLineItems.map((li) => ({
                description: li.description ?? "",
                quantity: Number(li.quantity ?? 1),
                unitPrice: Number(li.unitPrice ?? 0),
                total: Number(li.total ?? 0),
              })),
              subtotal,
              taxAmount,
              total,
              notes: existing.description,
            },
          }).catch((err) => console.error("[email] E-05 job completion failed:", err));
        }
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /jobs/:id
   * Hard delete a job (FK cascades clean up line items, photos, checklist, activities).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Job not found" });
      }

      await db
        .delete(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)));

      return reply.send({ message: "Job deleted" });
    },
  );

  // ===== LINE ITEMS =====

  /**
   * GET /jobs/:id/line-items
   * List all line items for a job (ordered by sortOrder).
   */
  fastify.get(
    "/:id/line-items",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select()
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
          ),
        )
        .orderBy(asc(jobLineItems.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/line-items
   * Add a line item. If catalogItemId provided, auto-fill from catalog.
   */
  fastify.post(
    "/:id/line-items",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      // Verify job exists
      const job = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!job) {
        return reply.status(404).send({ message: "Job not found" });
      }

      let description = body.description as string;
      let unitPrice = body.unitPrice as string;
      let itemType = body.itemType as string;

      // If catalogItemId provided, auto-fill from catalog
      if (body.catalogItemId) {
        const catalogItem = await db
          .select()
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.tenantId, tenantId),
              eq(catalogItems.id, body.catalogItemId as string),
            ),
          )
          .then((r) => r[0]);

        if (catalogItem) {
          description = description || catalogItem.name;
          unitPrice = unitPrice || catalogItem.unitPrice;
          itemType = itemType || catalogItem.itemType;
        }
      }

      if (!description || !unitPrice || !itemType) {
        return reply.status(400).send({
          message: "description, unitPrice, and itemType are required",
        });
      }

      const [lineItem] = await db
        .insert(jobLineItems)
        .values({
          tenantId,
          jobId: id,
          catalogItemId: (body.catalogItemId as string) || null,
          itemType: itemType as never,
          description,
          quantity: (body.quantity as string) || "1",
          unitPrice,
          sortOrder: (body.sortOrder as number) || 0,
        })
        .returning();

      await recalculateJobTotals(db, id, tenantId);

      // Log activity
      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.added",
        description: `Added line item: ${description}`,
        metadata: { lineItemId: lineItem.id },
        performedBy: userId,
      });

      return reply.status(201).send({ data: lineItem });
    },
  );

  /**
   * PATCH /jobs/:id/line-items/:lineItemId
   * Update a line item.
   */
  fastify.patch(
    "/:id/line-items/:lineItemId",
    {
      preHandler: [requireTenant],
      schema: { params: lineItemParam, body: updateLineItemBody },
    },
    async (request, reply) => {
      const { id, lineItemId } = request.params as {
        id: string;
        lineItemId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as {
        description?: string;
        quantity?: number;
        unitPrice?: number;
        sortOrder?: number;
        itemType?: string;
      };
      const db = getDb();

      const existing = await db
        .select({ id: jobLineItems.id })
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      const allowedFields = [
        "description",
        "quantity",
        "unitPrice",
        "sortOrder",
        "itemType",
      ] as const;
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(jobLineItems)
        .set(updates)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .returning();

      await recalculateJobTotals(db, id, tenantId);

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.updated",
        description: `Updated line item`,
        metadata: { lineItemId, changedFields: Object.keys(updates) },
        performedBy: userId,
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /jobs/:id/line-items/:lineItemId
   * Remove a line item + recalculate totals.
   */
  fastify.delete(
    "/:id/line-items/:lineItemId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, lineItemId } = request.params as {
        id: string;
        lineItemId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const existing = await db
        .select({ id: jobLineItems.id, description: jobLineItems.description })
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, id),
            eq(jobLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      await db.delete(jobLineItems).where(eq(jobLineItems.id, lineItemId));

      await recalculateJobTotals(db, id, tenantId);

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "line_item.removed",
        description: `Removed line item: ${existing.description}`,
        performedBy: userId,
      });

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== CHECKLIST =====

  /**
   * GET /jobs/:id/checklist
   * All completions joined with checklist items.
   */
  fastify.get(
    "/:id/checklist",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select({
          id: jobChecklistCompletions.id,
          checklistItemId: jobChecklistCompletions.checklistItemId,
          isCompleted: jobChecklistCompletions.isCompleted,
          completedBy: jobChecklistCompletions.completedBy,
          completedAt: jobChecklistCompletions.completedAt,
          label: checklistItems.label,
          isRequired: checklistItems.isRequired,
          catalogItemId: checklistItems.catalogItemId,
          sortOrder: checklistItems.sortOrder,
          catalogItemName: catalogItems.name,
          catalogItemPrice: catalogItems.unitPrice,
        })
        .from(jobChecklistCompletions)
        .innerJoin(
          checklistItems,
          eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
        )
        .leftJoin(
          catalogItems,
          eq(checklistItems.catalogItemId, catalogItems.id),
        )
        .where(
          and(
            eq(jobChecklistCompletions.tenantId, tenantId),
            eq(jobChecklistCompletions.jobId, id),
          ),
        )
        .orderBy(asc(checklistItems.sortOrder));

      return reply.send({ data });
    },
  );

  /**
   * PATCH /jobs/:id/checklist/:completionId
   * Toggle checklist item completion.
   * If completing + item has catalogItemId → auto-add line item (idempotent).
   */
  fastify.patch(
    "/:id/checklist/:completionId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, completionId } = request.params as {
        id: string;
        completionId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as { isCompleted: boolean };
      const db = getDb();

      // Fetch completion with checklist item details
      const completion = await db
        .select({
          id: jobChecklistCompletions.id,
          isCompleted: jobChecklistCompletions.isCompleted,
          checklistItemId: jobChecklistCompletions.checklistItemId,
          label: checklistItems.label,
          catalogItemId: checklistItems.catalogItemId,
        })
        .from(jobChecklistCompletions)
        .innerJoin(
          checklistItems,
          eq(jobChecklistCompletions.checklistItemId, checklistItems.id),
        )
        .where(
          and(
            eq(jobChecklistCompletions.tenantId, tenantId),
            eq(jobChecklistCompletions.jobId, id),
            eq(jobChecklistCompletions.id, completionId),
          ),
        )
        .then((r) => r[0]);

      if (!completion) {
        return reply.status(404).send({ message: "Checklist item not found" });
      }

      const isCompleted = body.isCompleted ?? !completion.isCompleted;

      await db
        .update(jobChecklistCompletions)
        .set({
          isCompleted,
          completedBy: isCompleted ? userId : null,
          completedAt: isCompleted ? new Date() : null,
        })
        .where(eq(jobChecklistCompletions.id, completionId));

      // Auto-add line item from catalog if marking complete
      if (isCompleted && completion.catalogItemId) {
        // Idempotent check: does a line item from this catalog item already exist?
        const existingLineItem = await db
          .select({ id: jobLineItems.id })
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, id),
              eq(jobLineItems.catalogItemId, completion.catalogItemId),
            ),
          )
          .then((r) => r[0]);

        if (!existingLineItem) {
          const catalogItem = await db
            .select()
            .from(catalogItems)
            .where(eq(catalogItems.id, completion.catalogItemId))
            .then((r) => r[0]);

          if (catalogItem) {
            await db.insert(jobLineItems).values({
              tenantId,
              jobId: id,
              catalogItemId: catalogItem.id,
              itemType: catalogItem.itemType,
              description: catalogItem.name,
              quantity: "1",
              unitPrice: catalogItem.unitPrice,
            });

            await recalculateJobTotals(db, id, tenantId);

            await db.insert(jobActivities).values({
              tenantId,
              jobId: id,
              type: "line_item.added",
              description: `Auto-added line item: ${catalogItem.name} (from checklist)`,
              metadata: { catalogItemId: catalogItem.id, checklistItemLabel: completion.label },
              performedBy: userId,
            });
          }
        }
      }

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "checklist.item_completed",
        description: `${isCompleted ? "Completed" : "Unchecked"}: ${completion.label}`,
        metadata: { checklistItemId: completion.checklistItemId, isCompleted },
        performedBy: userId,
      });

      return reply.send({ data: { id: completionId, isCompleted } });
    },
  );

  // ===== PHOTOS =====

  /**
   * GET /jobs/:id/photos
   * List all photos for a job.
   */
  fastify.get(
    "/:id/photos",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const data = await db
        .select()
        .from(jobPhotos)
        .where(
          and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.jobId, id)),
        )
        .orderBy(desc(jobPhotos.createdAt));

      return reply.send({ data });
    },
  );

  /**
   * POST /jobs/:id/photos
   * Register a photo (frontend uploads to Supabase Storage, sends storagePath).
   */
  fastify.post(
    "/:id/photos",
    {
      preHandler: [requireTenant],
      schema: { body: addPhotoBody },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as {
        storagePath: string;
        caption?: string;
        takenAt?: string;
      };
      const db = getDb();

      // Validate storage path belongs to this tenant
      if (!body.storagePath.startsWith(`${tenantId}/`)) {
        return reply.status(400).send({ message: "Invalid storage path" });
      }

      // Verify job exists
      const job = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, id)))
        .then((r) => r[0]);

      if (!job) {
        return reply.status(404).send({ message: "Job not found" });
      }

      const [photo] = await db
        .insert(jobPhotos)
        .values({
          tenantId,
          jobId: id,
          storagePath: body.storagePath,
          caption: body.caption || null,
          takenAt: body.takenAt ? new Date(body.takenAt) : null,
        })
        .returning();

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "photo.uploaded",
        description: "Photo uploaded",
        metadata: { photoId: photo.id },
        performedBy: userId,
      });

      return reply.status(201).send({ data: photo });
    },
  );

  /**
   * DELETE /jobs/:id/photos/:photoId
   * Delete a photo from Supabase Storage + DB.
   */
  fastify.delete(
    "/:id/photos/:photoId",
    {
      preHandler: [requireTenant],
      schema: { params: photoParam },
    },
    async (request, reply) => {
      const { id, photoId } = request.params as {
        id: string;
        photoId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const existing = await db
        .select({ id: jobPhotos.id, storagePath: jobPhotos.storagePath })
        .from(jobPhotos)
        .where(
          and(
            eq(jobPhotos.tenantId, tenantId),
            eq(jobPhotos.jobId, id),
            eq(jobPhotos.id, photoId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Photo not found" });
      }

      // Delete from Supabase Storage
      try {
        const supabase = getSupabaseAdmin();
        const pathParts = existing.storagePath.split("/");
        const bucket = pathParts[0];
        const filePath = pathParts.slice(1).join("/");
        if (bucket && filePath) {
          await supabase.storage.from(bucket).remove([filePath]);
        }
      } catch {
        // Storage deletion is best-effort — still delete the DB record
      }

      await db
        .delete(jobPhotos)
        .where(
          and(eq(jobPhotos.tenantId, tenantId), eq(jobPhotos.id, photoId)),
        );

      await db.insert(jobActivities).values({
        tenantId,
        jobId: id,
        type: "photo.deleted",
        description: "Photo deleted",
        performedBy: userId,
      });

      return reply.send({ message: "Photo deleted" });
    },
  );

  // ===== ACTIVITIES =====

  /**
   * GET /jobs/:id/activities
   * Paginated activity log with performer name.
   */
  fastify.get(
    "/:id/activities",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const { page = "1", limit = "20" } = request.query as Record<
        string,
        string
      >;
      const db = getDb();

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const whereClause = and(
        eq(jobActivities.tenantId, tenantId),
        eq(jobActivities.jobId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: jobActivities.id,
            jobId: jobActivities.jobId,
            type: jobActivities.type,
            description: jobActivities.description,
            metadata: jobActivities.metadata,
            performedBy: jobActivities.performedBy,
            createdAt: jobActivities.createdAt,
            performerName: user.name,
          })
          .from(jobActivities)
          .leftJoin(user, eq(jobActivities.performedBy, user.id))
          .where(whereClause)
          .orderBy(desc(jobActivities.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(jobActivities)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalResult[0]?.total ?? 0,
          totalPages: Math.ceil((totalResult[0]?.total ?? 0) / limitNum),
        },
      });
    },
  );
}
