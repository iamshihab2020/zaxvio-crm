import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { dispatchNotification } from "../../lib/notifications.js";
import {
  getDb,
  quotes,
  quoteLineItems,
  quoteActivities,
  jobs,
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
  user,
  isNull,
  isNotNull,
  inArray,
} from "@hvac-saas/database";
import { uploadFile, downloadFile } from "../../lib/storage.js";
import { withSafeLogo } from "../../lib/pdf/logo.js";
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
import {
  emitQuoteCreatedEvent,
  emitQuoteResponseEvent,
  emitQuoteSentEvent,
} from "../../services/quotes/quote-events.service.js";
import { containsPattern } from "../../lib/search.js";
import { resolveLineItemDescription } from "../../lib/line-items.js";
import {
  loadEditableQuote,
  assertDraft,
  ownsCustomer,
  loadQuotableEquipment,
  canTransitionQuote,
  transitionRefusal,
  isQuoteStatus,
} from "../../lib/quote-guards.js";
import {
  recalculateQuoteTotals,
  logQuoteActivity,
  getQuoteStats,
  displayStatus,
  statusCondition,
} from "../../services/quotes/quotes.service.js";
import { todayInTimezone, formatDateOnly } from "../../lib/timezone.js";

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
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      // Build filters
      const filters = [eq(quotes.tenantId, tenantId)];
      filters.push(showArchived ? isNotNull(quotes.archivedAt) : isNull(quotes.archivedAt));

      if (search) {
        filters.push(
          or(
            ilike(quotes.quoteNumber, containsPattern(search)),
            ilike(quotes.notes, containsPattern(search)),
            ilike(customers.firstName, containsPattern(search)),
            ilike(customers.lastName, containsPattern(search)),
          )!,
        );
      }

      // Filter on the *derived* status so `?status=expired` returns the quotes
      // the user can see are expired, and `?status=sent` does not include ones
      // that have already lapsed but which the cron has not swept yet.
      if (status) {
        filters.push(statusCondition(status, timezone));
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
      const today = todayInTimezone(timezone);

      return reply.send({
        data: data.map((row) => ({
          ...row,
          status: displayStatus(row, today),
        })),
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
      const stats = await getQuoteStats(
        getDb(),
        request.authUser.tenantId!,
        request.authUser.tenantTimezone,
      );
      return reply.send({ data: stats });
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
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

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
          status: displayStatus(quoteRow, todayInTimezone(timezone)),
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

      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

      if (!(await ownsCustomer(db, tenantId, body.customerId))) {
        return reply.status(400).send({ message: "Customer not found" });
      }

      // QUO-22: `customerId` was validated and `equipmentId` was written
      // straight from the body. Equipment belongs to a customer, so a mis-set id
      // put another customer's serial number on a PDF that gets emailed out.
      if (body.equipmentId) {
        const owned = await loadQuotableEquipment(
          db,
          tenantId,
          body.equipmentId,
          body.customerId,
        );
        if (!owned.ok) {
          return reply.status(owned.status).send({ message: owned.message });
        }
      }

      // Ranges are enforced by `taxRateString` / `moneyString` in the schema now,
      // so the hand-rolled parseFloat guards that used to live here are gone.
      let taxRate = body.taxRate;
      if (!taxRate) {
        const [tenant] = await db
          .select({ defaultTaxRate: tenants.defaultTaxRate })
          .from(tenants)
          .where(eq(tenants.id, tenantId));
        taxRate = tenant?.defaultTaxRate ?? "0";
      }

      // Dates default in the *tenant's* timezone. `new Date()` here meant a
      // quote raised at 7pm Central was stamped with tomorrow's issue date.
      const today = todayInTimezone(timezone);
      const defaultExpiry = new Date(`${today}T12:00:00Z`);
      defaultExpiry.setUTCDate(defaultExpiry.getUTCDate() + 30);

      // Any catalog ids supplied with the lines must belong to this tenant.
      // Checked before the transaction so a bad id is a 400 rather than a
      // rollback of a quote the user watched succeed.
      const catalogIds = [
        ...new Set(
          (body.lineItems ?? [])
            .map((li) => li.catalogItemId)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      if (catalogIds.length > 0) {
        const owned = await db
          .select({ id: catalogItems.id })
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.tenantId, tenantId),
              inArray(catalogItems.id, catalogIds),
            ),
          );
        if (owned.length !== catalogIds.length) {
          return reply.status(400).send({ message: "Catalog item not found" });
        }
      }

      // One transaction: the quote, its line items, the totals and the activity
      // row land together or not at all (QUO-28).
      const created = await db.transaction(async (tx) => {
        // The number comes from a BEFORE INSERT trigger, so `RETURNING` already
        // carries it — the handler used to select the row again to read it
        // (QUO-32, verified).
        const [quote] = await tx
          .insert(quotes)
          .values({
            tenantId,
            customerId: body.customerId,
            quoteNumber: "", // Auto-generated by DB trigger
            issuedDate: body.issuedDate || today,
            expiryDate:
              body.expiryDate || defaultExpiry.toISOString().split("T")[0],
            taxRate: taxRate ?? "0",
            discountAmount: body.discountAmount || "0",
            notes: body.notes || null,
            equipmentId: body.equipmentId || null,
          })
          .returning();

        if (body.lineItems && body.lineItems.length > 0) {
          await tx.insert(quoteLineItems).values(
            body.lineItems.map((li, index) => ({
              tenantId,
              quoteId: quote.id,
              catalogItemId: li.catalogItemId || null,
              itemType: li.itemType,
              description: resolveLineItemDescription({
                description: li.description,
                itemType: li.itemType,
              }),
              quantity: li.quantity || "1",
              unitPrice: li.unitPrice,
              sortOrder: li.sortOrder ?? index,
            })),
          );
          await recalculateQuoteTotals(tx, quote.id, tenantId);
        }

        await logQuoteActivity(tx, {
          tenantId,
          quoteId: quote.id,
          type: "quote.created",
          description: `Quote ${quote.quoteNumber} created`,
          performedBy: request.authUser.userId,
          metadata: { lineItemCount: body.lineItems?.length ?? 0 },
        });

        // After `recalculateQuoteTotals`, so the payload carries real money
        // rather than the zeroes the row was inserted with — a workflow gating
        // on "quotes over $5,000" would otherwise never match anything.
        await emitQuoteCreatedEvent(tx, {
          tenantId,
          actorUserId: request.authUser.userId,
          quoteId: quote.id,
        });

        // Re-read so the response carries the recalculated totals rather than
        // the zeroes the row was inserted with.
        const [withTotals] = await tx
          .select()
          .from(quotes)
          .where(and(eq(quotes.id, quote.id), eq(quotes.tenantId, tenantId)));

        return withTotals;
      });

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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const existing = guard.quote;

      const draftGate = assertDraft(existing, "edited");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      if (body.customerId && body.customerId !== existing.customerId) {
        if (!(await ownsCustomer(db, tenantId, body.customerId))) {
          return reply.status(400).send({ message: "Customer not found" });
        }
      }

      if (body.equipmentId) {
        const owned = await loadQuotableEquipment(
          db,
          tenantId,
          body.equipmentId,
          body.customerId ?? existing.customerId,
        );
        if (!owned.ok) {
          return reply.status(owned.status).send({ message: owned.message });
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
      await logQuoteActivity(db, {
        tenantId,
        quoteId: id,
        type: "quote.updated",
        description: `Quote updated (${changedFields.join(", ")})`,
        performedBy: request.authUser.userId,
        metadata: { changedFields },
      });

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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }

      const draftGate = assertDraft(guard.quote, "deleted");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.quote, "given line items");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
      }

      const description = body.description;
      let unitPrice = body.unitPrice;
      let itemType = body.itemType;
      let catalogName: string | null = null;

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

        // A catalog id that is not this tenant's is a 400, not a silent
        // fall-through to an unpriced line.
        if (!catalogItem) {
          return reply.status(400).send({ message: "Catalog item not found" });
        }
        catalogName = catalogItem.name;
        unitPrice = unitPrice || catalogItem.unitPrice;
        itemType = itemType || catalogItem.itemType;
      }

      // A description is optional — a line can be nothing but a price. What it
      // is called falls back to the catalog name and then the item type, which
      // matters most here: this text renders on the public quote portal and the
      // quote PDF. `itemType` is now an enum at the schema, so the hand-rolled
      // `isItemType` check is only guarding the "neither supplied nor derivable"
      // case.
      if (!unitPrice || !itemType) {
        return reply.status(400).send({
          message: "unitPrice and itemType are required",
        });
      }
      const resolvedDescription = resolveLineItemDescription({
        description,
        catalogName,
        itemType,
      });

      // One transaction: insert, recalculate, log. A failure part-way used to
      // leave stored totals that did not match the line items (QUO-28).
      const lineItem = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(quoteLineItems)
          .values({
            tenantId,
            quoteId: id,
            catalogItemId: body.catalogItemId || null,
            itemType,
            description: resolvedDescription,
            quantity: body.quantity || "1",
            unitPrice,
            sortOrder: body.sortOrder ?? 0,
          })
          .returning();

        await recalculateQuoteTotals(tx, id, tenantId);
        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "line_item.added",
          description: `Line item added: ${resolvedDescription}`,
          performedBy: request.authUser.userId,
          metadata: { description: resolvedDescription },
        });
        return row;
      });

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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.quote, "edited");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
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

      if (body.catalogItemId) {
        const [owned] = await db
          .select({ id: catalogItems.id })
          .from(catalogItems)
          .where(
            and(
              eq(catalogItems.tenantId, tenantId),
              eq(catalogItems.id, body.catalogItemId),
            ),
          );
        if (!owned) {
          return reply.status(400).send({ message: "Catalog item not found" });
        }
      }

      // `itemType` is validated by the schema now — this handler used to copy
      // whatever was in the body into the update, so "banana" reached the
      // pgEnum as a 500 while POST 400'd on the same input (QUO-19).
      const allowedFields = [
        "description",
        "quantity",
        "unitPrice",
        "sortOrder",
        "itemType",
        "catalogItemId",
      ] as const;
      const updates: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(quoteLineItems)
          .set(updates)
          .where(
            and(
              eq(quoteLineItems.id, lineItemId),
              eq(quoteLineItems.tenantId, tenantId),
              eq(quoteLineItems.quoteId, id),
            ),
          )
          .returning();

        await recalculateQuoteTotals(tx, id, tenantId);
        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "line_item.updated",
          description: "Line item updated",
          performedBy: request.authUser.userId,
        });
        return row;
      });

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
      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const draftGate = assertDraft(guard.quote, "changed");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
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

      await db.transaction(async (tx) => {
        await tx
          .delete(quoteLineItems)
          .where(
            and(
              eq(quoteLineItems.tenantId, tenantId),
              eq(quoteLineItems.quoteId, id),
              eq(quoteLineItems.id, lineItemId),
            ),
          );

        await recalculateQuoteTotals(tx, id, tenantId);
        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "line_item.removed",
          description: "Line item removed",
          performedBy: request.authUser.userId,
        });
      });

      return reply.send({ message: "Line item deleted" });
    },
  );

  // ===== SEND / PDF =====

  /**
   * POST /quotes/:id/send
   * Generate PDF -> upload to R2 -> set status to sent.
   */
  fastify.post(
    "/:id/send",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.authUser.tenantId!;
      const timezone = request.authUser.tenantTimezone;
      const db = getDb();

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const q = guard.quote;

      const draftGate = assertDraft(q, "sent");
      if (draftGate) {
        return reply.status(draftGate.status).send({ message: draftGate.message });
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
        // Same SSRF guard the invoice PDF got (INV-05): `<Image src>` is fetched
        // by the API process, and `logoUrl` accepted any syntactically valid URL.
        withSafeLogo(tenant, tenantId),
        equipmentData,
      );

      // Upload to R2 (private bucket — streamed back through this API)
      const storagePath = `${tenantId}/${q.id}.pdf`;
      await uploadFile("quotes", storagePath, pdfBuffer, "application/pdf");

      // Generate access token for public quote acceptance
      const accessToken = crypto.randomUUID();

      // Update quote. In a transaction with its activity row and its event —
      // and, critically, *after* the PDF upload and the token above, so
      // `quote.sent` can never announce a quote the portal cannot open (QUO-01).
      const updated = await db.transaction(async (tx) => {
        await tx
          .update(quotes)
          .set({
            pdfStoragePath: storagePath,
            status: "sent",
            accessToken,
            updatedAt: new Date(),
          })
          .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)));

        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "quote.sent",
          description: "Quote sent",
          performedBy: request.authUser.userId,
        });

        await emitQuoteSentEvent(tx, {
          tenantId,
          actorUserId: request.authUser.userId,
          quoteId: id,
          // The same condition that decides whether the email carries a portal
          // link. QUO-04 found this setting enforced in exactly one place —
          // building that link — so a workflow must be told whether responding
          // is actually possible rather than assuming it from `status: sent`.
          onlineAcceptanceEnabled: tenant?.quoteOnlineAcceptanceEnabled !== false,
        });

        // Tenant-scoped, unlike the read this replaces — it matched on the
        // quote id alone ([[security-rules]] §1).
        const [row] = await tx
          .select()
          .from(quotes)
          .where(and(eq(quotes.tenantId, tenantId), eq(quotes.id, id)));
        return row;
      });

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
            // `new Date("2026-08-01")` is UTC midnight, so this rendered the day
            // before for any negative-offset reader. `formatDateOnly` parses at
            // local noon, which is the same rule the customer portal already
            // used — the two surfaces printed different dates (QUO-10).
            issuedDate: formatDateOnly(q.issuedDate) ?? formatDateOnly(todayInTimezone(timezone))!,
            expiryDate: formatDateOnly(q.expiryDate) ?? "30 days",
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

      // If PDF exists in storage, stream it (falls through to regeneration if missing)
      if (q.pdfStoragePath) {
        const buffer = await downloadFile("quotes", q.pdfStoragePath);

        if (buffer) {
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
        // Same SSRF guard the invoice PDF got (INV-05): `<Image src>` is fetched
        // by the API process, and `logoUrl` accepted any syntactically valid URL.
        withSafeLogo(tenant, tenantId),
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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const q = guard.quote;

      if (!canTransitionQuote(q.status, "accepted")) {
        return reply
          .status(400)
          .send({ message: transitionRefusal(q.status, "accepted") });
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(quotes)
          .set({
            status: "accepted",
            updatedAt: new Date(),
          })
          .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
          .returning();

        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "quote.accepted",
          description: "Quote accepted",
          performedBy: request.authUser.userId,
        });

        // The same event the public portal emits from inside its claim. One
        // shape whether a customer clicked Accept or staff marked it accepted
        // on the phone — the workflow does not care which, and should not have
        // to know two payloads to find out.
        await emitQuoteResponseEvent(tx, {
          tenantId,
          actorUserId: request.authUser.userId,
          quoteId: id,
          response: "accepted",
          // Staff acceptance carries no customer-requested slot; the portal is
          // the only surface that collects one.
          requestedDate: null,
          requestedTime: null,
          convertedToJobId: row?.convertedToJobId ?? null,
        });

        return row;
      });

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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const q = guard.quote;

      if (!canTransitionQuote(q.status, "declined")) {
        return reply
          .status(400)
          .send({ message: transitionRefusal(q.status, "declined") });
      }

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(quotes)
          .set({
            status: "declined",
            updatedAt: new Date(),
          })
          .where(and(eq(quotes.id, id), eq(quotes.tenantId, tenantId)))
          .returning();

        await logQuoteActivity(tx, {
          tenantId,
          quoteId: id,
          type: "quote.declined",
          description: "Quote declined",
          performedBy: request.authUser.userId,
        });

        await emitQuoteResponseEvent(tx, {
          tenantId,
          actorUserId: request.authUser.userId,
          quoteId: id,
          response: "declined",
          // Staff decline has no reason field on this endpoint. The portal's
          // does, and both feed the same payload key, so a "why did we lose
          // this" report reads one place.
          reason: row?.declineReason ?? null,
        });

        return row;
      });

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

      const guard = await loadEditableQuote(db, tenantId, id);
      if (!guard.ok) {
        return reply.status(guard.status).send({ message: guard.message });
      }
      const q = guard.quote;

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
      let jobId: string;
      try {
        ({ jobId } = await convertQuoteToJob(db, q, {
          pipelineStageId: body.pipelineStageId,
          serviceType: body.serviceType,
          scheduledDate: q.customerScheduledDate ?? undefined,
          scheduledTime: q.customerScheduledTime ?? undefined,
          performedBy: userId,
        }));
      } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_CONVERTED") {
          return reply.status(400).send({ message: "This quote has already been converted to a job" });
        }
        // QUO-27: a stage id from another pipeline (or another tenant) is a
        // client bug, not a move — 400 rather than silently re-piping the job.
        if (err instanceof Error && err.message === "INVALID_STAGE") {
          return reply.status(400).send({ message: "That stage does not belong to the default pipeline" });
        }
        throw err;
      }

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

      // `count: ids.length` reported the *request*, not the result — archiving
      // ten ids of which three exist said "10 archived" (QUO-29). `RETURNING`
      // gives the real number, and the `{succeeded, failed, errors}` shape is
      // what `bulkToast` reads to report partial failure honestly.
      const archived = await db
        .update(quotes)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            inArray(quotes.id, ids),
            isNull(quotes.archivedAt),
          ),
        )
        .returning({ id: quotes.id });

      return reply.send({
        succeeded: archived.length,
        failed: ids.length - archived.length,
        errors: [],
      });
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

      const restored = await db
        .update(quotes)
        .set({ archivedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(quotes.tenantId, tenantId),
            inArray(quotes.id, ids),
            isNotNull(quotes.archivedAt),
          ),
        )
        .returning({ id: quotes.id });

      return reply.send({
        succeeded: restored.length,
        failed: ids.length - restored.length,
        errors: [],
      });
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
      const found = new Set(existing.map((r) => r.id));

      for (const id of ids) {
        if (!found.has(id)) {
          errors.push({ id, message: "Quote not found" });
        }
      }

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

      // Was `{message, deleted, errors}` with no `failed`, so `bulkToast` took
      // the server `message` and the success branch: selecting ten sent quotes
      // and pressing Delete reported success and deleted nothing (QUO-29).
      return reply.send({
        succeeded: eligible.length,
        failed: errors.length,
        errors,
      });
    },
  );

  /**
   * POST /quotes/bulk-status-update
   * Move quotes to a new status, one transition table shared with the single
   * handlers.
   *
   * QUO-01. This used to be one `UPDATE` with no current-status check, no
   * transition check and no archived check. Because `sent` is not merely a
   * status — `/send` is what mints the access token, renders the PDF and emails
   * the customer — flipping a draft to `sent` here produced a quote with no
   * token and no PDF that `/send`, `PATCH` and `DELETE` then all refused,
   * because all three require `draft`. The quote could not be sent, edited or
   * deleted. Verified: `status=sent, token=NULL, pdf=NULL`.
   *
   * `sent` is no longer an accepted target at the schema; the transition table
   * governs the rest. Filter-then-execute so partial failure is reported.
   */
  fastify.post(
    "/bulk-status-update",
    { preHandler: [requireTenant], schema: { body: bulkQuoteStatusBody } },
    async (request, reply) => {
      const { ids, status } = request.body;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const existing = await db
        .select({
          id: quotes.id,
          status: quotes.status,
          archivedAt: quotes.archivedAt,
        })
        .from(quotes)
        .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.id, ids)));

      const eligible: string[] = [];
      const errors: { id: string; message: string }[] = [];
      const found = new Set(existing.map((r) => r.id));

      for (const id of ids) {
        if (!found.has(id)) errors.push({ id, message: "Quote not found" });
      }

      for (const row of existing) {
        if (row.archivedAt) {
          errors.push({
            id: row.id,
            message: "Cannot modify an archived quote. Restore it first.",
          });
          continue;
        }
        const from = isQuoteStatus(row.status) ? row.status : "draft";
        if (!canTransitionQuote(from, status)) {
          errors.push({ id: row.id, message: transitionRefusal(from, status) });
          continue;
        }
        eligible.push(row.id);
      }

      if (eligible.length > 0) {
        await db.transaction(async (tx) => {
          await tx
            .update(quotes)
            .set({ status, updatedAt: new Date() })
            .where(
              and(eq(quotes.tenantId, tenantId), inArray(quotes.id, eligible)),
            );

          // The single-quote handlers log an activity row for every status
          // change; the bulk path logged none, so a quote could change status
          // with no trace of who did it or when.
          for (const quoteId of eligible) {
            await logQuoteActivity(tx, {
              tenantId,
              quoteId,
              type: `quote.${status}`,
              description: `Quote marked ${status} (bulk)`,
              performedBy: request.authUser.userId,
            });
          }
        });
      }

      return reply.send({
        succeeded: eligible.length,
        failed: errors.length,
        errors,
      });
    },
  );
};
export default quoteRoutes;
