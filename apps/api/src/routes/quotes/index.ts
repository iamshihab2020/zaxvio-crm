import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
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
} from "@hvac-saas/database";
import { getSupabaseAdmin } from "@hvac-saas/database";
import { lt } from "drizzle-orm";

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

export default async function quoteRoutes(fastify: FastifyInstance) {
  // ===== QUOTES CRUD =====

  /**
   * GET /quotes
   * List quotes with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        status,
        customerId,
        page = "1",
        limit = "20",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string | undefined>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Auto-expire sent quotes past their expiry date
      await autoExpireQuotes(db, tenantId);

      const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit ?? "20", 10) || 20),
      );
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(quotes.tenantId, tenantId)];

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
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(quotes)
          .leftJoin(customers, eq(quotes.customerId, customers.id))
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
   * GET /quotes/:id
   * Single quote with lineItems + customer info.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
          convertedToJobId: quotes.convertedToJobId,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;

      if (!body.customerId) {
        return reply
          .status(400)
          .send({ message: "customerId is required" });
      }

      const db = getDb();

      // Validate customer
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
        return reply.status(400).send({ message: "Customer not found" });
      }

      // Validate discount amount
      if (body.discountAmount !== undefined) {
        const d = parseFloat(body.discountAmount as string);
        if (isNaN(d) || d < 0) {
          return reply.status(400).send({ message: "Discount amount must be a non-negative number" });
        }
      }

      // Validate tax rate (decimal: 0.0825 = 8.25%)
      if (body.taxRate !== undefined) {
        const t = parseFloat(body.taxRate as string);
        if (isNaN(t) || t < 0 || t > 1) {
          return reply.status(400).send({ message: "Tax rate must be between 0 and 1 (e.g., 0.0825 for 8.25%)" });
        }
      }

      // Get default tax rate from tenant if not specified
      let taxRate = body.taxRate as string | undefined;
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
          customerId: body.customerId as string,
          quoteNumber: "", // Auto-generated by DB trigger
          issuedDate: (body.issuedDate as string) || today.toISOString().split("T")[0],
          expiryDate: (body.expiryDate as string) || defaultExpiry.toISOString().split("T")[0],
          taxRate: taxRate ?? "0",
          discountAmount: (body.discountAmount as string) || "0",
          notes: (body.notes as string) || null,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
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
        const d = parseFloat(body.discountAmount as string);
        if (isNaN(d) || d < 0) {
          return reply.status(400).send({ message: "Discount amount must be a non-negative number" });
        }
      }

      // Validate tax rate
      if (body.taxRate !== undefined) {
        const t = parseFloat(body.taxRate as string);
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
              eq(customers.id, body.customerId as string),
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
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

      let description = body.description as string;
      let unitPrice = body.unitPrice as string;
      let itemType = body.itemType as string;

      // Auto-fill from catalog
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
        .insert(quoteLineItems)
        .values({
          tenantId,
          quoteId: id,
          catalogItemId: (body.catalogItemId as string) || null,
          itemType: itemType as never,
          description,
          quantity: (body.quantity as string) || "1",
          unitPrice,
          sortOrder: (body.sortOrder as number) || 0,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, lineItemId } = request.params as {
        id: string;
        lineItemId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
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
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, lineItemId } = request.params as {
        id: string;
        lineItemId: string;
      };
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
        .where(eq(quoteLineItems.id, lineItemId));

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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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

      // Get line items, customer, tenant info
      const [lineItems, customer, tenant] = await Promise.all([
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
      );

      // Upload to Supabase Storage
      const storagePath = `${tenantId}/${q.id}.pdf`;
      const supabase = getSupabaseAdmin();

      await supabase.storage.from("quotes").upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

      // Update quote
      await db
        .update(quotes)
        .set({
          pdfStoragePath: storagePath,
          status: "sent" as never,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)));

      const [updated] = await db
        .select()
        .from(quotes)
        .where(eq(quotes.id, id));

      await logQuoteActivity(db, tenantId, id, "quote.sent", "Quote sent", request.authUser.userId);

      return reply.send({ data: updated });
    },
  );

  /**
   * GET /quotes/:id/pdf
   * Download PDF. Stream from Storage or generate on-the-fly.
   */
  fastify.get(
    "/:id/pdf",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
      const [lineItems, customer, tenant] = await Promise.all([
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
      ]);

      const { generateQuotePdf } = await import(
        "../../lib/pdf/generate-quote-pdf.js"
      );
      const pdfBuffer = await generateQuotePdf(
        q,
        lineItems,
        customer,
        tenant,
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select({ id: quotes.id, status: quotes.status })
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

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /quotes/:id/decline
   * Mark quote as declined. Must be "sent" status.
   */
  fastify.post(
    "/:id/decline",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const q = await db
        .select({ id: quotes.id, status: quotes.status })
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId!;
      const body = (request.body as { pipelineStageId?: string } | null) ?? {};
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

      // Resolve pipeline stage (user-selected or first default)
      const { jobPipelineStages } = await import("@hvac-saas/database");
      let jobStatus = "Scheduled";
      if (body.pipelineStageId) {
        const selectedStage = await db
          .select({ name: jobPipelineStages.name })
          .from(jobPipelineStages)
          .where(and(eq(jobPipelineStages.id, body.pipelineStageId), eq(jobPipelineStages.tenantId, tenantId)))
          .then((r) => r[0]);
        if (selectedStage) jobStatus = selectedStage.name;
      } else {
        const firstStage = await db
          .select({ name: jobPipelineStages.name })
          .from(jobPipelineStages)
          .where(eq(jobPipelineStages.tenantId, tenantId))
          .orderBy(asc(jobPipelineStages.sortOrder))
          .limit(1)
          .then((r) => r[0]);
        if (firstStage) jobStatus = firstStage.name;
      }

      // Create job
      const [job] = await db
        .insert(jobs)
        .values({
          tenantId,
          customerId: q.customerId,
          jobNumber: "", // Auto-generated by DB trigger
          title: `Job from ${q.quoteNumber}`,
          status: jobStatus,
          scheduledDate: new Date().toISOString().split("T")[0],
          taxRate: q.taxRate ?? "0",
          serviceType: "repair" as never,
        })
        .returning();

      // Copy quote line items to job line items
      const quoteItems = await db
        .select()
        .from(quoteLineItems)
        .where(
          and(
            eq(quoteLineItems.tenantId, tenantId),
            eq(quoteLineItems.quoteId, id),
          ),
        )
        .orderBy(asc(quoteLineItems.sortOrder));

      if (quoteItems.length > 0) {
        await db.insert(jobLineItems).values(
          quoteItems.map((item) => ({
            tenantId,
            jobId: job.id,
            catalogItemId: item.catalogItemId,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sortOrder: item.sortOrder ?? 0,
          })),
        );
      }

      // Recalculate job totals (include discount from quote)
      const subtotal = parseFloat(q.subtotal);
      const taxRate = parseFloat(q.taxRate ?? "0");
      const discountAmount = parseFloat(q.discountAmount ?? "0");
      const taxAmount = subtotal * taxRate;
      const totalAmount = subtotal + taxAmount - discountAmount;

      await db
        .update(jobs)
        .set({
          subtotal: subtotal.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          totalAmount: totalAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(and(eq(jobs.id, job.id), eq(jobs.tenantId, tenantId)));

      // Auto-attach checklist
      await attachChecklistToJob(db, job.id, tenantId, "repair", userId);

      // Update quote with converted job reference
      await db
        .update(quotes)
        .set({
          convertedToJobId: job.id,
          status: q.status !== "accepted" ? ("accepted" as never) : q.status,
          updatedAt: new Date(),
        })
        .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)));

      // Re-fetch the job
      const [createdJob] = await db
        .select()
        .from(jobs)
        .where(eq(jobs.id, job.id));

      await logQuoteActivity(db, tenantId, id, "quote.converted", `Converted to job ${createdJob.jobNumber}`, userId, { jobId: job.id });

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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const {
        page = "1",
        limit = "50",
      } = request.query as Record<string, string | undefined>;
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

      const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit ?? "50", 10) || 50));
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
}
