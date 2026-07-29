import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  idParam,
  lineItemParam,
  paymentParam,
  jobIdParam,
  invoiceListQuery,
  invoiceStatsQuery,
  createInvoiceBody,
  updateInvoiceBody,
  addLineItemBody,
  updateLineItemBody,
  recordPaymentBody,
  payInFullBody,
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
  gte,
  lte,
  isNull,
  isNotNull,
  inArray,
} from "@hvac-saas/database";
import { downloadFile, deleteFiles } from "../../lib/storage.js";
import { containsPattern } from "../../lib/search.js";
import { todayInTimezone } from "../../lib/timezone.js";
import {
  loadEditableInvoice,
  assertPayable,
  assertDraft,
  loadBillableJob,
  ownsCustomer,
  ownsCatalogItem,
} from "../../lib/invoice-guards.js";
import {
  canTransition,
  transitionMessage,
  overdueCondition,
  dueDateFromTerms,
  UNPAID_STATUSES,
  type InvoiceStatus,
} from "../../services/invoices/status.service.js";
import {
  recalculateInvoice,
  recordPayment,
  deletePayment,
  copyJobLineItems,
  findActiveInvoiceForJob,
  PaymentNotFoundError,
} from "../../services/invoices/invoices.service.js";
import {
  loadPdfBundle,
  renderInvoicePdf,
  storeInvoicePdf,
  contentDisposition,
  pdfStoragePath,
} from "../../services/invoices/pdf.service.js";
import { sendOverdueReminder } from "../../lib/cron/email-cron.js";

/**
 * Rate limits ([[security-rules]] §4).
 *
 * `POST /:id/send` and `GET /:id/pdf` both run `@react-pdf/renderer`, which is
 * CPU-bound and synchronous inside the render. They inherited only the 100
 * req/min global bucket, so 100 concurrent renders would stall the event loop
 * for every tenant on the instance (INV-13).
 */
const PDF_LIMIT = { max: 20, timeWindow: "1 minute" } as const;
const SEND_LIMIT = { max: 10, timeWindow: "1 minute" } as const;

