import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  quotes,
  quoteLineItems,
  quoteActivities,
  jobs,
  jobLineItems,
  jobActivities,
  jobChecklistCompletions,
  checklistTemplates,
  checklistItems,
  catalogItems,
  customers,
  equipment,
  tenants,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
  user,
  isNull,
  isNotNull,
  inArray,
} from "@hvac-saas/database";
import { getSupabaseAdmin } from "@hvac-saas/database";
import { lt } from "drizzle-orm";
import crypto from "node:crypto";
import { env } from "../../lib/env.js";
import {
  idParam,
  quoteLineItemParam,
  quoteListQuery,
  createQuoteBody,
  updateQuoteBody,
  addLineItemBody,
  updateLineItemBody,
  convertBody,
  activitiesQuery,
  bulkQuoteStatusBody,
} from "../../lib/schemas/quotes.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";

// ========== HELPERS ==========

/**
 * Auto-expire sent quotes past their expiryDate.
 * Single UPDATE, no extra queries.
 */
async function autoExpireQuotes(
  db: ReturnType<typeof getDb>,
  tenantId: string,
) {
  const today = new Date().toISOString().split("T")[0];
  await db
    .update(quotes)
    .set({ status: "expired" as never, updatedAt: new Date() })
    .where(
      and(
        eq(quotes.tenantId, tenantId),
        eq(quotes.status, "sent" as never),
        lt(quotes.expiryDate, today),
      ),
    );
}

async function logQuoteActivity(
  db: ReturnType<typeof getDb>,
  tenantId: string,
  quoteId: string,
  type: string,
  description: string,
  performedBy?: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(quoteActivities).values({
    tenantId,
    quoteId,
    type,
    description,
    performedBy: performedBy ?? null,
    metadata: metadata ?? null,
  });
}

async function recalculateQuoteTotals(
  db: ReturnType<typeof getDb>,
  quoteId: string,
  tenantId: string,
) {
  // Sum all line items
  const result = await db
    .select({
      subtotal: sql<string>`COALESCE(SUM(quantity * unit_price), 0)`,
    })
    .from(quoteLineItems)
    .where(
      and(
        eq(quoteLineItems.quoteId, quoteId),
        eq(quoteLineItems.tenantId, tenantId),
      ),
    );

  const subtotal = parseFloat(result[0]?.subtotal ?? "0");

  // Get quote tax rate and discount
  const [q] = await db
    .select({
      taxRate: quotes.taxRate,
      discountAmount: quotes.discountAmount,
    })
    .from(quotes)
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));

  const taxRate = parseFloat(q?.taxRate ?? "0");
  const discountAmount = parseFloat(q?.discountAmount ?? "0");
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount - discountAmount;

  await db
    .update(quotes)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(quotes.id, quoteId), eq(quotes.tenantId, tenantId)));
}

async function attachChecklistToJob(
  db: ReturnType<typeof getDb>,
  jobId: string,
  tenantId: string,
  serviceType: string,
  userId: string,
) {
  const template = await db
    .select()
    .from(checklistTemplates)
    .where(
      and(
        eq(checklistTemplates.tenantId, tenantId),
        eq(checklistTemplates.serviceType, serviceType as never),
        eq(checklistTemplates.isActive, true),
      ),
    )
    .then((r) => r[0]);

  if (!template) return;

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

  if (items.length === 0) return;

  await db.insert(jobChecklistCompletions).values(
    items.map((item) => ({
      tenantId,
      jobId,
      checklistItemId: item.id,
      isCompleted: false,
    })),
  );

  await db.insert(jobActivities).values({
    tenantId,
    jobId,
    type: "checklist.attached",
    description: `Checklist "${template.name}" attached (${items.length} items)`,
    metadata: { templateId: template.id, templateName: template.name },
    performedBy: userId,
  });
}

// ========== ROUTES ==========

const quoteRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ===== QUOTES CRUD =====

  /**
   * GET /quotes
   * List quotes with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant], schema: { querystring: quoteListQuery } },
    async (request, reply) => {
      const {
        search = "",
        status,
        customerId,
        page,
        limit,
        sortBy,
        sortOrder,
        showArchived,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Auto-expire sent quotes past their expiry date
      await autoExpireQuotes(db, tenantId);

      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(quotes.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(quotes.archivedAt) : isNull(quotes.archivedAt));

      if (search) {
        filters.push(
          or(
            ilike(quotes.quoteNumber, `%${search}%`),
            ilike(quotes.notes, `%${search}%`),
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
          )!,
        );
      }

      if (status) {
        filters.push(eq(quotes.status, status as never));
      }
      if (customerId) {
        filters.push(eq(quotes.customerId, customerId));
      }

      const whereClause = and(...filters);

      // Sort
      const sortColumnMap = {
        createdAt: quotes.createdAt,
        issuedDate: quotes.issuedDate,
        expiryDate: quotes.expiryDate,
        quoteNumber: quotes.quoteNumber,
        status: quotes.status,
        totalAmount: quotes.totalAmount,
      } as const;
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
        quotes.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: quotes.id,
            tenantId: quotes.tenantId,
            customerId: quotes.customerId,
            quoteNumber: quotes.quoteNumber,
            status: quotes.status,
            issuedDate: quotes.issuedDate,
            expiryDate: quotes.expiryDate,
            subtotal: quotes.subtotal,
            taxRate: quotes.taxRate,
            taxAmount: quotes.taxAmount,
            discountAmount: quotes.discountAmount,
            totalAmount: quotes.totalAmount,
            notes: quotes.notes,
            pdfStoragePath: quotes.pdfStoragePath,
            convertedToJobId: quotes.convertedToJobId,
            createdAt: quotes.createdAt,
            updatedAt: quotes.updatedAt,
            equipmentId: quotes.equipmentId,
            equipmentType: equipment.equipmentType,
            equipmentBrand: equipment.brand,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
          .leftJoin(equipment, eq(quotes.equipmentId, equipment.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
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
   * GET /quotes/stats
   * Aggregate quote status counts in a single query.
   */
  fastify.get(
    "/stats",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const [result] = await db
        .select({
          draft: sql<number>`COUNT(*) FILTER (WHERE status = 'draft')`,
          sent: sql<number>`COUNT(*) FILTER (WHERE status = 'sent')`,
          accepted: sql<number>`COUNT(*) FILTER (WHERE status = 'accepted')`,
          declined: sql<number>`COUNT(*) FILTER (WHERE status = 'declined')`,
        })
        .from(quotes)
        .where(eq(quotes.tenantId, tenantId));

      return reply.send({
        data: {
          draft: Number(result.draft),
          sent: Number(result.sent),
          accepted: Number(result.accepted),
          declined: Number(result.declined),
        },
      });
    },
  );

  /**
   * GET /quotes/:id
   * Single quote with lineItems + customer info.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Auto-expire this quote if past expiry
      await autoExpireQuotes(db, tenantId);

      const quoteRow = await db
        .select({
          id: quotes.id,
          tenantId: quotes.tenantId,
          customerId: quotes.customerId,
          quoteNumber: quotes.quoteNumber,
          status: quotes.status,
          issuedDate: quotes.issuedDate,
          expiryDate: quotes.expiryDate,
          subtotal: quotes.subtotal,
          taxRate: quotes.taxRate,
          taxAmount: quotes.taxAmount,
          discountAmount: quotes.discountAmount,
          totalAmount: quotes.totalAmount,
          notes: quotes.notes,
          pdfStoragePath: quotes.pdfStoragePath,
          equipmentId: quotes.equipmentId,
          equipmentType: equipment.equipmentType,
          equipmentBrand: equipment.brand,
          equipmentModel: equipment.model,
          convertedToJobId: quotes.convertedToJobId,
          declineReason: quotes.declineReason,
          customerScheduledDate: quotes.customerScheduledDate,
          customerScheduledTime: quotes.customerScheduledTime,
          createdAt: quotes.createdAt,
          updatedAt: quotes.updatedAt,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          customerAddress: customers.address,
        })
        .from(quotes)
        .leftJoin(customers, eq(quotes.customerId, customers.id))
        .leftJoin(equipment, eq(quotes.equipmentId, equipment.id))
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!quoteRow) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      const lineItems = await db
        .select()
        .from(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, tenantId),
            eq(quoteLineItems.quoteId, id),
          ),
        )
        .orderBy(asc(quoteLineItems.sortOrder));

      return reply.send({
        data: {
          ...quoteRow,
          lineItems,
        },
      });
    },
  );

  /**
   * POST /quotes
   * Create a new quote.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant], schema: { body: createQuoteBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      const db = getDb();

      // Validate customer
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
        return reply.status(400).send({ message: "Customer not found" });
      }

      // Validate discount amount
      if (body.discountAmount !== undefined) {
        const d = parseFloat(body.discountAmount);
        if (isNaN(d) || d < 0) {
          return reply.status(400).send({ message: "Discount amount must be a non-negative number" });
        }
      }

      // Validate tax rate (decimal: 0.0825 = 8.25%)
      if (body.taxRate !== undefined) {
        const t = parseFloat(body.taxRate);
        if (isNaN(t) || t < 0 || t > 1) {
          return reply.status(400).send({ message: "Tax rate must be between 0 and 1 (e.g., 0.0825 for 8.25%)" });
        }
      }

      // Get default tax rate from tenant if not specified
      let taxRate = body.taxRate;
      if (!taxRate) {
        const [tenant] = await db
          .select({ defaultTaxRate: tenants.defaultTaxRate })
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        taxRate = tenant?.defaultTaxRate ?? "0";
      }

      // Default expiry: 30 days from now
      const today = new Date();
      const defaultExpiry = new Date(today);
      defaultExpiry.setDate(defaultExpiry.getDate() + 30);

      const [quote] = await db
        .insert(quotes)
        .values({
          tenantId,
          customerId: body.customerId,
          quoteNumber: "", // Auto-generated by DB trigger
          issuedDate: body.issuedDate || today.toISOString().split("T")[0],
          expiryDate: body.expiryDate || defaultExpiry.toISOString().split("T")[0],
          taxRate: taxRate ?? "0",
          discountAmount: body.discountAmount || "0",
          notes: body.notes || null,
          equipmentId: body.equipmentId || null,
        })
        .returning();

      // Re-fetch to get auto-generated quoteNumber
      const [created] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, quote.id));

      await logQuoteActivity(db, tenantId, created.id, "quote.created", `Quote ${created.quoteNumber} created`, request.authUser.userId);

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * PATCH /quotes/:id
   * Update allowed fields. Only draft quotes editable.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam, body: updateQuoteBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (existing.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Only draft quotes can be edited" });
      }

      // Validate discount amount
      if (body.discountAmount !== undefined) {
        const d = parseFloat(body.discountAmount);
        if (isNaN(d) || d < 0) {
          return reply.status(400).send({ message: "Discount amount must be a non-negative number" });
        }
      }

      // Validate tax rate
      if (body.taxRate !== undefined) {
        const t = parseFloat(body.taxRate);
        if (isNaN(t) || t < 0 || t > 1) {
          return reply.status(400).send({ message: "Tax rate must be between 0 and 1 (e.g., 0.0825 for 8.25%)" });
        }
      }

      // Validate customer ID change
      if (body.customerId && body.customerId !== existing.customerId) {
        const newCustomer = await db
          .select({ id: customers.id })
          .from(customers)
          .where(
            and(
              eq(customers.tenantId, tenantId),
              eq(customers.id, body.customerId),
            ),
          )
          .then((r) => r[0]);
        if (!newCustomer) {
          return reply.status(400).send({ message: "Customer not found" });
        }
      }

      const allowedFields = [
        "notes",
        "expiryDate",
        "taxRate",
        "discountAmount",
        "customerId",
        "issuedDate",
        "equipmentId",
      ] as const;

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      let financialChange = false;

      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
          if (field === "taxRate" || field === "discountAmount") {
            financialChange = true;
          }
        }
      }

      await db
        .update(quotes)
        .set(updates)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)));

      if (financialChange) {
        await recalculateQuoteTotals(db, id, tenantId);
      }

      // Re-fetch
      const [updated] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, id));

      const changedFields = Object.keys(updates).filter((k) => k !== "updatedAt");
      await logQuoteActivity(db, tenantId, id, "quote.updated", `Quote updated (${changedFields.join(", ")})`, request.authUser.userId, { changedFields });

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /quotes/:id
   * Hard delete. Only draft quotes.
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: quotes.id, status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (existing.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Only draft quotes can be deleted" });
      }

      await db
        .delete(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)));

      return reply.send({ message: "Quote deleted" });
    },
  );

  // ===== LINE ITEMS =====

  /**
   * POST /quotes/:id/line-items
   * Add a line item. Auto-fill from catalog if catalogItemId provided.
   */
  fastify.post(
    "/:id/line-items",
    { preHandler: [requireTenant], schema: { params: idParam, body: addLineItemBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      // Verify quote exists and is draft
      const q = await db
        .select({ id: quotes.id, status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (q.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only add line items to draft quotes" });
      }

      let description = body.description;
      let unitPrice = body.unitPrice;
      let itemType = body.itemType;

      // Auto-fill from catalog
      if (body.catalogItemId) {
        const catalogItem = await db
          .select()
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.tenantId, tenantId),
              eq(catalogItems.id, body.catalogItemId),
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
        .insert(quoteLineItems)
        .values({
          tenantId,
          quoteId: id,
          catalogItemId: body.catalogItemId || null,
          itemType: itemType as never,
          description,
          quantity: body.quantity || "1",
          unitPrice,
          sortOrder: body.sortOrder || 0,
        })
        .returning();

      await recalculateQuoteTotals(db, id, tenantId);
      await logQuoteActivity(db, tenantId, id, "line_item.added", `Line item added: ${description}`, request.authUser.userId, { description });

      return reply.status(201).send({ data: lineItem });
    },
  );

  /**
   * PATCH /quotes/:id/line-items/:lineItemId
   * Update a line item.
   */
  fastify.patch(
    "/:id/line-items/:lineItemId",
    { preHandler: [requireTenant], schema: { params: quoteLineItemParam, body: updateLineItemBody } },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      // Verify quote is draft
      const q = await db
        .select({ status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }
      if (q.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only edit line items on draft quotes" });
      }

      const existing = await db
        .select({ id: quoteLineItems.id })
        .from(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, tenantId),
            eq(quoteLineItems.quoteId, id),
            eq(quoteLineItems.id, lineItemId),
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
        "catalogItemId",
      ];
      const updates: Record<string, unknown> = {};
      const bodyRecord = body as Record<string, unknown>;
      for (const field of allowedFields) {
        if (field in bodyRecord) {
          updates[field] = bodyRecord[field];
        }
      }

      const [updated] = await db
        .update(quoteLineItems)
        .set(updates)
        .where(eq(quoteLineItems.id, lineItemId))
        .returning();

      await recalculateQuoteTotals(db, id, tenantId);
      await logQuoteActivity(db, tenantId, id, "line_item.updated", "Line item updated", request.authUser.userId);

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /quotes/:id/line-items/:lineItemId
   * Remove a line item.
   */
  fastify.delete(
    "/:id/line-items/:lineItemId",
    {
      preHandler: [requireTenant],
      schema: { params: quoteLineItemParam },
    },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify quote is draft
      const q = await db
        .select({ status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }
      if (q.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only remove line items from draft quotes" });
      }

      const existing = await db
        .select({ id: quoteLineItems.id })
        .from(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, tenantId),
            eq(quoteLineItems.quoteId, id),
            eq(quoteLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      await db
        .delete(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, tenantId),
            eq(quoteLineItems.quoteId, id),
            eq(quoteLineItems.id, lineItemId),
          ),
        );

      await recalculateQuoteTotals(db, id, tenantId);
      await logQuoteActivity(db, tenantId, id, "line_item.removed", "Line item removed", request.authUser.userId);

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== SEND / PDF =====

  /**
   * POST /quotes/:id/send
   * Generate PDF -> upload to Supabase Storage -> set status to sent.
   */
  fastify.post(
    "/:id/send",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (q.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Only draft quotes can be sent" });
      }

      // Get line items, customer, tenant, equipment info
      const [lineItems, customer, tenant, equipmentData] = await Promise.all([
        db
          .select()
          .from(quoteLineItems)
          .where(
            and(
              eq(quoteLineItems.tenantId, tenantId),
              eq(quoteLineItems.quoteId, id),
            ),
          )
          .orderBy(asc(quoteLineItems.sortOrder)),
        db
          .select()
          .from(customers)
          .where(and(eq(customers.id, q.customerId), eq(customers.tenantId, tenantId)))
          .then((r) => r[0]),
        db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .then((r) => r[0]),
        q.equipmentId
          ? db
              .select({
                equipmentType: equipment.equipmentType,
                brand: equipment.brand,
                model: equipment.model,
                serialNumber: equipment.serialNumber,
              })
              .from(equipment)
              .where(eq(equipment.id, q.equipmentId))
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
      ]);

      // Validate line items exist
      if (lineItems.length === 0) {
        return reply.status(400).send({ message: "Cannot send a quote with no line items" });
      }

      // Generate PDF
      const { generateQuotePdf } = await import(
        "../../lib/pdf/generate-quote-pdf.js"
      );
      const pdfBuffer = await generateQuotePdf(
        q,
        lineItems,
        customer,
        tenant,
        equipmentData,
      );

      // Upload to Supabase Storage
      const storagePath = `${tenantId}/${q.id}.pdf`;
      const supabase = getSupabaseAdmin();

      await supabase.storage.from("quotes").upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

      // Generate access token for public quote acceptance
      const accessToken = crypto.randomUUID();

      // Update quote
      await db
        .update(quotes)
        .set({
          pdfStoragePath: storagePath,
          status: "sent" as never,
          accessToken,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)));

      const [updated] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, id));

      await logQuoteActivity(db, tenantId, id, "quote.sent", "Quote sent", request.authUser.userId);

      // E-13: Send quote email with PDF attachment (fire-and-forget)
      if (customer?.email) {
        // Build public acceptance URL if online acceptance is enabled
        const viewQuoteUrl = tenant?.quoteOnlineAcceptanceEnabled !== false
          ? `${env.FRONTEND_URL}/quote/${accessToken}`
          : null;

        const { sendQuoteEmail } = await import("../../lib/email.js");
        sendQuoteEmail({
          to: customer.email,
          props: {
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            businessName: tenant?.businessName ?? "HVAC Service",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            quoteNumber: q.quoteNumber ?? `QT-${q.id.slice(0, 8)}`,
            issuedDate: q.issuedDate
              ? new Date(q.issuedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            expiryDate: q.expiryDate
              ? new Date(q.expiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "30 days",
            lineItems: lineItems.map((li) => ({
              description: li.description ?? "",
              quantity: Number(li.quantity ?? 1),
              unitPrice: Number(li.unitPrice ?? 0),
              total: Number(li.total ?? 0),
            })),
            subtotal: Number(q.subtotal ?? 0),
            taxAmount: Number(q.taxAmount ?? 0),
            discountAmount: Number(q.discountAmount ?? 0),
            totalAmount: Number(q.totalAmount ?? 0),
            viewQuoteUrl,
          },
          pdf: {
            buffer: Buffer.from(pdfBuffer),
            filename: `${q.quoteNumber ?? "estimate"}.pdf`,
          },
        }).catch((err) => console.error("[email] E-13 quote send failed:", err));
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * GET /quotes/:id/pdf
   * Download PDF. Stream from Storage or generate on-the-fly.
   */
  fastify.get(
    "/:id/pdf",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      // If PDF exists in storage, stream it
      if (q.pdfStoragePath) {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage
          .from("quotes")
          .download(q.pdfStoragePath);

        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          return reply
            .type("application/pdf")
            .header(
              "Content-Disposition",
              `inline; filename="${q.quoteNumber}.pdf"`,
            )
            .send(buffer);
        }
      }

      // Generate on-the-fly
      const [lineItems, customer, tenant, equipmentData] = await Promise.all([
        db
          .select()
          .from(quoteLineItems)
          .where(
            and(
              eq(quoteLineItems.tenantId, tenantId),
              eq(quoteLineItems.quoteId, id),
            ),
          )
          .orderBy(asc(quoteLineItems.sortOrder)),
        db
          .select()
          .from(customers)
          .where(and(eq(customers.id, q.customerId), eq(customers.tenantId, tenantId)))
          .then((r) => r[0]),
        db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .then((r) => r[0]),
        q.equipmentId
          ? db
              .select({
                equipmentType: equipment.equipmentType,
                brand: equipment.brand,
                model: equipment.model,
                serialNumber: equipment.serialNumber,
              })
              .from(equipment)
              .where(eq(equipment.id, q.equipmentId))
              .then((r) => r[0] ?? null)
          : Promise.resolve(null),
      ]);

      const { generateQuotePdf } = await import(
        "../../lib/pdf/generate-quote-pdf.js"
      );
      const pdfBuffer = await generateQuotePdf(
        q,
        lineItems,
        customer,
        tenant,
        equipmentData,
      );

      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `inline; filename="${q.quoteNumber}.pdf"`,
        )
        .send(pdfBuffer);
    },
  );

  // ===== ACCEPT / DECLINE =====

  /**
   * POST /quotes/:id/accept
   * Mark quote as accepted. Must be "sent" status.
   */
  fastify.post(
    "/:id/accept",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select({ id: quotes.id, status: quotes.status, quoteNumber: quotes.quoteNumber })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (q.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "Only sent quotes can be accepted" });
      }

      const [updated] = await db
        .update(quotes)
        .set({
          status: "accepted" as never,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
        .returning();

      await logQuoteActivity(db, tenantId, id, "quote.accepted", "Quote accepted", request.authUser.userId);

      dispatchNotification({
        tenantId,
        type: "quote_accepted",
        title: `Quote ${q.quoteNumber ?? ""} accepted`,
        description: `Quote has been accepted`,
        entityType: "quote",
        entityId: id,
        actorId: request.authUser.userId,
        metadata: { quoteNumber: q.quoteNumber },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /quotes/:id/decline
   * Mark quote as declined. Must be "sent" status.
   */
  fastify.post(
    "/:id/decline",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select({ id: quotes.id, status: quotes.status, quoteNumber: quotes.quoteNumber })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (q.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "Only sent quotes can be declined" });
      }

      const [updated] = await db
        .update(quotes)
        .set({
          status: "declined" as never,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
        .returning();

      await logQuoteActivity(db, tenantId, id, "quote.declined", "Quote declined", request.authUser.userId);

      dispatchNotification({
        tenantId,
        type: "quote_declined",
        title: `Quote ${q.quoteNumber ?? ""} declined`,
        description: `Quote has been declined`,
        entityType: "quote",
        entityId: id,
        actorId: request.authUser.userId,
        metadata: { quoteNumber: q.quoteNumber },
      });

      return reply.send({ data: updated });
    },
  );

  // ===== CONVERT TO JOB =====

  /**
   * POST /quotes/:id/convert
   * Convert accepted/sent quote to a job. Copies line items.
   */
  fastify.post(
    "/:id/convert",
    { preHandler: [requireTenant], schema: { params: idParam, body: convertBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId!;
      const body = request.body ?? {};
      const db = getDb();

      const q = await db
        .select()
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      if (q.status !== "accepted" && q.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "Only accepted or sent quotes can be converted to a job" });
      }

      if (q.convertedToJobId) {
        return reply
          .status(400)
          .send({ message: "This quote has already been converted to a job" });
      }

      const { convertQuoteToJob } = await import("../../lib/quote-to-job.js");
      const { jobId } = await convertQuoteToJob(db, q, {
        pipelineStageId: body.pipelineStageId,
        performedBy: userId,
      });

      const [createdJob] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId));

      return reply.status(201).send({ data: createdJob });
    },
  );

  // ===== ACTIVITIES =====

  /**
   * GET /quotes/:id/activities
   * Paginated activity timeline for a quote.
   */
  fastify.get(
    "/:id/activities",
    { preHandler: [requireTenant], schema: { params: idParam, querystring: activitiesQuery } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const { page, limit } = request.query;
      const db = getDb();

      // Verify quote exists for this tenant
      const q = await db
        .select({ id: quotes.id })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)))
        .then((r) => r[0]);

      if (!q) {
        return reply.status(404).send({ message: "Quote not found" });
      }

      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: quoteActivities.id,
            type: quoteActivities.type,
            description: quoteActivities.description,
            metadata: quoteActivities.metadata,
            createdAt: quoteActivities.createdAt,
            performedBy: quoteActivities.performedBy,
            performerName: user.name,
          })
          .from(quoteActivities)
          .leftJoin(user, eq(quoteActivities.performedBy, user.id))
          .where(
            and(
              eq(quoteActivities.tenantId, tenantId),
              eq(quoteActivities.quoteId, id),
            ),
          )
          .orderBy(desc(quoteActivities.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(quoteActivities)
          .where(
            and(
              eq(quoteActivities.tenantId, tenantId),
              eq(quoteActivities.quoteId, id),
            ),
          ),
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

  // ===== BULK OPERATIONS =====

  /**
   * POST /quotes/bulk-archive
   * Set archivedAt = now() for the given quote IDs (tenant-scoped).
   */
  fastify.post(
    "/bulk-archive",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      await db
        .update(quotes)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, ids)));

      return reply.send({ message: "Quotes archived", count: ids.length });
    },
  );

  /**
   * POST /quotes/bulk-restore
   * Clear archivedAt (set to null) for the given quote IDs (tenant-scoped).
   */
  fastify.post(
    "/bulk-restore",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      await db
        .update(quotes)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            inArray(quotes.id, ids),
            isNotNull(quotes.archivedAt),
          ),
        );

      return reply.send({ message: "Quotes restored", count: ids.length });
    },
  );

  /**
   * POST /quotes/bulk-delete
   * Hard delete ONLY draft quotes. Non-draft quotes are returned in the errors array.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: quotes.id, status: quotes.status })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, ids)));

      const eligible: string[] = [];
      const errors: { id: string; message: string }[] = [];

      for (const row of existing) {
        if (row.status === "draft") {
          eligible.push(row.id);
        } else {
          errors.push({
            id: row.id,
            message: `Quote is ${row.status}, only draft quotes can be deleted`,
          });
        }
      }

      if (eligible.length > 0) {
        await db
          .delete(quotes)
          .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, eligible)));
      }

      return reply.send({
        message: "Bulk delete complete",
        deleted: eligible.length,
        errors,
      });
    },
  );

  /**
   * POST /quotes/bulk-status-update
   * Update status for the given quote IDs (tenant-scoped).
   */
  fastify.post(
    "/bulk-status-update",
    { preHandler: [requireTenant], schema: { body: bulkQuoteStatusBody } },
    async (request, reply) => {
      const { ids, status } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      await db
        .update(quotes)
        .set({ status: status as never, updatedAt: new Date() })
        .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, ids)));

      return reply.send({ message: "Quotes updated", count: ids.length });
    },
  );
};
export default quoteRoutes;
