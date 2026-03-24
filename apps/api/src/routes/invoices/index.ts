import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  invoices,
  invoiceLineItems,
  invoicePayments,
  jobs,
  jobLineItems,
  customers,
  catalogItems,
  tenants,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
} from "@hvac-saas/database";
import { getSupabaseAdmin } from "@hvac-saas/database";

// ========== HELPERS ==========

async function recalculateInvoiceTotals(
  db: ReturnType<typeof getDb>,
  invoiceId: string,
  tenantId: string,
) {
  // Sum all line items
  const result = await db
    .select({
      subtotal: sql<string>`COALESCE(SUM(quantity * unit_price), 0)`,
    })
    .from(invoiceLineItems)
    .where(
      and(
        eq(invoiceLineItems.invoiceId, invoiceId),
        eq(invoiceLineItems.tenantId, tenantId),
      ),
    );

  const subtotal = parseFloat(result[0]?.subtotal ?? "0");

  // Get invoice tax rate, discount, amountPaid
  const [inv] = await db
    .select({
      taxRate: invoices.taxRate,
      discountAmount: invoices.discountAmount,
      amountPaid: invoices.amountPaid,
    })
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));

  const taxRate = parseFloat(inv?.taxRate ?? "0");
  const discountAmount = parseFloat(inv?.discountAmount ?? "0");
  const amountPaid = parseFloat(inv?.amountPaid ?? "0");
  const taxAmount = subtotal * taxRate;
  const totalAmount = subtotal + taxAmount - discountAmount;
  const balanceDue = totalAmount - amountPaid;

  await db
    .update(invoices)
    .set({
      subtotal: subtotal.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      balanceDue: balanceDue.toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
}

// ========== ROUTES ==========

export default async function invoiceRoutes(fastify: FastifyInstance) {
  // ===== INVOICES CRUD =====

  /**
   * GET /invoices
   * List invoices with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        status,
        customerId,
        jobId,
        page = "1",
        limit = "20",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string | undefined>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page ?? "1", 10) || 1);
      const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit ?? "20", 10) || 20),
      );
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(invoices.tenantId, tenantId)];

      if (search) {
        filters.push(
          or(
            ilike(invoices.invoiceNumber, `%${search}%`),
            ilike(invoices.notes, `%${search}%`),
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
          )!,
        );
      }

      if (status) {
        filters.push(eq(invoices.status, status as never));
      }
      if (customerId) {
        filters.push(eq(invoices.customerId, customerId));
      }
      if (jobId) {
        filters.push(eq(invoices.jobId, jobId));
      }

      const whereClause = and(...filters);

      // Sort
      const sortColumnMap = {
        createdAt: invoices.createdAt,
        issuedDate: invoices.issuedDate,
        dueDate: invoices.dueDate,
        invoiceNumber: invoices.invoiceNumber,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        balanceDue: invoices.balanceDue,
      } as const;
      const sortCol =
        sortColumnMap[sortBy as keyof typeof sortColumnMap] ??
        invoices.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select({
            id: invoices.id,
            tenantId: invoices.tenantId,
            customerId: invoices.customerId,
            jobId: invoices.jobId,
            invoiceNumber: invoices.invoiceNumber,
            status: invoices.status,
            issuedDate: invoices.issuedDate,
            dueDate: invoices.dueDate,
            subtotal: invoices.subtotal,
            taxRate: invoices.taxRate,
            taxAmount: invoices.taxAmount,
            discountAmount: invoices.discountAmount,
            totalAmount: invoices.totalAmount,
            amountPaid: invoices.amountPaid,
            balanceDue: invoices.balanceDue,
            notes: invoices.notes,
            pdfStoragePath: invoices.pdfStoragePath,
            createdAt: invoices.createdAt,
            updatedAt: invoices.updatedAt,
            customerFirstName: customers.firstName,
            customerLastName: customers.lastName,
          })
          .from(invoices)
          .leftJoin(customers, eq(invoices.customerId, customers.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(invoices)
          .leftJoin(customers, eq(invoices.customerId, customers.id))
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
   * GET /invoices/:id
   * Single invoice with lineItems + payments + customer info.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const invoiceRow = await db
        .select({
          id: invoices.id,
          tenantId: invoices.tenantId,
          customerId: invoices.customerId,
          jobId: invoices.jobId,
          invoiceNumber: invoices.invoiceNumber,
          status: invoices.status,
          issuedDate: invoices.issuedDate,
          dueDate: invoices.dueDate,
          subtotal: invoices.subtotal,
          taxRate: invoices.taxRate,
          taxAmount: invoices.taxAmount,
          discountAmount: invoices.discountAmount,
          totalAmount: invoices.totalAmount,
          amountPaid: invoices.amountPaid,
          balanceDue: invoices.balanceDue,
          notes: invoices.notes,
          pdfStoragePath: invoices.pdfStoragePath,
          createdAt: invoices.createdAt,
          updatedAt: invoices.updatedAt,
          customerFirstName: customers.firstName,
          customerLastName: customers.lastName,
          customerEmail: customers.email,
          customerPhone: customers.phone,
          customerAddress: customers.address,
        })
        .from(invoices)
        .leftJoin(customers, eq(invoices.customerId, customers.id))
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!invoiceRow) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      const [lineItems, payments] = await Promise.all([
        db
          .select()
          .from(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.tenantId, tenantId),
              eq(invoiceLineItems.invoiceId, id),
            ),
          )
          .orderBy(asc(invoiceLineItems.sortOrder)),
        db
          .select()
          .from(invoicePayments)
          .where(
            and(
              eq(invoicePayments.tenantId, tenantId),
              eq(invoicePayments.invoiceId, id),
            ),
          )
          .orderBy(desc(invoicePayments.paymentDate)),
      ]);

      return reply.send({
        data: {
          ...invoiceRow,
          lineItems,
          payments,
        },
      });
    },
  );

  /**
   * POST /invoices
   * Create a new invoice. If jobId provided, copy line items from job.
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

      // Get default tax rate from tenant if not specified
      let taxRate = body.taxRate as string | undefined;
      if (!taxRate && !body.jobId) {
        const [tenant] = await db
          .select({ defaultTaxRate: tenants.defaultTaxRate })
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        taxRate = tenant?.defaultTaxRate ?? "0";
      }

      // If jobId, get job's tax rate
      let jobTaxRate: string | null = null;
      if (body.jobId) {
        const [job] = await db
          .select({ taxRate: jobs.taxRate })
          .from(jobs)
          .where(
            and(
              eq(jobs.tenantId, tenantId),
              eq(jobs.id, body.jobId as string),
            ),
          );
        if (!job) {
          return reply.status(400).send({ message: "Job not found" });
        }
        jobTaxRate = job.taxRate;
      }

      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId,
          customerId: body.customerId as string,
          jobId: (body.jobId as string) || null,
          invoiceNumber: "", // Auto-generated by DB trigger
          issuedDate: (body.issuedDate as string) || new Date().toISOString().split("T")[0],
          dueDate: (body.dueDate as string) || null,
          taxRate: body.jobId ? (jobTaxRate ?? "0") : (taxRate ?? "0"),
          discountAmount: (body.discountAmount as string) || "0",
          notes: (body.notes as string) || null,
        })
        .returning();

      // If jobId, copy line items from job
      if (body.jobId) {
        const jobItems = await db
          .select()
          .from(jobLineItems)
          .where(
            and(
              eq(jobLineItems.tenantId, tenantId),
              eq(jobLineItems.jobId, body.jobId as string),
            ),
          )
          .orderBy(asc(jobLineItems.sortOrder));

        if (jobItems.length > 0) {
          await db.insert(invoiceLineItems).values(
            jobItems.map((item) => ({
              tenantId,
              invoiceId: invoice.id,
              catalogItemId: item.catalogItemId,
              itemType: item.itemType,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              sortOrder: item.sortOrder ?? 0,
            })),
          );

          await recalculateInvoiceTotals(db, invoice.id, tenantId);
        }
      }

      // Re-fetch to get auto-generated invoiceNumber + recalculated totals
      const [created] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id));

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * PATCH /invoices/:id
   * Update allowed fields. Only draft invoices editable.
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
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (existing.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Only draft invoices can be edited" });
      }

      const allowedFields = [
        "notes",
        "dueDate",
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
          if (
            field === "taxRate" ||
            field === "discountAmount"
          ) {
            financialChange = true;
          }
        }
      }

      await db
        .update(invoices)
        .set(updates)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)));

      if (financialChange) {
        await recalculateInvoiceTotals(db, id, tenantId);
      }

      // Re-fetch
      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /invoices/:id
   * Hard delete. Only draft invoices.
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: invoices.id, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (existing.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Only draft invoices can be deleted" });
      }

      await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)));

      return reply.send({ message: "Invoice deleted" });
    },
  );

  // ===== LINE ITEMS =====

  /**
   * POST /invoices/:id/line-items
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

      // Verify invoice exists and is draft
      const inv = await db
        .select({ id: invoices.id, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (inv.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only add line items to draft invoices" });
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
        .insert(invoiceLineItems)
        .values({
          tenantId,
          invoiceId: id,
          catalogItemId: (body.catalogItemId as string) || null,
          itemType: itemType as never,
          description,
          quantity: (body.quantity as string) || "1",
          unitPrice,
          sortOrder: (body.sortOrder as number) || 0,
        })
        .returning();

      await recalculateInvoiceTotals(db, id, tenantId);

      return reply.status(201).send({ data: lineItem });
    },
  );

  /**
   * PATCH /invoices/:id/line-items/:lineItemId
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

      // Verify invoice is draft
      const inv = await db
        .select({ status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }
      if (inv.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only edit line items on draft invoices" });
      }

      const existing = await db
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(
          and(
            eq(invoiceLineItems.tenantId, tenantId),
            eq(invoiceLineItems.invoiceId, id),
            eq(invoiceLineItems.id, lineItemId),
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
      ];
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(invoiceLineItems)
        .set(updates)
        .where(eq(invoiceLineItems.id, lineItemId))
        .returning();

      await recalculateInvoiceTotals(db, id, tenantId);

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /invoices/:id/line-items/:lineItemId
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

      // Verify invoice is draft
      const inv = await db
        .select({ status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }
      if (inv.status !== "draft") {
        return reply
          .status(400)
          .send({ message: "Can only remove line items from draft invoices" });
      }

      const existing = await db
        .select({ id: invoiceLineItems.id })
        .from(invoiceLineItems)
        .where(
          and(
            eq(invoiceLineItems.tenantId, tenantId),
            eq(invoiceLineItems.invoiceId, id),
            eq(invoiceLineItems.id, lineItemId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      await db
        .delete(invoiceLineItems)
        .where(eq(invoiceLineItems.id, lineItemId));

      await recalculateInvoiceTotals(db, id, tenantId);

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== PAYMENTS =====

  /**
   * POST /invoices/:id/payments
   * Record a payment. Auto-updates amountPaid, balanceDue, status.
   */
  fastify.post(
    "/:id/payments",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      if (!body.amount) {
        return reply.status(400).send({ message: "amount is required" });
      }

      const inv = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (inv.status === "void") {
        return reply
          .status(400)
          .send({ message: "Cannot record payment on a void invoice" });
      }

      const [payment] = await db
        .insert(invoicePayments)
        .values({
          tenantId,
          invoiceId: id,
          amount: body.amount as string,
          paymentMethod: (body.paymentMethod as never) || null,
          paymentDate:
            (body.paymentDate as string) ||
            new Date().toISOString().split("T")[0],
          referenceNumber: (body.referenceNumber as string) || null,
          notes: (body.notes as string) || null,
        })
        .returning();

      // Recalculate amountPaid
      const paymentSum = await db
        .select({
          total: sql<string>`COALESCE(SUM(amount), 0)`,
        })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.invoiceId, id),
            eq(invoicePayments.tenantId, tenantId),
          ),
        );

      const amountPaid = parseFloat(paymentSum[0]?.total ?? "0");
      const totalAmount = parseFloat(inv.totalAmount);
      const balanceDue = totalAmount - amountPaid;

      // Auto-set status
      let newStatus = inv.status;
      if (balanceDue <= 0) {
        newStatus = "paid";
      } else if (amountPaid > 0) {
        newStatus = "partially_paid";
      }

      await db
        .update(invoices)
        .set({
          amountPaid: amountPaid.toFixed(2),
          balanceDue: Math.max(0, balanceDue).toFixed(2),
          status: newStatus as never,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

      return reply.status(201).send({ data: payment });
    },
  );

  /**
   * DELETE /invoices/:id/payments/:paymentId
   * Remove a payment. Reverses amountPaid, balanceDue, status.
   */
  fastify.delete(
    "/:id/payments/:paymentId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id, paymentId } = request.params as {
        id: string;
        paymentId: string;
      };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: invoicePayments.id })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.tenantId, tenantId),
            eq(invoicePayments.invoiceId, id),
            eq(invoicePayments.id, paymentId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Payment not found" });
      }

      await db
        .delete(invoicePayments)
        .where(eq(invoicePayments.id, paymentId));

      // Recalculate amountPaid
      const inv = await db
        .select({
          totalAmount: invoices.totalAmount,
          status: invoices.status,
        })
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .then((r) => r[0]);

      const paymentSum = await db
        .select({
          total: sql<string>`COALESCE(SUM(amount), 0)`,
        })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.invoiceId, id),
            eq(invoicePayments.tenantId, tenantId),
          ),
        );

      const amountPaid = parseFloat(paymentSum[0]?.total ?? "0");
      const totalAmount = parseFloat(inv?.totalAmount ?? "0");
      const balanceDue = totalAmount - amountPaid;

      // Revert status
      let newStatus = inv?.status ?? "draft";
      if (amountPaid <= 0) {
        newStatus = "sent";
      } else if (balanceDue <= 0) {
        newStatus = "paid";
      } else {
        newStatus = "partially_paid";
      }

      await db
        .update(invoices)
        .set({
          amountPaid: amountPaid.toFixed(2),
          balanceDue: Math.max(0, balanceDue).toFixed(2),
          status: newStatus as never,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

      return reply.send({ message: "Payment deleted" });
    },
  );

  // ===== SEND / PDF =====

  /**
   * POST /invoices/:id/send
   * Generate PDF → upload to Supabase Storage → set status to sent.
   */
  fastify.post(
    "/:id/send",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Get full invoice data
      const inv = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (inv.status === "void") {
        return reply
          .status(400)
          .send({ message: "Cannot send a void invoice" });
      }

      // Get line items, customer, tenant info
      const [lineItems, customer, tenant] = await Promise.all([
        db
          .select()
          .from(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.tenantId, tenantId),
              eq(invoiceLineItems.invoiceId, id),
            ),
          )
          .orderBy(asc(invoiceLineItems.sortOrder)),
        db
          .select()
          .from(customers)
          .where(eq(customers.id, inv.customerId))
          .then((r) => r[0]),
        db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .then((r) => r[0]),
      ]);

      // Generate PDF
      const { generateInvoicePdf } = await import(
        "../../lib/pdf/generate-invoice-pdf.js"
      );
      const pdfBuffer = await generateInvoicePdf(
        inv,
        lineItems,
        customer,
        tenant,
      );

      // Upload to Supabase Storage
      const storagePath = `${tenantId}/${inv.id}.pdf`;
      const supabase = getSupabaseAdmin();

      await supabase.storage.from("invoices").upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

      // Update invoice
      await db
        .update(invoices)
        .set({
          pdfStoragePath: storagePath,
          status: inv.status === "draft" ? ("sent" as never) : inv.status,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      return reply.send({ data: updated });
    },
  );

  /**
   * GET /invoices/:id/pdf
   * Download PDF. Stream from Storage or generate on-the-fly.
   */
  fastify.get(
    "/:id/pdf",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const inv = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      // If PDF exists in storage, stream it
      if (inv.pdfStoragePath) {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage
          .from("invoices")
          .download(inv.pdfStoragePath);

        if (!error && data) {
          const buffer = Buffer.from(await data.arrayBuffer());
          return reply
            .type("application/pdf")
            .header(
              "Content-Disposition",
              `inline; filename="${inv.invoiceNumber}.pdf"`,
            )
            .send(buffer);
        }
      }

      // Generate on-the-fly
      const [lineItems, customer, tenant] = await Promise.all([
        db
          .select()
          .from(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.tenantId, tenantId),
              eq(invoiceLineItems.invoiceId, id),
            ),
          )
          .orderBy(asc(invoiceLineItems.sortOrder)),
        db
          .select()
          .from(customers)
          .where(eq(customers.id, inv.customerId))
          .then((r) => r[0]),
        db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .then((r) => r[0]),
      ]);

      const { generateInvoicePdf } = await import(
        "../../lib/pdf/generate-invoice-pdf.js"
      );
      const pdfBuffer = await generateInvoicePdf(
        inv,
        lineItems,
        customer,
        tenant,
      );

      return reply
        .type("application/pdf")
        .header(
          "Content-Disposition",
          `inline; filename="${inv.invoiceNumber}.pdf"`,
        )
        .send(pdfBuffer);
    },
  );

  // ===== VOID =====

  /**
   * POST /invoices/:id/void
   * Void an invoice. Only draft or sent.
   */
  fastify.post(
    "/:id/void",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const inv = await db
        .select({ id: invoices.id, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      if (inv.status !== "draft" && inv.status !== "sent") {
        return reply
          .status(400)
          .send({ message: "Only draft or sent invoices can be voided" });
      }

      const [updated] = await db
        .update(invoices)
        .set({
          status: "void" as never,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  // ===== STATUS UPDATE =====

  /**
   * PATCH /invoices/:id/status
   * Manual status update (edge cases).
   */
  fastify.patch(
    "/:id/status",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as { status: string };
      const db = getDb();

      if (!body.status) {
        return reply.status(400).send({ message: "status is required" });
      }

      const inv = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)))
        .then((r) => r[0]);

      if (!inv) {
        return reply.status(404).send({ message: "Invoice not found" });
      }

      const [updated] = await db
        .update(invoices)
        .set({
          status: body.status as never,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  // ===== FROM JOB =====

  /**
   * POST /invoices/from-job/:jobId
   * Create invoice from a job. Copies customer, line items, tax rate.
   */
  fastify.post(
    "/from-job/:jobId",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { jobId } = request.params as { jobId: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const job = await db
        .select()
        .from(jobs)
        .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
        .then((r) => r[0]);

      if (!job) {
        return reply.status(404).send({ message: "Job not found" });
      }

      // Check if an invoice already exists for this job
      const existingInvoice = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(eq(invoices.tenantId, tenantId), eq(invoices.jobId, jobId)),
        )
        .then((r) => r[0]);

      if (existingInvoice) {
        return reply
          .status(400)
          .send({ message: "An invoice already exists for this job" });
      }

      // Create invoice
      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId,
          customerId: job.customerId,
          jobId: job.id,
          invoiceNumber: "", // Auto-generated by DB trigger
          taxRate: job.taxRate ?? "0",
          issuedDate: new Date().toISOString().split("T")[0],
        })
        .returning();

      // Copy job line items
      const jobItems = await db
        .select()
        .from(jobLineItems)
        .where(
          and(
            eq(jobLineItems.tenantId, tenantId),
            eq(jobLineItems.jobId, jobId),
          ),
        )
        .orderBy(asc(jobLineItems.sortOrder));

      if (jobItems.length > 0) {
        await db.insert(invoiceLineItems).values(
          jobItems.map((item) => ({
            tenantId,
            invoiceId: invoice.id,
            catalogItemId: item.catalogItemId,
            itemType: item.itemType,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            sortOrder: item.sortOrder ?? 0,
          })),
        );
      }

      await recalculateInvoiceTotals(db, invoice.id, tenantId);

      // Re-fetch with auto-generated number
      const [created] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoice.id));

      return reply.status(201).send({ data: created });
    },
  );
}