/** Columns the list and the detail endpoint return. One definition. */
const LIST_COLUMNS = {
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
  creditAmount: invoices.creditAmount,
  notes: invoices.notes,
  pdfStoragePath: invoices.pdfStoragePath,
  archivedAt: invoices.archivedAt,
  createdAt: invoices.createdAt,
  updatedAt: invoices.updatedAt,
  customerFirstName: customers.firstName,
  customerLastName: customers.lastName,
};

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
        dateFrom,
        dateTo,
        page,
        limit,
        sortBy,
        sortOrder,
        showArchived,
      } = request.query;

      const tenantId = request.authUser.tenantId!;
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();
      const offset = (page - 1) * limit;

      const filters = [eq(invoices.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(invoices.archivedAt) : isNull(invoices.archivedAt));

      if (search) {
        // `escapeLike` was written during the customers audit and used by jobs
        // only, repo-wide. Unescaped, a `%` in the box matched every row and a
        // `_` matched any single character (INV-22).
        const pattern = containsPattern(search);
        filters.push(
          or(
            ilike(invoices.invoiceNumber, pattern),
            ilike(invoices.notes, pattern),
            ilike(customers.firstName, pattern),
            ilike(customers.lastName, pattern),
          )!,
        );
      }

      if (status === "overdue") {
        // Derived from due_date in the tenant's timezone, never from the stored
        // status — that column only flips when the cron runs. One definition,
        // shared with the stats endpoint and the dunning cron.
        filters.push(overdueCondition(timezone));
      } else if (status === "unpaid") {
        // "Still owes money" — the set the customer overview shows. Derived for
        // the same reason `overdue` is: it spans several stored statuses.
        filters.push(inArray(invoices.status, [...UNPAID_STATUSES]));
      } else if (status) {
        filters.push(eq(invoices.status, status));
      }
      if (customerId) filters.push(eq(invoices.customerId, customerId));
      if (jobId) filters.push(eq(invoices.jobId, jobId));
      // `dateFrom`/`dateTo` were declared in the schema and never read, so the
      // API accepted a date range and silently returned the unfiltered list.
      if (dateFrom) filters.push(gte(invoices.issuedDate, dateFrom));
      if (dateTo) filters.push(lte(invoices.issuedDate, dateTo));

      const whereClause = and(...filters);

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
          .select(LIST_COLUMNS)
          .from(invoices)
          .leftJoin(customers, eq(invoices.customerId, customers.id))
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limit)
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
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );

  /**
   * GET /invoices/stats
   * Aggregate status counts + outstanding money in a single query.
   */
  fastify.get(
    "/stats",
    { preHandler: [requireTenant], schema: { querystring: invoiceStatsQuery } },
    async (request, reply) => {
      const { customerId, jobId, dateFrom, dateTo, showArchived } = request.query;
      const tenantId = request.authUser.tenantId!;
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

      // INV-23: this endpoint took no querystring, so filtering the list to one
      // customer left the four KPI cards counting the whole tenant.
      const filters = [eq(invoices.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(invoices.archivedAt) : isNull(invoices.archivedAt));
      if (customerId) filters.push(eq(invoices.customerId, customerId));
      if (jobId) filters.push(eq(invoices.jobId, jobId));
      if (dateFrom) filters.push(gte(invoices.issuedDate, dateFrom));
      if (dateTo) filters.push(lte(invoices.issuedDate, dateTo));

      const [result] = await db
        .select({
          draft: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'draft')`,
          sent: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'sent')`,
          paid: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'paid')`,
          // Same derivation as the list filter and the dashboard.
          overdue: sql<number>`COUNT(*) FILTER (
            WHERE ${invoices.status} NOT IN ('paid', 'void')
              AND ${invoices.dueDate} IS NOT NULL
              AND ${invoices.dueDate} < (now() AT TIME ZONE ${timezone})::date
          )`,
          partially_paid: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'partially_paid')`,
          void: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'void')`,
          // The aging story the page was missing: how much is actually owed.
          outstanding: sql<string>`COALESCE(SUM(${invoices.balanceDue}) FILTER (
            WHERE ${invoices.status} NOT IN ('paid', 'void')
          ), 0)`,
          overdueAmount: sql<string>`COALESCE(SUM(${invoices.balanceDue}) FILTER (
            WHERE ${invoices.status} NOT IN ('paid', 'void')
              AND ${invoices.dueDate} IS NOT NULL
              AND ${invoices.dueDate} < (now() AT TIME ZONE ${timezone})::date
          ), 0)`,
        })
        .from(invoices)
        .where(and(...filters));

      return reply.send({
        data: {
          draft: Number(result.draft),
          sent: Number(result.sent),
          paid: Number(result.paid),
          overdue: Number(result.overdue),
          partially_paid: Number(result.partially_paid),
          void: Number(result.void),
          outstanding: Number(result.outstanding).toFixed(2),
          overdueAmount: Number(result.overdueAmount).toFixed(2),
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
          ...LIST_COLUMNS,
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
        data: { ...invoiceRow, lineItems, payments },
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
      const timezone = request.authUser.tenantTimezone;
      const body = request.body;
      const db = getDb();

      if (!(await ownsCustomer(db, tenantId, body.customerId))) {
        return reply.status(400).send({ message: "Customer not found" });
      }

      const [tenant] = await db
        .select({
          defaultTaxRate: tenants.defaultTaxRate,
          invoicePaymentTerms: tenants.invoicePaymentTerms,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      // INV-09: the old code checked that `body.jobId` belonged to the tenant
      // but never that the job belonged to the customer being billed, so a
      // mis-set jobId copied another customer's line items — and their money —
      // onto this invoice.
      let jobTaxRate: string | null = null;
      if (body.jobId) {
        const jobGuard = await loadBillableJob(
          db,
          tenantId,
          body.jobId,
          body.customerId,
        );
        if (!jobGuard.ok) {
          return reply.status(jobGuard.status).send({ message: jobGuard.message });
        }
        jobTaxRate = jobGuard.job.taxRate;

        const existing = await findActiveInvoiceForJob(db, tenantId, body.jobId);
        if (existing) {
          return reply.status(400).send({
            message: `An active invoice already exists for this job (${existing.invoiceNumber})`,
            existingInvoiceId: existing.id,
          });
        }
      }

      // INV-20: `new Date().toISOString()` is the *server's* UTC day. At 7pm
      // Central that is already tomorrow, so an invoice raised in the evening
      // was issued with tomorrow's date.
      const issuedDate = body.issuedDate ?? todayInTimezone(timezone);
      // INV-08: payment terms were collected, printed on the PDF and never used
      // to set a due date, so the setting was decorative and invoices raised
      // from a job were never overdue, never aged and never dunned.
      const dueDate =
        body.dueDate ?? dueDateFromTerms(issuedDate, tenant?.invoicePaymentTerms);

      // INV-04's sibling: this was an insert, a conditional second insert and a
      // recalculation with nothing tying them together, so a failure part-way
      // left an invoice whose totals did not match its line items.
      const invoiceId = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .insert(invoices)
          .values({
            tenantId,
            customerId: body.customerId,
            jobId: body.jobId ?? null,
            invoiceNumber: "", // Auto-generated by DB trigger
            issuedDate,
            dueDate,
            taxRate: body.jobId ? (jobTaxRate ?? "0") : (body.taxRate ?? tenant?.defaultTaxRate ?? "0"),
            discountAmount: body.discountAmount ?? "0",
            notes: body.notes ?? null,
          })
          .returning({ id: invoices.id });

        if (body.jobId) {
          await copyJobLineItems(tx, {
            tenantId,
            invoiceId: invoice.id,
            jobId: body.jobId,
          });
        }
        await recalculateInvoice(tx, invoice.id, tenantId);
        return invoice.id;
      });

      const [created] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

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

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.invoice, "edited");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      // A customer id from the request body was written straight through with
      // no ownership check — the `findForeignRef` class (INV-09).
      if (body.customerId && !(await ownsCustomer(db, tenantId, body.customerId))) {
        return reply.status(400).send({ message: "Customer not found" });
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
          if (field === "taxRate" || field === "discountAmount") {
            financialChange = true;
          }
        }
      }

      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set(updates)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)));

        if (financialChange) {
          await recalculateInvoice(tx, id, tenantId);
        }
      });

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

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.invoice, "deleted");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      await db
        .delete(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)));

      // INV-42: the stored PDF was left behind in R2. Rare, since only drafts
      // are deletable and drafts rarely hold one — but the jobs bulk-delete R2
      // cleanup landed in July and this is the same helper's absence.
      if (guard.invoice.pdfStoragePath) {
        await deleteFiles("invoices", [guard.invoice.pdfStoragePath]);
      }

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

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.invoice, "given line items");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      let description = body.description;
      let unitPrice = body.unitPrice;
      let itemType = body.itemType;

      if (body.catalogItemId) {
        // `if (catalogItem)` used to fall through silently when the item
        // belonged to another tenant and store the id anyway.
        if (!(await ownsCatalogItem(db, tenantId, body.catalogItemId))) {
          return reply.status(400).send({ message: "Catalog item not found" });
        }
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
          // INV-32: this was `catalogItem.itemType as "other" | "labor" |
          // "material"` — a 3-value union standing in for a 5-value enum, so
          // `part` and `service_call` were cast to something they are not.
          itemType = itemType || catalogItem.itemType;
        }
      }

      if (!description || !unitPrice || !itemType) {
        return reply.status(400).send({
          message: "description, unitPrice, and itemType are required",
        });
      }

      const lineItem = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(invoiceLineItems)
          .values({
            tenantId,
            invoiceId: id,
            catalogItemId: body.catalogItemId ?? null,
            itemType,
            description,
            quantity: body.quantity ?? "1",
            unitPrice,
            sortOrder: body.sortOrder ?? 0,
          })
          .returning();
        await recalculateInvoice(tx, id, tenantId);
        return created;
      });

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

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.invoice, "edited");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      const updates: Record<string, unknown> = {};
      for (const field of ["description", "quantity", "unitPrice", "sortOrder", "itemType"] as const) {
        if (field in body) updates[field] = body[field];
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No valid fields to update" });
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(invoiceLineItems)
          .set(updates)
          .where(
            and(
              eq(invoiceLineItems.id, lineItemId),
              eq(invoiceLineItems.invoiceId, id),
              eq(invoiceLineItems.tenantId, tenantId),
            ),
          )
          .returning();
        if (!row) return null;
        await recalculateInvoice(tx, id, tenantId);
        return row;
      });

      if (!updated) {
        return reply.status(404).send({ message: "Line item not found" });
      }

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

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.invoice, "edited");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      const removed = await db.transaction(async (tx) => {
        const rows = await tx
          .delete(invoiceLineItems)
          .where(
            and(
              eq(invoiceLineItems.id, lineItemId),
              eq(invoiceLineItems.invoiceId, id),
              eq(invoiceLineItems.tenantId, tenantId),
            ),
          )
          .returning({ id: invoiceLineItems.id });
        if (rows.length === 0) return false;
        await recalculateInvoice(tx, id, tenantId);
        return true;
      });

      if (!removed) {
        return reply.status(404).send({ message: "Line item not found" });
      }

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== PAYMENTS =====

  /**
   * POST /invoices/:id/payments
   * Record a payment. Auto-updates amountPaid, balanceDue, credit and status.
   */
  fastify.post(
    "/:id/payments",
    { preHandler: [requireTenant], schema: { params: idParam, body: recordPaymentBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const timezone = request.authUser.tenantTimezone;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      // INV-01: the only status checked was `void`, so a draft the customer had
      // never seen accepted a payment, flipped to `paid`, fired the
      // `invoice_paid` notification and emailed a receipt for a document that
      // was never sent.
      const payableGate = assertPayable(guard.invoice);
      if (payableGate) {
        return reply.status(payableGate.status).send({ message: payableGate.message });
      }

      const result = await recordPayment(db, {
        tenantId,
        invoiceId: id,
        input: {
          amount: body.amount,
          paymentMethod: body.paymentMethod,
          paymentDate: body.paymentDate ?? todayInTimezone(timezone),
          referenceNumber: body.referenceNumber,
          notes: body.notes,
        },
      });

      await afterPayment(request, {
        tenantId,
        invoice: guard.invoice,
        result,
        amount: body.amount,
        paymentMethod: body.paymentMethod ?? null,
        paymentDate: body.paymentDate ?? todayInTimezone(timezone),
      });

      return reply.status(201).send({
        data: result.payment,
        totals: result.totals,
      });
    },
  );

  /**
   * POST /invoices/:id/pay-in-full
   * One-tap "the customer handed me a cheque". Records a payment for exactly
   * the outstanding balance, read under the same row lock that writes it.
   */
  fastify.post(
    "/:id/pay-in-full",
    { preHandler: [requireTenant], schema: { params: idParam, body: payInFullBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const timezone = request.authUser.tenantTimezone;
      const body = request.body ?? {};
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const payableGate = assertPayable(guard.invoice);
      if (payableGate) {
        return reply.status(payableGate.status).send({ message: payableGate.message });
      }

      const balance = parseFloat(guard.invoice.balanceDue);
      if (!(balance > 0)) {
        return reply.status(400).send({ message: "This invoice has no outstanding balance" });
      }

      const amount = balance.toFixed(2);
      const paymentDate = body.paymentDate ?? todayInTimezone(timezone);
      const result = await recordPayment(db, {
        tenantId,
        invoiceId: id,
        input: {
          amount,
          paymentMethod: body.paymentMethod,
          paymentDate,
          referenceNumber: body.referenceNumber,
          notes: null,
        },
      });

      await afterPayment(request, {
        tenantId,
        invoice: guard.invoice,
        result,
        amount,
        paymentMethod: body.paymentMethod ?? null,
        paymentDate,
      });

      return reply.status(201).send({
        data: result.payment,
        totals: result.totals,
      });
    },
  );

  /**
   * DELETE /invoices/:id/payments/:paymentId
   * Remove a payment. Reverses amountPaid, balanceDue, credit and status.
   */
  fastify.delete(
    "/:id/payments/:paymentId",
    { preHandler: [requireTenant], schema: { params: paymentParam } },
    async (request, reply) => {
      const { id, paymentId } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      // INV-03: this handler had no status guard at all, and the only thing
      // stopping a void invoice from being resurrected was the browser hiding
      // the button.
      if (guard.invoice.status === "void") {
        return reply
          .status(400)
          .send({ message: "Cannot modify payments on a void invoice" });
      }

      try {
        const totals = await deletePayment(db, {
          tenantId,
          invoiceId: id,
          paymentId,
        });
        return reply.send({ message: "Payment deleted", totals });
      } catch (err) {
        if (err instanceof PaymentNotFoundError) {
          return reply.status(404).send({ message: "Payment not found" });
        }
        throw err;
      }
    },
  );

  // ===== SEND / PDF =====

  /**
   * POST /invoices/:id/send
   * Generate PDF → upload to R2 → set status to sent → email the customer.
   */
  fastify.post(
    "/:id/send",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
      config: { rateLimit: SEND_LIMIT },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      if (guard.invoice.status === "void") {
        return reply.status(400).send({ message: "Cannot send a void invoice" });
      }

      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), eq(invoices.id, id)));

      const bundle = await loadPdfBundle(db, { tenantId, invoice: inv });
      const { buffer, storagePath } = await storeInvoicePdf(bundle, tenantId);

      // draft → sent is the one legal transition here; every other status keeps
      // its own (re-sending a partially paid invoice must not reset it).
      const nextStatus: InvoiceStatus =
        guard.invoice.status === "draft" ? "sent" : guard.invoice.status;

      await db
        .update(invoices)
        .set({
          pdfStoragePath: storagePath,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));

      const [updated] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, id));

      const { customer, tenant } = bundle;
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
            issuedDate: formatDateOnly(inv.issuedDate),
            dueDate: inv.dueDate ? formatDateOnly(inv.dueDate) : "Upon receipt",
            lineItems: bundle.lineItems.map((li) => ({
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
            buffer: Buffer.from(buffer),
            filename: `${inv.invoiceNumber ?? "invoice"}.pdf`,
          },
        }).catch((err) => console.error("[email] E-06 invoice send failed:", err));
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /invoices/:id/remind
   * Send the overdue reminder now. Dunning was cron-only and fired at most once
   * per 24h, so a contractor who wanted to nudge a customer had no button.
   */
  fastify.post(
    "/:id/remind",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
      config: { rateLimit: SEND_LIMIT },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      if (!UNPAID_STATUSES.includes(guard.invoice.status)) {
        return reply
          .status(400)
          .send({ message: "Only an unpaid, sent invoice can be reminded about" });
      }
      if (!guard.invoice.dueDate) {
        return reply
          .status(400)
          .send({ message: "Set a due date before sending a payment reminder" });
      }

      const sent = await sendOverdueReminder(db, id);
      if (!sent.ok) {
        return reply.status(400).send({ message: sent.message });
      }
      return reply.send({ message: "Reminder sent" });
    },
  );

  /**
   * GET /invoices/:id/pdf
   * Download PDF. Stream from storage or generate on the fly.
   */
  fastify.get(
    "/:id/pdf",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
      config: { rateLimit: PDF_LIMIT },
    },
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

      // INV-25: a voided invoice's stored PDF is indistinguishable from a live
      // one, so serving the cached copy would hand the customer a document that
      // still reads as payable. Void always re-renders, with the watermark.
      if (inv.pdfStoragePath && inv.status !== "void") {
        const buffer = await downloadFile("invoices", inv.pdfStoragePath);
        if (buffer) {
          return reply
            .type("application/pdf")
            .header("Content-Disposition", contentDisposition(inv.invoiceNumber))
            .send(buffer);
        }
      }

      const bundle = await loadPdfBundle(db, { tenantId, invoice: inv });
      const pdfBuffer = await renderInvoicePdf(bundle, tenantId);

      return reply
        .type("application/pdf")
        .header("Content-Disposition", contentDisposition(inv.invoiceNumber))
        .send(pdfBuffer);
    },
  );

  // ===== VOID =====

  /**
   * POST /invoices/:id/void
   * Void an invoice. Legal from any non-terminal status.
   */
  fastify.post(
    "/:id/void",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      if (!canTransition(guard.invoice.status, "void")) {
        return reply
          .status(400)
          .send({ message: transitionMessage(guard.invoice.status, "void") });
      }

      const [updated] = await db
        .update(invoices)
        .set({ status: "void", updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .returning();

      // The stored PDF says nothing about being void, so a customer holding the
      // link would keep a payable-looking document. Drop it; the next request
      // re-renders with the watermark.
      if (guard.invoice.pdfStoragePath) {
        await deleteFiles("invoices", [guard.invoice.pdfStoragePath]);
        await db
          .update(invoices)
          .set({ pdfStoragePath: null })
          .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)));
      }

      return reply.send({ data: updated });
    },
  );

  // ===== STATUS UPDATE =====

  /**
   * PATCH /invoices/:id/status
   * Manual status update, through the transition table.
   */
  fastify.patch(
    "/:id/status",
    { preHandler: [requireTenant], schema: { params: idParam, body: updateInvoiceStatusBody } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      const guard = await loadEditableInvoice(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      // This wrote *any* of the six enum values with no rules: `void → draft`
      // un-voided a cancelled invoice, and `draft → paid` recorded money as
      // received with zero payment rows while amountPaid and balanceDue stayed
      // where they were (INV-01).
      if (!canTransition(guard.invoice.status, body.status)) {
        return reply
          .status(400)
          .send({ message: transitionMessage(guard.invoice.status, body.status) });
      }

      const [updated] = await db
        .update(invoices)
        .set({ status: body.status, updatedAt: new Date() })
        .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  // ===== BULK OPERATIONS =====

  /**
   * POST /invoices/bulk-archive
   */
  fastify.post(
    "/bulk-archive",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
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
          .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligibleIds)));
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
   */
  fastify.post(
    "/bulk-restore",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
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
          .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligibleIds)));
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
   * Hard delete. Only draft invoices may be deleted.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const { ids } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({
          id: invoices.id,
          status: invoices.status,
          pdfStoragePath: invoices.pdfStoragePath,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, ids)));

      const eligible: string[] = [];
      const storagePaths: string[] = [];
      const errors: { id: string; message: string }[] = [];

      for (const row of existing) {
        if (row.status === "draft") {
          eligible.push(row.id);
          if (row.pdfStoragePath) storagePaths.push(row.pdfStoragePath);
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
        // Same R2 cleanup the single delete does (INV-42).
        if (storagePaths.length > 0) {
          await deleteFiles("invoices", storagePaths);
        }
      }

      return reply.send({
        succeeded: eligible.length,
        failed: ids.length - eligible.length,
        errors,
      });
    },
  );

  /**
   * POST /invoices/bulk-status-update
   * Update status on multiple non-archived invoices, one transition table.
   */
  fastify.post(
    "/bulk-status-update",
    { preHandler: [requireTenant], schema: { body: bulkInvoiceStatusBody } },
    async (request, reply) => {
      const { ids, status } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({ id: invoices.id, status: invoices.status, invoiceNumber: invoices.invoiceNumber })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, tenantId),
            inArray(invoices.id, ids),
            isNull(invoices.archivedAt),
          ),
        );

      // The single and the bulk path share `canTransition`, so a move the
      // detail sheet refuses cannot be smuggled through by selecting the row.
      const eligible: string[] = [];
      const errors: { id: string; message: string }[] = [];
      for (const row of existing) {
        if (canTransition(row.status as InvoiceStatus, status)) {
          eligible.push(row.id);
        } else {
          errors.push({
            id: row.id,
            message: `${row.invoiceNumber}: ${transitionMessage(row.status as InvoiceStatus, status)}`,
          });
        }
      }

      const notFoundCount = ids.length - existing.length;
      if (notFoundCount > 0) {
        errors.push({ id: "N/A", message: `${notFoundCount} invoice(s) archived or not found` });
      }

      if (eligible.length > 0) {
        await db
          .update(invoices)
          .set({ status, updatedAt: new Date() })
          .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.id, eligible)));
      }

      return reply.send({
        succeeded: eligible.length,
        failed: ids.length - eligible.length,
        errors,
      });
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
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

      const jobGuard = await loadBillableJob(db, tenantId, jobId, null);
      if (!jobGuard.ok) {
        return reply.status(404).send({ message: "Job not found" });
      }
      const job = jobGuard.job;

      const existing = await findActiveInvoiceForJob(db, tenantId, jobId);
      if (existing) {
        return reply.status(400).send({
          message: `An active invoice already exists for this job (${existing.invoiceNumber})`,
          existingInvoiceId: existing.id,
        });
      }

      const [tenant] = await db
        .select({ invoicePaymentTerms: tenants.invoicePaymentTerms })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      const issuedDate = todayInTimezone(timezone);
      // This path never set a due date at all, so every invoice raised from a
      // job — the primary flow — was never overdue, never aged, never dunned,
      // and printed payment terms above a blank due date (INV-08).
      const dueDate = dueDateFromTerms(issuedDate, tenant?.invoicePaymentTerms);

      const invoiceId = await db.transaction(async (tx) => {
        const [invoice] = await tx
          .insert(invoices)
          .values({
            tenantId,
            customerId: job.customerId,
            jobId: job.id,
            invoiceNumber: "", // Auto-generated by DB trigger
            taxRate: job.taxRate ?? "0",
            issuedDate,
            dueDate,
          })
          .returning({ id: invoices.id });

        await copyJobLineItems(tx, { tenantId, invoiceId: invoice.id, jobId });
        await recalculateInvoice(tx, invoice.id, tenantId);
        return invoice.id;
      });

      const [created] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, invoiceId));

      return reply.status(201).send({ data: created });
    },
  );
};

