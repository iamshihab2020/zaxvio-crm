import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { idParam, paginationQuery } from "../../lib/schemas/common.js";
import { containsPattern } from "../../lib/search.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import {
  assignTagBody,
  createCustomerBody,
  createNoteBody,
  customerListQuery,
  duplicateCheckQuery,
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
  invoices,
  quotes,
  maintenanceContracts,
  equipment,
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

/**
 * A bulk response the UI can actually render.
 *
 * Every bulk endpoint on the platform returned `{succeeded, failed, errors}` and
 * every bulk hook read `res.message`, so the fallback string always won and
 * partial failures were invisible — "Customers deleted" for records the server
 * had refused (CUST-03). `message` is now built from the counts here.
 */
function bulkResult(
  verb: string,
  succeeded: number,
  failed: number,
  errors: { id: string; message: string }[],
) {
  // `failed` is passed explicitly rather than derived from `errors.length` — a
  // single entry can stand for several skipped rows ("3 customer(s) not found").
  const message =
    failed === 0
      ? `${succeeded} customer${succeeded === 1 ? "" : "s"} ${verb}`
      : succeeded === 0
        ? `No customers were ${verb} — ${failed} could not be processed`
        : `${succeeded} ${verb}, ${failed} skipped`;
  return { succeeded, failed, errors, message };
}

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
      const { search = "", page, limit, sortBy, sortOrder, showArchived, tagId } = request.query;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const offset = (page - 1) * limit;

      const baseFilter = eq(customers.tenantId, tenantId);
      const archiveFilter = showArchived ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt);

      // Wildcards are escaped so `%` matches a percent sign rather than every row,
      // and the concatenated name is matched too — searching "Ann Smith" hit none
      // of the four independent columns before (CUST-16).
      const searchFilter = search
        ? or(
            ilike(customers.firstName, containsPattern(search)),
            ilike(customers.lastName, containsPattern(search)),
            ilike(customers.email, containsPattern(search)),
            ilike(customers.phone, containsPattern(search)),
            ilike(
              sql`${customers.firstName} || ' ' || ${customers.lastName}`,
              containsPattern(search),
            ),
          )
        : undefined;

      // CUST-12 — tags were assignable but not filterable, which is the only
      // thing that makes a tag worth applying.
      const tagFilter = tagId
        ? sql`EXISTS (
            SELECT 1 FROM ${customerTags}
            WHERE ${customerTags.customerId} = ${customers.id}
              AND ${customerTags.tagId} = ${tagId}
          )`
        : undefined;

      const whereClause = and(baseFilter, archiveFilter, searchFilter, tagFilter);

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

      // Tags for the rows on this page — one extra query keyed by the ids we just
      // fetched, not one per row. Without this the tag chips in the table would
      // have nothing to render and filtering by tag would be unreachable from the
      // list, which is how tags ended up write-only in the first place (CUST-12).
      const pageIds = data.map((c) => c.id);
      const tagRows = pageIds.length
        ? await db
            .select({
              customerId: customerTags.customerId,
              id: tags.id,
              name: tags.name,
              color: tags.color,
            })
            .from(customerTags)
            .innerJoin(tags, eq(customerTags.tagId, tags.id))
            .where(
              and(
                inArray(customerTags.customerId, pageIds),
                eq(tags.tenantId, tenantId),
              ),
            )
            .orderBy(tags.name)
        : [];

      const tagsByCustomer = new Map<string, { id: string; name: string; color: string | null }[]>();
      for (const row of tagRows) {
        const list = tagsByCustomer.get(row.customerId) ?? [];
        list.push({ id: row.id, name: row.name, color: row.color });
        tagsByCustomer.set(row.customerId, list);
      }

      return reply.send({
        data: data.map((c) => ({ ...c, tags: tagsByCustomer.get(c.id) ?? [] })),
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

      // `archived_at IS NULL` matches what GET /customers shows by default.
      // Without it "Total" counted archived customers the table was hiding, so
      // the card and the rows beneath it stopped reconciling the moment anyone
      // archived anybody (CUST-04). The `!= ''` guards are for the same reason
      // the email/phone ones exist — see CUST-11.
      const [result] = await db
        .select({
          total: sql<number>`COUNT(*)`,
          withEmail: sql<number>`COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')`,
          withPhone: sql<number>`COUNT(*) FILTER (WHERE phone IS NOT NULL AND phone != '')`,
          withAddress: sql<number>`COUNT(*) FILTER (WHERE (address IS NOT NULL AND address != '') OR (city IS NOT NULL AND city != ''))`,
          archived: sql<number>`0`,
        })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), isNull(customers.archivedAt)));

      const [archivedRow] = await db
        .select({ archived: sql<number>`COUNT(*)` })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), isNotNull(customers.archivedAt)));

      return reply.send({
        data: {
          total: Number(result.total),
          withEmail: Number(result.withEmail),
          withPhone: Number(result.withPhone),
          withAddress: Number(result.withAddress),
          archived: Number(archivedRow?.archived ?? 0),
        },
      });
    },
  );

  /**
   * GET /customers/check-duplicate?email=…
   * Does another customer already use this email? Advisory — creation is not
   * blocked, because a shared household address is legitimate. The public
   * booking portal links submissions to customers by email, so duplicates make
   * that match ambiguous and the history splits across two records (CUST-28).
   */
  fastify.get(
    "/check-duplicate",
    {
      preHandler: [requireTenant],
      schema: { querystring: duplicateCheckQuery },
    },
    async (request, reply) => {
      const { email, excludeId } = request.query;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const normalised = email.trim().toLowerCase();
      if (normalised.length === 0) {
        return reply.send({ data: { duplicate: null } });
      }

      const match = await db
        .select({
          id: customers.id,
          firstName: customers.firstName,
          lastName: customers.lastName,
          archivedAt: customers.archivedAt,
        })
        .from(customers)
        .where(
          and(
            eq(customers.tenantId, tenantId),
            sql`LOWER(${customers.email}) = ${normalised}`,
            excludeId ? sql`${customers.id} <> ${excludeId}` : undefined,
          ),
        )
        .limit(1)
        .then((r) => r[0]);

      return reply.send({ data: { duplicate: match ?? null } });
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
      // The schema already trims, lower-cases the email, normalises the phone and
      // maps "" to null, so both verbs agree on what an empty field means and no
      // caller can bypass it (CUST-07/08/09/11).
      const [customer] = await db
        .insert(customers)
        .values({
          tenantId,
          firstName,
          lastName,
          email: email ?? null,
          phone: phone ?? null,
          address: address ?? null,
          city: city ?? null,
          state: state ?? null,
          zipCode: zipCode ?? null,
          notes: notes ?? null,
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
   * GET /customers/:id/summary
   * Lifetime counts and the outstanding balance, aggregated in SQL.
   *
   * The overview tab used to fetch five list endpoints and reduce them in the
   * browser, so "Outstanding" was the sum of whichever invoices fell on the first
   * page of 20 and the asset/agreement counts were `page.length` capped at 100
   * (CUST-05). Aggregates belong in the database — these are exact, and it is one
   * round trip instead of five.
   */
  fastify.get(
    "/:id/summary",
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

      const [jobStats, invoiceStats, assetStats, agreementStats] = await Promise.all([
        db
          .select({
            total: sql<number>`COUNT(*)`,
            open: sql<number>`COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress'))`,
          })
          .from(jobs)
          .where(
            and(
              eq(jobs.tenantId, tenantId),
              eq(jobs.customerId, id),
              isNull(jobs.archivedAt),
            ),
          )
          .then((r) => r[0]),
        db
          .select({
            open: sql<number>`COUNT(*) FILTER (WHERE status IN ('sent', 'overdue', 'partially_paid'))`,
            outstanding: sql<string>`COALESCE(SUM(balance_due) FILTER (WHERE status IN ('sent', 'overdue', 'partially_paid')), 0)`,
            lifetimePaid: sql<string>`COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0)`,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, tenantId),
              eq(invoices.customerId, id),
              isNull(invoices.archivedAt),
            ),
          )
          .then((r) => r[0]),
        db
          .select({ total: sql<number>`COUNT(*)` })
          .from(equipment)
          .where(
            and(
              eq(equipment.tenantId, tenantId),
              eq(equipment.customerId, id),
              isNull(equipment.archivedAt),
            ),
          )
          .then((r) => r[0]),
        db
          .select({ active: sql<number>`COUNT(*) FILTER (WHERE is_active)` })
          .from(maintenanceContracts)
          .where(
            and(
              eq(maintenanceContracts.tenantId, tenantId),
              eq(maintenanceContracts.customerId, id),
            ),
          )
          .then((r) => r[0]),
      ]);

      // "Last seen" — the most recent job actually on the books. Drives the
      // lapsed-customer view; null means they have never been scheduled.
      const lastJob = await db
        .select({ scheduledDate: jobs.scheduledDate })
        .from(jobs)
        .where(
          and(
            eq(jobs.tenantId, tenantId),
            eq(jobs.customerId, id),
            isNull(jobs.archivedAt),
          ),
        )
        .orderBy(desc(jobs.scheduledDate))
        .limit(1)
        .then((r) => r[0]);

      return reply.send({
        data: {
          totalJobs: Number(jobStats?.total ?? 0),
          openJobs: Number(jobStats?.open ?? 0),
          openInvoices: Number(invoiceStats?.open ?? 0),
          outstandingAmount: String(invoiceStats?.outstanding ?? "0"),
          lifetimeValue: String(invoiceStats?.lifetimePaid ?? "0"),
          totalAssets: Number(assetStats?.total ?? 0),
          activeAgreements: Number(agreementStats?.active ?? 0),
          lastJobDate: lastJob?.scheduledDate ?? null,
        },
      });
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
          // The schema maps "" to null, so clearing a field stores NULL here just
          // as it does on create. Previously PATCH wrote the raw "" and the two
          // verbs disagreed about what "empty" looks like in the column (CUST-11).
          updates[field] = body[field] ?? null;
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

      // Safety guard: refuse delete if the customer has related records.
      //
      // The jobs count deliberately does NOT filter `archivedAt`. It used to, and
      // `jobs.customer_id` is `ON DELETE CASCADE` — so archiving a job removed it
      // from the guard's view but not from the database, and deleting the customer
      // destroyed it along with its line items, photos and checklist, while the UI
      // reported success. Archiving is offered as the *safe* alternative to
      // deleting, which is exactly how someone reaches this (CUST-01).
      const [[{ count: jc }], [{ count: ic }], [{ count: qc }]] = await Promise.all([
        db.select({ count: count() }).from(jobs)
          .where(and(eq(jobs.tenantId, tenantId), eq(jobs.customerId, id))),
        db.select({ count: count() }).from(invoices)
          .where(and(eq(invoices.tenantId, tenantId), eq(invoices.customerId, id))),
        db.select({ count: count() }).from(quotes)
          .where(and(eq(quotes.tenantId, tenantId), eq(quotes.customerId, id))),
      ]);
      if (Number(jc) > 0 || Number(ic) > 0 || Number(qc) > 0) {
        const parts = [
          Number(jc) > 0 ? `${jc} job${Number(jc) === 1 ? "" : "s"}` : null,
          Number(ic) > 0 ? `${ic} invoice${Number(ic) === 1 ? "" : "s"}` : null,
          Number(qc) > 0 ? `${qc} quote${Number(qc) === 1 ? "" : "s"}` : null,
        ].filter(Boolean);
        return reply.status(400).send({
          message: `Cannot delete this customer — they still have ${parts.join(", ")} (archived records count too). Archive the customer instead, or delete those records first.`,
        });
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
      const userId = request.authUser.userId;
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

        // CUST-26 — archive/restore/tag changes left no trace, so the Activity
        // tab was a partial record presented as a complete one.
        await db.insert(customerActivities).values(
          eligibleIds.map((customerId) => ({
            tenantId,
            customerId,
            type: "customer.archived",
            description: "Customer archived",
            performedBy: userId,
          })),
        );
      }

      const errors = skippedCount > 0
        ? [{ id: "N/A", message: `${skippedCount} customer(s) already archived or not found` }]
        : [];

      return reply.send(bulkResult("archived", eligibleIds.length, skippedCount, errors));
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
      const userId = request.authUser.userId;
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

        await db.insert(customerActivities).values(
          eligibleIds.map((customerId) => ({
            tenantId,
            customerId,
            type: "customer.restored",
            description: "Customer restored from archive",
            performedBy: userId,
          })),
        );
      }

      const errors = skippedCount > 0
        ? [{ id: "N/A", message: `${skippedCount} customer(s) not archived or not found` }]
        : [];

      return reply.send(bulkResult("restored", eligibleIds.length, skippedCount, errors));
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

      const foundIds = existing.map((r) => r.id);
      const notFoundCount = ids.length - foundIds.length;

      // Check which customers have related entities (jobs/invoices/quotes).
      // Archived jobs count — see the CUST-01 note on DELETE /:id. The same
      // `isNull(jobs.archivedAt)` hole existed here, so a multi-select destroyed
      // archived jobs exactly as the single delete did.
      const [relatedJobs, relatedInvoices, relatedQuotes] = await Promise.all([
        foundIds.length > 0
          ? db.select({ customerId: jobs.customerId, count: count() }).from(jobs)
              .where(and(eq(jobs.tenantId, tenantId), inArray(jobs.customerId, foundIds)))
              .groupBy(jobs.customerId)
          : [],
        foundIds.length > 0
          ? db.select({ customerId: invoices.customerId, count: count() }).from(invoices)
              .where(and(eq(invoices.tenantId, tenantId), inArray(invoices.customerId, foundIds)))
              .groupBy(invoices.customerId)
          : [],
        foundIds.length > 0
          ? db.select({ customerId: quotes.customerId, count: count() }).from(quotes)
              .where(and(eq(quotes.tenantId, tenantId), inArray(quotes.customerId, foundIds)))
              .groupBy(quotes.customerId)
          : [],
      ]);

      const blockedIds = new Set([
        ...relatedJobs.map((r) => r.customerId),
        ...relatedInvoices.map((r) => r.customerId),
        ...relatedQuotes.map((r) => r.customerId),
      ].filter((id): id is string => id !== null));

      const deletableIds = foundIds.filter((id) => !blockedIds.has(id));

      if (deletableIds.length > 0) {
        await db
          .delete(customers)
          .where(and(eq(customers.tenantId, tenantId), inArray(customers.id, deletableIds)));
      }

      const errors: { id: string; message: string }[] = [];
      if (notFoundCount > 0) {
        errors.push({ id: "N/A", message: `${notFoundCount} customer(s) not found` });
      }
      for (const blockedId of blockedIds) {
        errors.push({ id: blockedId, message: "Has related jobs, invoices, or quotes — archive instead" });
      }

      return reply.send(
        bulkResult("deleted", deletableIds.length, notFoundCount + blockedIds.size, errors),
      );
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

      const total = totalResult[0]?.total ?? 0;
      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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

      // The tags and photos handlers below both verify the customer belongs to
      // this tenant before touching anything; this one inserted straight from the
      // path param, so a note and an activity row could be written against
      // another tenant's customer (CUST-17).
      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);
      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

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
        .where(and(eq(customerNotes.id, noteId), eq(customerNotes.tenantId, tenantId)))
        .returning();

      // Creates were logged and edits were not, so the timeline showed a note
      // appearing and never showed it being rewritten (CUST-26).
      await db.insert(customerActivities).values({
        tenantId,
        customerId: id,
        type: "note.updated",
        description: "Edited a note",
        performedBy: request.authUser.userId,
      });

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

      await db
        .delete(customerNotes)
        .where(and(eq(customerNotes.id, noteId), eq(customerNotes.tenantId, tenantId)));

      await db.insert(customerActivities).values({
        tenantId,
        customerId: id,
        type: "note.deleted",
        description: "Deleted a note",
        performedBy: request.authUser.userId,
      });

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

      const total = totalResult[0]?.total ?? 0;
      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
        .select({ id: tags.id, name: tags.name })
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

      // `data` used to be either an assignment row or `{message: "Already
      // assigned"}` — two shapes behind one key (CUST-34). Re-assigning is now a
      // 200 with the existing row; a fresh assignment is a 201.
      if (!assignment) {
        const existingAssignment = await db
          .select()
          .from(customerTags)
          .where(and(eq(customerTags.customerId, id), eq(customerTags.tagId, tagId)))
          .then((r) => r[0]);
        return reply.status(200).send({ data: existingAssignment ?? null });
      }

      await db.insert(customerActivities).values({
        tenantId,
        customerId: id,
        type: "tag.assigned",
        description: `Tagged as "${tag.name}"`,
        metadata: { tagId, tagName: tag.name },
        performedBy: request.authUser.userId,
      });

      return reply.status(201).send({ data: assignment });
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

      // `customer_tags` is a pure join table with no tenant_id of its own — it is
      // tenant-scoped transitively through `customerId`, which the SELECT above
      // has already confirmed belongs to this tenant. Not a [[security-rules]] §1
      // violation; noted so the next scan doesn't re-flag it.
      const removedTag = await db
        .select({ name: tags.name })
        .from(tags)
        .where(and(eq(tags.tenantId, tenantId), eq(tags.id, tagId)))
        .then((r) => r[0]);

      await db
        .delete(customerTags)
        .where(
          and(
            eq(customerTags.customerId, id),
            eq(customerTags.tagId, tagId),
          ),
        );

      await db.insert(customerActivities).values({
        tenantId,
        customerId: id,
        type: "tag.removed",
        description: removedTag ? `Removed tag "${removedTag.name}"` : "Removed a tag",
        metadata: { tagId },
        performedBy: request.authUser.userId,
      });

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
      schema: { params: idParam, querystring: paginationQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { page, limit } = request.query;
      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const offset = (page - 1) * limit;

      const customer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);

      if (!customer) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      // Was unbounded — every photo across every job for this customer, in one
      // response, growing without limit (CUST-15).
      const photoFilter = and(
        eq(jobPhotos.tenantId, tenantId),
        eq(jobs.customerId, id),
      );

      const [data, totalResult] = await Promise.all([
        db
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
          .where(photoFilter)
          .orderBy(desc(jobPhotos.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(jobPhotos)
          .innerJoin(jobs, eq(jobPhotos.jobId, jobs.id))
          .where(photoFilter),
      ]);

      const total = totalResult[0]?.total ?? 0;
      return reply.send({
        data,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );
};
export default customerRoutes;
