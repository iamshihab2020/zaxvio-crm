import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  idParam,
  lineItemParam,
  paymentParam,
  jobIdParam,
  invoiceListQuery,
  createInvoiceBody,
  updateInvoiceBody,
  addLineItemBody,
  updateLineItemBody,
  recordPaymentBody,
  updateInvoiceStatusBody,
  bulkInvoiceStatusBody,
} from "../../lib/schemas/invoices.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import { dispatchNotification } from "../../lib/notifications.js";
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
  isNull,
  isNotNull,
  inArray,
  notInArray,
} from "@hvac-saas/database";
import { uploadFile, downloadFile } from "../../lib/storage.js";

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
      balanceDue: Math.max(0, balanceDue).toFixed(2),
      updatedAt: new Date(),
    })
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
}

// ========== ROUTES ==========

const invoiceRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ===== INVOICES CRUD =====

  /**
   * GET /invoices
   * List invoices with search, filters, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant], schema: { querystring: invoiceListQuery } },
    async (request, reply) => {
      const {
        search = "",
        status,
        customerId,
        jobId,
        page,
        limit,
        sortBy,
        sortOrder,
        showArchived,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(invoices.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(invoices.archivedAt) : isNull(invoices.archivedAt));

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

      if (status === "overdue") {
        // Overdue is derived from due_date, not the stored status — the status
        // column only flips when the overdue cron runs, so filtering on it would
        // return fewer invoices than the dashboard banner and aging widget count.
        // Same definition as `getOverdueInvoiceSummary`.
        filters.push(
          and(
            notInArray(invoices.status, ["paid", "void"]),
            sql`${invoices.dueDate} < (now() AT TIME ZONE ${request.authUser.tenantTimezone})::date`,
          )!,
        );
      } else if (status === "unpaid") {
        // "Still owes money" — the set the customer overview shows. Derived for
        // the same reason `overdue` is: it spans several stored statuses.
        filters.push(inArray(invoices.status, ["sent", "overdue", "partially_paid"]));
      } else if (status) {
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
      const sortCol = sortColumnMap[sortBy] ?? invoices.createdAt;
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
   * GET /invoices/stats
   * Aggregate status counts in a single query.
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
          paid: sql<number>`COUNT(*) FILTER (WHERE status = 'paid')`,
          // Derived from due_date, matching the list filter and the dashboard —
          // not the stored status, which lags until the overdue cron runs.
          overdue: sql<number>`COUNT(*) FILTER (
            WHERE status NOT IN ('paid', 'void')
              AND due_date < (now() AT TIME ZONE ${request.authUser.tenantTimezone})::date
          )`,
          partially_paid: sql<number>`COUNT(*) FILTER (WHERE status = 'partially_paid')`,
          void: sql<number>`COUNT(*) FILTER (WHERE status = 'void')`,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), isNull(invoices.archivedAt)));

      return reply.send({
        data: {
          draft: Number(result.draft),
          sent: Number(result.sent),
          paid: Number(result.paid),
          overdue: Number(result.overdue),
          partially_paid: Number(result.partially_paid),
          void: Number(result.void),
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
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
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
    { preHandler: [requireTenant], schema: { body: createInvoiceBody } },
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

      // Get default tax rate from tenant if not specified
      let taxRate = body.taxRate;
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
              eq(jobs.id, body.jobId!),
            ),
          );
        if (!job) {
          return reply.status(400).send({ message: "Job not found" });
        }
        jobTaxRate = job.taxRate;

        // Prevent duplicate invoices for the same job
        const existingInvoice = await db
          .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.jobId, body.jobId!),
              sql`${invoices.status} != 'void'`,
            ),
          )
          .then((r) => r[0]);

        if (existingInvoice) {
          return reply.status(400).send({
            message: `An active invoice already exists for this job (${existingInvoice.invoiceNumber})`,
            existingInvoiceId: existingInvoice.id,
          });
        }
      }

      const [invoice] = await db
        .insert(invoices)
        .values({
          tenantId,
          customerId: body.customerId,
          jobId: body.jobId ?? null,
          invoiceNumber: "", // Auto-generated by DB trigger
          issuedDate: body.issuedDate ?? new Date().toISOString().split("T")[0],
          dueDate: body.dueDate ?? null,
          taxRate: body.jobId ? (jobTaxRate ?? "0") : (taxRate ?? "0"),
          discountAmount: body.discountAmount ?? "0",
          notes: body.notes ?? null,
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
              eq(jobLineItems.jobId, body.jobId!),
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
    { preHandler: [requireTenant], schema: { params: idParam, body: updateInvoiceBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
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
    { preHandler: [requireTenant], schema: { params: idParam, body: addLineItemBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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
          itemType = itemType || catalogItem.itemType as "other" | "labor" | "material";
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
          catalogItemId: body.catalogItemId ?? null,
          itemType: itemType as never,
          description,
          quantity: body.quantity ?? "1",
          unitPrice,
          sortOrder: body.sortOrder ?? 0,
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
    { preHandler: [requireTenant], schema: { params: lineItemParam, body: updateLineItemBody } },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
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
      const bodyRecord = body as Record<string, unknown>;
      for (const field of allowedFields) {
        if (field in bodyRecord) {
          updates[field] = bodyRecord[field];
        }
      }

      const [updated] = await db
        .update(invoiceLineItems)
        .set(updates)
        .where(and(eq(invoiceLineItems.id, lineItemId), eq(invoiceLineItems.tenantId, tenantId)))
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
    { preHandler: [requireTenant], schema: { params: lineItemParam } },
    async (request, reply) => {
      const { id, lineItemId } = request.params;
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
        .where(and(eq(invoiceLineItems.id, lineItemId), eq(invoiceLineItems.tenantId, tenantId)));

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
    { preHandler: [requireTenant], schema: { params: idParam, body: recordPaymentBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

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
          amount: body.amount,
          paymentMethod: (body.paymentMethod as never) ?? null,
          paymentDate: body.paymentDate ?? new Date().toISOString().split("T")[0],
          referenceNumber: body.referenceNumber ?? null,
          notes: body.notes ?? null,
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

      dispatchNotification({
        tenantId,
        type: "invoice_paid",
        title: `Payment of $${parseFloat(body.amount).toFixed(2)} received`,
        description: `Payment recorded for invoice ${inv.invoiceNumber ?? id}${newStatus === "paid" ? " — fully paid" : ""}`,
        entityType: "invoice",
        entityId: id,
        actorId: request.authUser.userId,
        metadata: { invoiceNumber: inv.invoiceNumber, amount: body.amount, newStatus },
      });

      // E-08: Payment receipt + E-12: Review request (fire-and-forget)
      {
        const paymentAmount = parseFloat(body.amount);
        const remainingBalance = Math.max(0, balanceDue);
        const paymentDate = body.paymentDate ?? new Date().toISOString().split("T")[0];

        // Fetch customer + tenant for email
        const [emailCustomer, emailTenant] = await Promise.all([
          db.select().from(customers).where(eq(customers.id, inv.customerId)).then((r) => r[0]),
          db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]),
        ]);

        if (emailCustomer?.email) {
          const { sendPaymentReceiptEmail, sendReviewRequestEmail } = await import("../../lib/email.js");

          // E-08: Payment receipt
          sendPaymentReceiptEmail({
            to: emailCustomer.email,
            props: {
              customerName: `${emailCustomer.firstName} ${emailCustomer.lastName}`.trim(),
              businessName: emailTenant?.businessName ?? "HVAC Service",
              businessLogoUrl: emailTenant?.logoUrl ?? null,
              businessPhone: emailTenant?.phone ?? null,
              businessAddress: emailTenant?.address ?? null,
              invoiceNumber: inv.invoiceNumber ?? `INV-${inv.id.slice(0, 8)}`,
              paymentAmount,
              paymentDate: new Date(paymentDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
              paymentMethod: body.paymentMethod ?? null,
              remainingBalance,
            },
          }).catch((err) => console.error("[email] E-08 payment receipt failed:", err));

          // E-12: Review request (2h delay, only if paid in full + google review URL set)
          if (
            newStatus === "paid" &&
            emailTenant?.googleReviewUrl &&
            !inv.reviewRequestedAt
          ) {
            const REVIEW_DELAY_MS = 2 * 60 * 60 * 1000; // 2 hours
            setTimeout(async () => {
              try {
                // Re-verify invoice is still paid and review not yet requested
                const freshInv = await db
                  .select()
                  .from(invoices)
                  .where(eq(invoices.id, id))
                  .then((r) => r[0]);

                if (freshInv?.status !== "paid" || freshInv.reviewRequestedAt) return;

                await sendReviewRequestEmail({
                  to: emailCustomer.email!,
                  props: {
                    customerName: `${emailCustomer.firstName} ${emailCustomer.lastName}`.trim(),
                    businessName: emailTenant?.businessName ?? "HVAC Service",
                    businessLogoUrl: emailTenant?.logoUrl ?? null,
                    businessPhone: emailTenant?.phone ?? null,
                    businessAddress: emailTenant?.address ?? null,
                    googleReviewUrl: emailTenant.googleReviewUrl!,
                  },
                });

                // Mark review as requested (idempotency)
                await db
                  .update(invoices)
                  .set({ reviewRequestedAt: new Date() })
                  .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
              } catch (err) {
                console.error("[email] E-12 review request failed:", err);
              }
            }, REVIEW_DELAY_MS);
          }
        }
      }

      return reply.status(201).send({ data: payment });
    },
  );

  /**
   * DELETE /invoices/:id/payments/:paymentId
   * Remove a payment. Reverses amountPaid, balanceDue, status.
   */
  fastify.delete(
    "/:id/payments/:paymentId",
    { preHandler: [requireTenant], schema: { params: paymentParam } },
    async (request, reply) => {
      const { id, paymentId } = request.params;
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
        .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)));

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
   * Generate PDF → upload to R2 → set status to sent.
   */
  fastify.post(
    "/:id/send",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
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
          .where(and(eq(customers.id, inv.customerId), eq(customers.tenantId, tenantId)))
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

      // Upload to R2 (private bucket — streamed back through this API)
      const storagePath = `${tenantId}/${inv.id}.pdf`;
      await uploadFile("invoices", storagePath, pdfBuffer, "application/pdf");

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

      // E-06: Send invoice email with PDF attachment (fire-and-forget)
      if (customer?.email) {
        const { sendInvoiceEmail } = await import("../../lib/email.js");
        sendInvoiceEmail({
          to: customer.email,
          props: {
            customerName: `${customer.firstName} ${customer.lastName}`.trim(),
            businessName: tenant?.businessName ?? "HVAC Service",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            invoiceNumber: inv.invoiceNumber ?? `INV-${inv.id.slice(0, 8)}`,
            issuedDate: inv.issuedDate
              ? new Date(inv.issuedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
            dueDate: inv.dueDate
              ? new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              : "Upon receipt",
            lineItems: lineItems.map((li) => ({
              description: li.description ?? "",
              quantity: Number(li.quantity ?? 1),
              unitPrice: Number(li.unitPrice ?? 0),
              total: Number(li.total ?? 0),
            })),
            subtotal: Number(inv.subtotal ?? 0),
            taxAmount: Number(inv.taxAmount ?? 0),
            discountAmount: Number(inv.discountAmount ?? 0),
            totalAmount: Number(inv.totalAmount ?? 0),
            balanceDue: Number(inv.balanceDue ?? inv.totalAmount ?? 0),
            paymentInstructions: tenant?.invoicePaymentInstructions ?? null,
            termsConditions: tenant?.invoiceTermsConditions ?? null,
            footerMessage: tenant?.invoiceFooterMessage ?? null,
            licenseNumber: tenant?.licenseNumber ?? null,
          },
          pdf: {
            buffer: Buffer.from(pdfBuffer),
            filename: `${inv.invoiceNumber ?? "invoice"}.pdf`,
          },
        }).catch((err) => console.error("[email] E-06 invoice send failed:", err));
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * GET /invoices/:id/pdf
   * Download PDF. Stream from Storage or generate on-the-fly.
   */
  fastify.get(
    "/:id/pdf",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
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

      // If PDF exists in storage, stream it (falls through to regeneration if missing)
      if (inv.pdfStoragePath) {
        const buffer = await downloadFile("invoices", inv.pdfStoragePath);

        if (buffer) {
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
          .where(and(eq(customers.id, inv.customerId), eq(customers.tenantId, tenantId)))
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
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
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
    { preHandler: [requireTenant], schema: { params: idParam, body: updateInvoiceStatusBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

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

  // ===== BULK OPERATIONS =====

  /**
   * POST /invoices/bulk-archive
   * Archive multiple invoices (set archivedAt = now()).
   * Skips any already archived.
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
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            inArray(invoices.id, ids),
            isNull(invoices.archivedAt),
          ),
        );

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(invoices)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligibleIds)),
          );
      }

      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} invoice(s) already archived or not found` }]
          : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /invoices/bulk-restore
   * Restore multiple archived invoices (set archivedAt = null).
   * Skips any that are not currently archived.
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
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            inArray(invoices.id, ids),
            isNotNull(invoices.archivedAt),
          ),
        );

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(invoices)
          .set({ archivedAt: null, updatedAt: new Date() })
          .where(
            and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligibleIds)),
          );
      }

      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} invoice(s) not archived or not found` }]
          : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  /**
   * POST /invoices/bulk-delete
   * Hard delete multiple invoices. Only draft invoices may be deleted.
   * Non-draft invoices are included in the errors array.
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
        .select({ id: invoices.id, status: invoices.status })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, ids)));

      const eligible: string[] = [];
      const errors: { id: string; message: string }[] = [];

      for (const row of existing) {
        if (row.status === "draft") {
          eligible.push(row.id);
        } else {
          errors.push({
            id: row.id,
            message: `Invoice is ${row.status}, only draft invoices can be deleted`,
          });
        }
      }

      const notFoundCount = ids.length - existing.length;
      if (notFoundCount > 0) {
        errors.push({ id: "N/A", message: `${notFoundCount} invoice(s) not found` });
      }

      if (eligible.length > 0) {
        await db
          .delete(invoices)
          .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligible)));
      }

      return reply.send({ succeeded: eligible.length, failed: ids.length - eligible.length, errors });
    },
  );

  /**
   * POST /invoices/bulk-status-update
   * Update status on multiple non-archived invoices.
   */
  fastify.post(
    "/bulk-status-update",
    {
      preHandler: [requireTenant],
      schema: { body: bulkInvoiceStatusBody },
    },
    async (request, reply) => {
      const { ids, status } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            inArray(invoices.id, ids),
            isNull(invoices.archivedAt),
          ),
        );

      const eligibleIds = existing.map((r) => r.id);
      const skippedCount = ids.length - eligibleIds.length;

      if (eligibleIds.length > 0) {
        await db
          .update(invoices)
          .set({ status: status as never, updatedAt: new Date() })
          .where(
            and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligibleIds)),
          );
      }

      const errors =
        skippedCount > 0
          ? [{ id: "N/A", message: `${skippedCount} invoice(s) archived or not found, skipped` }]
          : [];

      return reply.send({ succeeded: eligibleIds.length, failed: skippedCount, errors });
    },
  );

  // ===== FROM JOB =====

  /**
   * POST /invoices/from-job/:jobId
   * Create invoice from a job. Copies customer, line items, tax rate.
   */
  fastify.post(
    "/from-job/:jobId",
    { preHandler: [requireTenant], schema: { params: jobIdParam } },
    async (request, reply) => {
      const { jobId } = request.params;
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

      // Check if a non-void invoice already exists for this job
      const existingInvoice = await db
        .select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            eq(invoices.jobId, jobId),
            sql`${invoices.status} != 'void'`,
          ),
        )
        .then((r) => r[0]);

      if (existingInvoice) {
        return reply.status(400).send({
          message: `An active invoice already exists for this job (${existingInvoice.invoiceNumber})`,
          existingInvoiceId: existingInvoice.id,
        });
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
};
export default invoiceRoutes;