// ========== HELPERS ==========

/** `YYYY-MM-DD` → "Jul 29, 2026", without the UTC-midnight day shift. */
function formatDateOnly(value: string): string {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Notification + E-08 receipt + E-12 review scheduling, shared by
 * `POST /:id/payments` and `POST /:id/pay-in-full`.
 *
 * The E-12 half is INV-29 / DF-INV-04: this used to be a two-hour in-memory
 * `setTimeout`, so any deploy, crash or scale event dropped every pending
 * review request silently. It writes a due time to the row now and the cron
 * next door picks it up — which also means it survives the process that
 * recorded the payment dying immediately afterwards.
 */
async function afterPayment(
  request: { authUser: { userId: string } },
  params: {
    tenantId: string;
    invoice: { id: string; invoiceNumber: string; customerId: string; reviewRequestedAt: Date | null };
    result: { totals: { status: InvoiceStatus; balanceDue: number; creditAmount: number } };
    amount: string;
    paymentMethod: string | null;
    paymentDate: string;
  },
): Promise<void> {
  const { tenantId, invoice, result, amount, paymentMethod, paymentDate } = params;
  const db = getDb();
  const paidInFull = result.totals.status === "paid";

  dispatchNotification({
    tenantId,
    type: "invoice_paid",
    title: `Payment of $${parseFloat(amount).toFixed(2)} received`,
    description: `Payment recorded for invoice ${invoice.invoiceNumber || invoice.id}${paidInFull ? " — fully paid" : ""}`,
    entityType: "invoice",
    entityId: invoice.id,
    actorId: request.authUser.userId,
    metadata: {
      invoiceNumber: invoice.invoiceNumber,
      amount,
      newStatus: result.totals.status,
    },
  });

  const [emailCustomer, emailTenant] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, invoice.customerId)).then((r) => r[0]),
    db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]),
  ]);

  if (!emailCustomer?.email) return;

  const { sendPaymentReceiptEmail } = await import("../../lib/email.js");
  sendPaymentReceiptEmail({
    to: emailCustomer.email,
    props: {
      customerName: `${emailCustomer.firstName} ${emailCustomer.lastName}`.trim(),
      businessName: emailTenant?.businessName ?? "HVAC Service",
      businessLogoUrl: emailTenant?.logoUrl ?? null,
      businessPhone: emailTenant?.phone ?? null,
      businessAddress: emailTenant?.address ?? null,
      invoiceNumber: invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`,
      paymentAmount: parseFloat(amount),
      paymentDate: formatDateOnly(paymentDate),
      paymentMethod,
      remainingBalance: result.totals.balanceDue,
    },
  }).catch((err) => console.error("[email] E-08 payment receipt failed:", err));

  if (paidInFull && emailTenant?.googleReviewUrl && !invoice.reviewRequestedAt) {
    const REVIEW_DELAY_MS = 2 * 60 * 60 * 1000;
    await db
      .update(invoices)
      .set({ reviewEmailScheduledAt: new Date(Date.now() + REVIEW_DELAY_MS) })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, tenantId)));
  }
}

export default invoiceRoutes;
