import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { attachChecklistToJob } from "../../lib/job-helpers.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import {
  idParam,
  bookingListQuery,
  updateBookingBody,
  convertBookingBody,
  bulkBookingStatusBody,
} from "../../lib/schemas/bookings.js";
import {
  getDb,
  bookings,
  bookingActivities,
  jobs,
  jobLineItems,
  customers,
  tenants,
  jobActivities,
  pipelines,
  jobPipelineStages,
  quotes,
  quoteLineItems,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  gte,
  lte,
  count,
  sql,
  inArray,
  isNull,
  isNotNull,
} from "@hvac-saas/database";

const bookingRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /bookings
   *
   * List bookings with filters, search, and pagination.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant], schema: { querystring: bookingListQuery } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const query = request.query;

      const page = query.page;
      const limit = query.limit;
      const offset = (page - 1) * limit;

      const db = getDb();
      const filters: any[] = [eq(bookings.tenantId, tenantId)];
      filters.push(query.showArchived ? isNotNull(bookings.archivedAt) : isNull(bookings.archivedAt));

      if (query.status) {
        filters.push(eq(bookings.status, query.status as any));
      }

      if (query.dateFrom) {
        filters.push(gte(bookings.bookingDate, query.dateFrom));
      }

      if (query.dateTo) {
        filters.push(lte(bookings.bookingDate, query.dateTo));
      }

      if (query.search) {
        const term = `%${query.search}%`;
        filters.push(
          or(
            ilike(bookings.customerName, term),
            ilike(bookings.customerEmail, term),
            ilike(bookings.customerPhone, term),
          ),
        );
      }

      const whereClause = and(...filters);

      // Determine sort
      const sortBy = query.sortBy === "createdAt" ? bookings.createdAt : bookings.bookingDate;
      const sortOrder = query.sortOrder === "asc" ? asc(sortBy) : desc(sortBy);


      const [rawData, totalResult] = await Promise.all([
        db
          .select()
          .from(bookings)
          .where(whereClause)
          .orderBy(sortOrder)
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(bookings)
          .where(whereClause),
      ]);

      // Check which bookings have been converted to jobs (include job status/stage)
      const bookingIds = rawData.map((b) => b.id);
      let jobMap = new Map<string, { jobId: string; jobNumber: string; jobStatus: string }>();
      if (bookingIds.length > 0) {
        const linkedJobs = await db
          .select({
            bookingId: jobs.bookingId,
            id: jobs.id,
            jobNumber: jobs.jobNumber,
            status: jobs.status,
          })
          .from(jobs)
          .where(
            and(
              eq(jobs.tenantId, tenantId),
              inArray(jobs.bookingId, bookingIds),
            ),
          );
        for (const j of linkedJobs) {
          if (j.bookingId) jobMap.set(j.bookingId, { jobId: j.id, jobNumber: j.jobNumber, jobStatus: j.status });
        }
      }

      const data = rawData.map((b) => {
        const job = jobMap.get(b.id);
        return {
          ...b,
          convertedToJobId: job?.jobId ?? null,
          convertedJobNumber: job?.jobNumber ?? null,
          convertedJobStatus: job?.jobStatus ?? null,
        };
      });

      const total = Number(totalResult[0]?.total ?? 0);

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
   * GET /bookings/stats
   * Aggregate booking status counts in a single query.
   */
  fastify.get(
    "/stats",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const [result] = await db
        .select({
          pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
          confirmed: sql<number>`COUNT(*) FILTER (WHERE status = 'confirmed')`,
          completed: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
          cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
        })
        .from(bookings)
        .where(eq(bookings.tenantId, tenantId));

      return reply.send({
        data: {
          pending: Number(result.pending),
          confirmed: Number(result.confirmed),
          completed: Number(result.completed),
          cancelled: Number(result.cancelled),
        },
      });
    },
  );

  /**
   * GET /bookings/:id
   *
   * Get a single booking.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const db = getDb();

      const booking = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .then((r) => r[0]);

      if (!booking) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      return reply.send({ data: booking });
    },
  );

  /**
   * PATCH /bookings/:id
   *
   * Update a booking (status, notes, reschedule).
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam, body: updateBookingBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const body = request.body;
      const db = getDb();

      const existing = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      if (existing.status === "cancelled" || existing.status === "completed") {
        return reply.status(400).send({ message: `Cannot modify a ${existing.status} booking` });
      }

      const allowedFields = ["status", "notes", "bookingDate", "preferredTime", "address", "description"] as const;
      const updates: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return reply.status(400).send({ message: "No valid fields to update" });
      }

      updates.updatedAt = new Date();

      const [updated] = await db
        .update(bookings)
        .set(updates)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .returning();

      const userId = request.authUser.userId;

      // DF-BK-21: Log activity for status changes
      if (updates.status && updates.status !== existing.status) {
        await db.insert(bookingActivities).values({
          tenantId,
          bookingId: id,
          type: "booking.status_changed",
          description: `Status changed from "${existing.status}" to "${updates.status}"`,
          metadata: { previousStatus: existing.status, newStatus: updates.status },
          performedBy: userId,
        });
      }

      // DF-BK-23: Send confirmation email when status changes to "confirmed"
      if (updates.status === "confirmed" && existing.status !== "confirmed" && existing.customerEmail) {
        const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]);
        const { sendBookingConfirmedEmail } = await import("../../lib/email.js");
        const serviceLabel = existing.serviceType.charAt(0).toUpperCase() + existing.serviceType.slice(1);

        sendBookingConfirmedEmail({
          to: existing.customerEmail,
          props: {
            customerName: existing.customerName,
            businessName: tenant?.businessName ?? "Service Business",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            serviceType: serviceLabel,
            scheduledDate: new Date(existing.bookingDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
            scheduledTime: existing.preferredTime ?? "TBD",
            address: existing.address ?? null,
          },
        }).catch((err) => console.error("[email] E-04 booking confirmed failed:", err));
      }

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /bookings/:id/convert-to-job
   *
   * Convert a booking to a job.
   * Customer is normally linked at booking time. Fallback creates one for legacy bookings.
   */
  fastify.post(
    "/:id/convert-to-job",
    { preHandler: [requireTenant], schema: { params: idParam, body: convertBookingBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { id } = request.params;
      const body = request.body ?? {};
      const db = getDb();

      // 1. Fetch booking (outside transaction — initial validation)
      const booking = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .then((r) => r[0]);

      if (!booking) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      if (booking.status === "cancelled" || booking.status === "completed") {
        return reply.status(400).send({ message: "Only pending or confirmed bookings can be converted" });
      }

      // Fetch tenant for email (outside transaction — read-only)
      const tenant = await db.select().from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]);

      // Wrap all mutations in a transaction to prevent partial state and race conditions
      const job = await db.transaction(async (tx) => {
        // Lock the booking row to prevent concurrent conversions (race condition fix)
        const lockedBooking = await tx
          .select({ id: bookings.id, status: bookings.status, convertedToJobId: bookings.convertedToJobId })
          .from(bookings)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .for("update")
          .then((r) => r[0]);

        if (!lockedBooking) throw new Error("BOOKING_NOT_FOUND");

        // Re-check inside lock to prevent duplicate conversion
        const existingJob = await tx
          .select({ id: jobs.id })
          .from(jobs)
          .where(and(eq(jobs.bookingId, id), eq(jobs.tenantId, tenantId)))
          .then((r) => r[0]);

        if (existingJob) throw new Error("ALREADY_CONVERTED");

        // 3. Resolve or create customer
        let customerId = booking.customerId;

        // Phase 4: Validate pre-linked customerId belongs to this tenant
        if (customerId) {
          const customerExists = await tx
            .select({ id: customers.id })
            .from(customers)
            .where(and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)))
            .then((r) => r[0]);
          if (!customerExists) {
            customerId = null; // Fall through to find/create logic
          }
        }

        if (!customerId) {
          // Phase 3: Case-insensitive email match
          if (booking.customerEmail) {
            const existingCustomer = await tx
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  eq(sql`lower(${customers.email})`, booking.customerEmail.toLowerCase()),
                ),
              )
              .then((r) => r[0]);

            if (existingCustomer) {
              customerId = existingCustomer.id;
            }
          }

          // Phone fallback if email didn't match (DF-BK-10)
          if (!customerId && booking.customerPhone) {
            const byPhone = await tx
              .select({ id: customers.id })
              .from(customers)
              .where(
                and(
                  eq(customers.tenantId, tenantId),
                  eq(customers.phone, booking.customerPhone),
                ),
              )
              .limit(1)
              .then((r) => r[0]);
            if (byPhone) customerId = byPhone.id;
          }

          // Create new customer if not found
          if (!customerId) {
            const nameParts = booking.customerName.trim().split(/\s+/);
            const firstName = nameParts[0] || booking.customerName;
            const lastName = nameParts.slice(1).join(" ") || "";

            const [newCustomer] = await tx
              .insert(customers)
              .values({
                tenantId,
                firstName,
                lastName,
                email: booking.customerEmail,
                phone: booking.customerPhone,
                address: booking.address,
              })
              .returning();

            customerId = newCustomer.id;
          }

          // Update booking with customer reference
          await tx
            .update(bookings)
            .set({ customerId, updatedAt: new Date() })
            .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)));
        }

        // 4. Resolve default pipeline
        const defaultPipeline = await tx
          .select({ id: pipelines.id })
          .from(pipelines)
          .where(and(eq(pipelines.tenantId, tenantId), eq(pipelines.isDefault, true)))
          .then((r) => r[0]);
        const pipelineId = defaultPipeline?.id ?? null;

        // 5. Resolve pipeline stage (user-selected or first default)
        // Status = pipeline stage name (used for kanban board matching)
        let status = "scheduled";
        if (body.pipelineStageId) {
          const selectedStage = await tx
            .select({ name: jobPipelineStages.name })
            .from(jobPipelineStages)
            .where(and(eq(jobPipelineStages.id, body.pipelineStageId), eq(jobPipelineStages.tenantId, tenantId)))
            .then((r) => r[0]);
          if (selectedStage) status = selectedStage.name;
        } else if (pipelineId) {
          const firstStage = await tx
            .select({ name: jobPipelineStages.name })
            .from(jobPipelineStages)
            .where(eq(jobPipelineStages.pipelineId, pipelineId))
            .orderBy(asc(jobPipelineStages.sortOrder))
            .limit(1)
            .then((r) => r[0]);
          if (firstStage) status = firstStage.name;
        }

        // 6. Create job
        const serviceLabel = booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1);
        const [newJob] = await tx
          .insert(jobs)
          .values({
            tenantId,
            customerId: customerId!,
            bookingId: booking.id,
            pipelineId,
            jobNumber: "", // DB trigger auto-generates
            title: `${serviceLabel} - ${booking.customerName}`,
            status,
            serviceType: booking.serviceType,
            scheduledDate: booking.bookingDate,
            scheduledStart: booking.preferredTime,
            address: booking.address,
            description: booking.description,
          })
          .returning();

        // 6a. If booking is linked to a quote, copy quote line items + totals
        if (booking.quoteId) {
          const quote = await tx
            .select({
              id: quotes.id,
              quoteNumber: quotes.quoteNumber,
              subtotal: quotes.subtotal,
              taxRate: quotes.taxRate,
              taxAmount: quotes.taxAmount,
              discountAmount: quotes.discountAmount,
              totalAmount: quotes.totalAmount,
            })
            .from(quotes)
            .where(and(eq(quotes.id, booking.quoteId), eq(quotes.tenantId, tenantId)))
            .then((r) => r[0]);

          if (quote) {
            // Copy quote line items to job
            const quoteItems = await tx
              .select()
              .from(quoteLineItems)
              .where(and(eq(quoteLineItems.tenantId, tenantId), eq(quoteLineItems.quoteId, quote.id)))
              .orderBy(asc(quoteLineItems.sortOrder));

            if (quoteItems.length > 0) {
              await tx.insert(jobLineItems).values(
                quoteItems.map((item) => ({
                  tenantId,
                  jobId: newJob.id,
                  catalogItemId: item.catalogItemId,
                  itemType: item.itemType,
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  sortOrder: item.sortOrder ?? 0,
                })),
              );
            }

            // Copy quote totals to job
            await tx
              .update(jobs)
              .set({
                title: `Job from ${quote.quoteNumber}`,
                subtotal: quote.subtotal,
                taxRate: quote.taxRate,
                taxAmount: quote.taxAmount,
                totalAmount: quote.totalAmount,
                updatedAt: new Date(),
              })
              .where(and(eq(jobs.id, newJob.id), eq(jobs.tenantId, tenantId)));

            // Mark quote as converted
            await tx
              .update(quotes)
              .set({ convertedToJobId: newJob.id, updatedAt: new Date() })
              .where(and(eq(quotes.id, quote.id), eq(quotes.tenantId, tenantId)));
          }
        }

        // 6b. Auto-attach checklist (tx is compatible with db parameter type)
        await attachChecklistToJob(tx, newJob.id, tenantId, booking.serviceType, userId);

        // 7. Update booking status to confirmed (if pending)
        if (booking.status === "pending") {
          await tx
            .update(bookings)
            .set({ status: "confirmed", updatedAt: new Date() })
            .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)));
        }

        // 8. Log activity
        await tx.insert(jobActivities).values({
          tenantId,
          jobId: newJob.id,
          type: "job.created",
          description: "Job created from online booking",
          metadata: { bookingId: booking.id },
          performedBy: userId,
        });

        return newJob;
      }).catch((err: Error) => {
        if (err.message === "ALREADY_CONVERTED") {
          return reply.status(400).send({ message: "This booking has already been converted to a job" });
        }
        if (err.message === "BOOKING_NOT_FOUND") {
          return reply.status(404).send({ message: "Booking not found" });
        }
        throw err;
      });

      // If reply was already sent (error case), stop here
      if (!job) return;

      emitPlatformEvent(tenantId, "job_created", userId);

      // DF-BK-20: Notify team of job created from booking
      dispatchNotification({
        tenantId,
        type: "job_status_changed",
        title: `Job created from booking`,
        description: `${booking.serviceType} job for ${booking.customerName}`,
        entityType: "job",
        entityId: job.id,
        actorId: userId,
        metadata: { bookingId: booking.id, action: "created_from_booking" },
      });

      // E-04: Booking confirmed email to customer (fire-and-forget, outside transaction)
      if (booking.customerEmail) {
        const { sendBookingConfirmedEmail } = await import("../../lib/email.js");
        const serviceLabel = booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1);

        sendBookingConfirmedEmail({
          to: booking.customerEmail,
          props: {
            customerName: booking.customerName,
            businessName: tenant?.businessName ?? "HVAC Service",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            serviceType: serviceLabel,
            scheduledDate: new Date(booking.bookingDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
            scheduledTime: booking.preferredTime,
            address: booking.address,
          },
        }).catch((err) => console.error("[email] E-04 booking confirmed failed:", err));
      }

      return reply.status(201).send({ data: job });
    },
  );

  /**
   * DELETE /bookings/:id
   *
   * Cancel a booking (soft delete — sets status to cancelled).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const db = getDb();

      const existing = await db
        .select()
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      if (existing.status === "completed") {
        return reply.status(400).send({ message: "Cannot cancel a completed booking" });
      }

      if (existing.status === "cancelled") {
        return reply.send({ data: existing }); // Idempotent
      }

      const userId = request.authUser.userId;

      const [updated] = await db
        .update(bookings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .returning();

      // DF-BK-21: Log cancel activity
      await db.insert(bookingActivities).values({
        tenantId,
        bookingId: id,
        type: "booking.cancelled",
        description: `Booking cancelled (was "${existing.status}")`,
        metadata: { previousStatus: existing.status },
        performedBy: userId,
      });

      // DF-BK-22: Notify team of cancellation
      dispatchNotification({
        tenantId,
        type: "booking_cancelled",
        title: `Booking cancelled — ${existing.customerName}`,
        description: `${existing.serviceType} booking on ${existing.bookingDate} was cancelled`,
        entityType: "booking",
        entityId: id,
        actorId: userId,
        metadata: { bookingDate: existing.bookingDate, serviceType: existing.serviceType },
      });

      return reply.send({ data: updated });
    },
  );
  /**
   * POST /bookings/bulk-archive
   * Soft-archive multiple bookings by setting archivedAt.
   */
  fastify.post(
    "/bulk-archive",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, tenantId),
            inArray(bookings.id, ids),
            isNull(bookings.archivedAt),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found or already archived",
      }));

      if (validIds.length > 0) {
        await db
          .update(bookings)
          .set({ archivedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(bookings.tenantId, tenantId), inArray(bookings.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /bookings/bulk-restore
   * Restore multiple archived bookings by clearing archivedAt.
   */
  fastify.post(
    "/bulk-restore",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, tenantId),
            inArray(bookings.id, ids),
            isNotNull(bookings.archivedAt),
          ),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found or not archived",
      }));

      if (validIds.length > 0) {
        await db
          .update(bookings)
          .set({ archivedAt: null, updatedAt: new Date() })
          .where(
            and(eq(bookings.tenantId, tenantId), inArray(bookings.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /bookings/bulk-delete
   * Hard delete multiple bookings regardless of status.
   */
  fastify.post(
    "/bulk-delete",
    { preHandler: [requireTenant], schema: { body: bulkIdsBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids } = request.body;
      const db = getDb();

      const existing = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(eq(bookings.tenantId, tenantId), inArray(bookings.id, ids)),
        );

      const validIds = existing.map((r) => r.id);
      const invalidIds = ids.filter((id) => !validIds.includes(id));

      const errors: { id: string; reason: string }[] = invalidIds.map((id) => ({
        id,
        reason: "Not found",
      }));

      if (validIds.length > 0) {
        await db
          .delete(bookings)
          .where(
            and(eq(bookings.tenantId, tenantId), inArray(bookings.id, validIds)),
          );
      }

      return reply.send({ succeeded: validIds.length, failed: errors.length, errors });
    },
  );

  /**
   * POST /bookings/bulk-status-update
   * Update the status of multiple bookings at once.
   */
  fastify.post(
    "/bulk-status-update",
    { preHandler: [requireTenant], schema: { body: bulkBookingStatusBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { ids, status } = request.body;
      const db = getDb();

      // Status transition validation (DF-BK-09)
      const VALID_TRANSITIONS: Record<string, string[]> = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["completed", "cancelled"],
        // completed and cancelled are terminal — no transitions allowed
      };

      const existing = await db
        .select({ id: bookings.id, status: bookings.status })
        .from(bookings)
        .where(
          and(eq(bookings.tenantId, tenantId), inArray(bookings.id, ids)),
        );

      const foundIds = new Set(existing.map((r) => r.id));
      const errors: { id: string; reason: string }[] = [];

      // Report not-found IDs
      for (const id of ids) {
        if (!foundIds.has(id)) {
          errors.push({ id, reason: "Not found" });
        }
      }

      // Filter to only bookings with valid transitions
      const eligibleIds: string[] = [];
      for (const row of existing) {
        const allowed = VALID_TRANSITIONS[row.status];
        if (!allowed || !allowed.includes(status)) {
          errors.push({ id: row.id, reason: `Cannot transition from "${row.status}" to "${status}"` });
        } else {
          eligibleIds.push(row.id);
        }
      }

      if (eligibleIds.length > 0) {
        await db
          .update(bookings)
          .set({ status: status as never, updatedAt: new Date() })
          .where(
            and(eq(bookings.tenantId, tenantId), inArray(bookings.id, eligibleIds)),
          );
      }

      return reply.send({ succeeded: eligibleIds.length, failed: errors.length, errors });
    },
  );
};
export default bookingRoutes;
