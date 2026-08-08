import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { SQL } from "drizzle-orm";
import { requireTenant } from "../../lib/auth-middleware.js";
import { attachChecklistToJob } from "../../lib/job-helpers.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import { dispatchNotification } from "../../lib/notifications.js";
import { bulkIdsBody } from "../../lib/schemas/bulk.js";
import {
  idParam,
  bookingListQuery,
  bookingStatsQuery,
  bookingActivitiesQuery,
  updateBookingBody,
  convertBookingBody,
  bulkBookingStatusBody,
  type BookingStatus,
} from "../../lib/schemas/bookings.js";
import {
  canTransitionBooking,
  transitionError,
} from "../../services/bookings.service.js";
import {
  emitBookingConvertedEvent,
  emitBookingRescheduledEvent,
  emitBookingStatusEvents,
  type BookingStatusTransition,
} from "../../services/bookings/booking-events.service.js";
import { emitJobCreatedEvent } from "../../services/jobs/job-events.service.js";
import { emitCustomerCreatedEvent } from "../../services/customers/customer-events.service.js";
import { checkSlotBookable } from "../../services/availability.service.js";
import { getTenantTomorrow, getMaxBookingDate } from "../../lib/timezone.js";
import { env } from "../../lib/env.js";
import {
  getDb,
  bookings,
  bookingActivities,
  jobs,
  jobLineItems,
  customers,
  tenants,
  user,
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
import { containsPattern } from "../../lib/search.js";

/** Format a YYYY-MM-DD booking date for an email, anchored so it cannot drift. */
function formatBookingDate(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function serviceLabelOf(serviceType: string): string {
  return serviceType.charAt(0).toUpperCase() + serviceType.slice(1);
}

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
      const filters: SQL[] = [eq(bookings.tenantId, tenantId)];
      filters.push(query.showArchived ? isNotNull(bookings.archivedAt) : isNull(bookings.archivedAt));

      if (query.status) {
        filters.push(eq(bookings.status, query.status));
      }

      if (query.dateFrom) {
        filters.push(gte(bookings.bookingDate, query.dateFrom));
      }

      if (query.dateTo) {
        filters.push(lte(bookings.bookingDate, query.dateTo));
      }

      if (query.search) {
        // INV-22 sweep: unescaped, a `%` in the box matched every row and a
        // `_` matched any single character.
        const term = containsPattern(query.search);
        const searchClause = or(
          ilike(bookings.customerName, term),
          ilike(bookings.customerEmail, term),
          ilike(bookings.customerPhone, term),
        );
        if (searchClause) filters.push(searchClause);
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
      const jobMap = new Map<string, { jobId: string; jobNumber: string; jobStatus: string }>();
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
          convertedToJobId: job?.jobId ?? b.convertedToJobId ?? null,
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
   *
   * Filters `archived_at` to match the list endpoint. Without it the four stat
   * cards permanently exceeded the table beneath them after any bulk archive
   * (BOOK-08).
   */
  fastify.get(
    "/stats",
    { preHandler: [requireTenant], schema: { querystring: bookingStatsQuery } },
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
        .where(and(eq(bookings.tenantId, tenantId), isNull(bookings.archivedAt)));

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
   * Get a single booking, plus the job it was converted into.
   *
   * The list endpoint synthesised `convertedToJobId` from a join and this one did
   * not, so the detail sheet always saw `null` and kept offering "Convert to Job"
   * on a booking that already had one — which returned 400 and, before BOOK-01
   * was fixed, emailed the customer a second confirmation (BOOK-06).
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

      const linkedJob = await db
        .select({ id: jobs.id, jobNumber: jobs.jobNumber, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.bookingId, id), eq(jobs.tenantId, tenantId)))
        .then((r) => r[0]);

      return reply.send({
        data: {
          ...booking,
          convertedToJobId: linkedJob?.id ?? booking.convertedToJobId ?? null,
          convertedJobNumber: linkedJob?.jobNumber ?? null,
          convertedJobStatus: linkedJob?.status ?? null,
        },
      });
    },
  );

  /**
   * GET /bookings/:id/activities
   *
   * The `booking_activities` table has been recording every status change and
   * cancellation since April with no endpoint, no hook and no UI — rows nobody
   * could see (BOOK-18).
   */
  fastify.get(
    "/:id/activities",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, querystring: bookingActivitiesQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const { page, limit } = request.query;
      const offset = (page - 1) * limit;
      const db = getDb();

      const booking = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
        .then((r) => r[0]);

      if (!booking) {
        return reply.status(404).send({ message: "Booking not found" });
      }

      const whereClause = and(
        eq(bookingActivities.tenantId, tenantId),
        eq(bookingActivities.bookingId, id),
      );

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: bookingActivities.id,
            type: bookingActivities.type,
            description: bookingActivities.description,
            metadata: bookingActivities.metadata,
            createdAt: bookingActivities.createdAt,
            performedBy: bookingActivities.performedBy,
            performedByName: user.name,
          })
          .from(bookingActivities)
          .leftJoin(user, eq(user.id, bookingActivities.performedBy))
          .where(whereClause)
          .orderBy(desc(bookingActivities.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(bookingActivities).where(whereClause),
      ]);

      const total = Number(totalResult[0]?.total ?? 0);

      return reply.send({
        data: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    },
  );

  /**
   * PATCH /bookings/:id
   *
   * Update a booking (status, notes, reschedule).
   *
   * Rescheduling goes through the same availability gate the public portal uses.
   * It previously validated nothing, so staff could move a booking onto a closed
   * day, into the past, or on top of another appointment — and the portal would
   * keep offering that slot to the next customer (BOOK-09). `force: true` is the
   * deliberate override.
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

      // One status machine, shared with bulk-status-update (BOOK-22).
      if (body.status && body.status !== existing.status) {
        const from = existing.status as BookingStatus;
        if (!canTransitionBooking(from, body.status)) {
          return reply.status(400).send({ message: transitionError(from, body.status) });
        }
      } else if (existing.status === "cancelled" || existing.status === "completed") {
        // No status change requested — a terminal booking is still frozen for edits.
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

      const tenant = await db
        .select({
          businessName: tenants.businessName,
          logoUrl: tenants.logoUrl,
          phone: tenants.phone,
          address: tenants.address,
          slug: tenants.slug,
          timezone: tenants.timezone,
          bookingSlotCapacity: tenants.bookingSlotCapacity,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      const tz = tenant?.timezone ?? "America/Chicago";

      // Reschedule validation — same rules the portal enforces.
      const nextDate = (updates.bookingDate as string | undefined) ?? existing.bookingDate;
      const nextTime =
        (updates.preferredTime as string | undefined) ??
        (existing.preferredTime ? existing.preferredTime.slice(0, 5) : null);
      const isReschedule =
        updates.bookingDate !== undefined || updates.preferredTime !== undefined;

      if (isReschedule && nextTime && !body.force) {
        const bookable = await checkSlotBookable(db, {
          tenantId,
          timezone: tz,
          dateStr: nextDate,
          time: nextTime,
          capacity: tenant?.bookingSlotCapacity ?? 1,
          // Staff may legitimately book sooner than the public 24h rule allows.
          minDate: existing.bookingDate < getTenantTomorrow(tz) ? existing.bookingDate : nextDate,
          maxDate: getMaxBookingDate(tz, 24),
          excludeBookingId: id,
        });
        if (!bookable.ok) {
          return reply
            .status(409)
            .send({ message: `${bookable.message} Re-send with force to override.` });
        }
      }

      updates.updatedAt = new Date();

      const userId = request.authUser.userId;

      // The update, its activity rows and its events in one transaction. They
      // were three loose statements; the events make that untenable, because a
      // booking that committed a cancellation without its `booking.cancelled`
      // event leaves an automation permanently un-fired and nothing on screen
      // to show for it.
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(bookings)
          .set(updates)
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .returning();

        // DF-BK-21: Log activity for status changes
        if (updates.status && updates.status !== existing.status) {
          await tx.insert(bookingActivities).values({
            tenantId,
            bookingId: id,
            type: "booking.status_changed",
            description: `Status changed from "${existing.status}" to "${updates.status}"`,
            metadata: { previousStatus: existing.status, newStatus: updates.status },
            performedBy: userId,
          });
        }

        if (isReschedule) {
          await tx.insert(bookingActivities).values({
            tenantId,
            bookingId: id,
            type: "booking.rescheduled",
            description: `Rescheduled to ${nextDate}${nextTime ? ` at ${nextTime}` : ""}`,
            metadata: {
              previousDate: existing.bookingDate,
              previousTime: existing.preferredTime,
              newDate: nextDate,
              newTime: nextTime,
              forced: body.force === true,
            },
            performedBy: userId,
          });
        }

        // The same helper the bulk path and DELETE call. A no-op transition
        // emits nothing, so re-saving a confirmed booking sends no second
        // confirmation.
        if (body.status) {
          await emitBookingStatusEvents(tx, {
            tenantId,
            actorUserId: userId,
            transitions: [
              {
                bookingId: id,
                from: existing.status as BookingStatus,
                to: body.status,
              },
            ],
          });
        }

        if (isReschedule) {
          await emitBookingRescheduledEvent(tx, {
            tenantId,
            actorUserId: userId,
            bookingId: id,
            fromDate: existing.bookingDate,
            fromTime: existing.preferredTime,
          });
        }

        return row;
      });

      // DF-BK-23: Send confirmation email when status changes to "confirmed"
      if (updates.status === "confirmed" && existing.status !== "confirmed" && existing.customerEmail) {
        const { sendBookingConfirmedEmail } = await import("../../lib/email.js");

        sendBookingConfirmedEmail({
          to: existing.customerEmail,
          props: {
            customerName: existing.customerName,
            businessName: tenant?.businessName ?? "Service Business",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            serviceType: serviceLabelOf(existing.serviceType),
            scheduledDate: formatBookingDate(nextDate),
            scheduledTime: nextTime ?? "TBD",
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

      // Wrap all mutations in a transaction to prevent partial state and race
      // conditions.
      //
      // The failure path is a `try`/`catch` around the await, NOT a `.catch()`
      // that returns `reply.status(...).send(...)`. Returning the reply was the
      // bug: reply objects are truthy, so the guard `if (!job) return` never
      // fired and a *failed* conversion went on to emit a `job_created` platform
      // event, dispatch a notification with an undefined entityId, and send the
      // customer a second "your booking is confirmed" email (BOOK-01). An
      // impatient double-click was enough to trigger it.
      let job: typeof jobs.$inferSelect;
      try {
        job = await db.transaction(async (tx) => {
          // Lock the booking row to prevent concurrent conversions (race condition fix)
          const lockedBooking = await tx
            .select({ id: bookings.id, status: bookings.status })
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

              // A conversion that has to invent a customer has created one, and
              // that is the same event `POST /customers` emits. Source is
              // `booking` so a welcome automation can tell "signed up" from
              // "we made them a record because they booked".
              await emitCustomerCreatedEvent(tx, {
                tenantId,
                actorUserId: userId,
                customerId: newCustomer.id,
                source: "booking",
              });
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
          const [newJob] = await tx
            .insert(jobs)
            .values({
              tenantId,
              customerId: customerId!,
              bookingId: booking.id,
              pipelineId,
              jobNumber: "", // DB trigger auto-generates
              title: `${serviceLabelOf(booking.serviceType)} - ${booking.customerName}`,
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

          // 7. Record the link and confirm the booking.
          //
          // `convertedToJobId` was never written — the column had been permanently
          // NULL since the feature shipped, and the April audit recorded it as fixed
          // (BOOK-06). The list endpoint papered over it with a join; the detail
          // endpoint did not, which is why the sheet kept offering "Convert to Job".
          await tx
            .update(bookings)
            .set({
              convertedToJobId: newJob.id,
              ...(booking.status === "pending" ? { status: "confirmed" as const } : {}),
              updatedAt: new Date(),
            })
            .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)));

          // 8. Log activity
          await tx.insert(jobActivities).values({
            tenantId,
            jobId: newJob.id,
            type: "job.created",
            description: "Job created from online booking",
            metadata: { bookingId: booking.id },
            performedBy: userId,
          });

          await tx.insert(bookingActivities).values({
            tenantId,
            bookingId: booking.id,
            type: "booking.converted",
            description: `Converted to job ${newJob.jobNumber || newJob.id}`,
            metadata: { jobId: newJob.id },
            performedBy: userId,
          });

          // 9. Events, inside the same transaction as everything above.
          //
          // Read the job back for its trigger-issued number before either event
          // uses it — `newJob.jobNumber` is the pre-trigger empty string, which
          // is why the activity row above falls back to the id.
          const [convertedJob] = await tx
            .select({ id: jobs.id, jobNumber: jobs.jobNumber })
            .from(jobs)
            .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, newJob.id)));

          // A conversion also confirms a pending booking, and that is a real
          // status change a customer-facing automation should see. Emitted
          // through the shared helper so it is the same event a manual confirm
          // produces.
          if (booking.status === "pending") {
            await emitBookingStatusEvents(tx, {
              tenantId,
              actorUserId: userId,
              transitions: [
                { bookingId: booking.id, from: "pending", to: "confirmed" },
              ],
            });
          }

          await emitBookingConvertedEvent(tx, {
            tenantId,
            actorUserId: userId,
            bookingId: booking.id,
            job: {
              id: convertedJob.id,
              jobNumber: convertedJob.jobNumber ?? "",
            },
          });

          // And `job.created`, from the same helper `POST /jobs` and the quote
          // conversion use — three ways to create a job, one payload shape.
          await emitJobCreatedEvent(tx, {
            tenantId,
            actorUserId: userId,
            jobId: newJob.id,
            origin: "booking",
            originId: booking.id,
          });

          return newJob;
        });
      } catch (err) {
        if (err instanceof Error && err.message === "ALREADY_CONVERTED") {
          return reply
            .status(400)
            .send({ message: "This booking has already been converted to a job" });
        }
        if (err instanceof Error && err.message === "BOOKING_NOT_FOUND") {
          return reply.status(404).send({ message: "Booking not found" });
        }
        throw err;
      }

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

        sendBookingConfirmedEmail({
          to: booking.customerEmail,
          props: {
            customerName: booking.customerName,
            businessName: tenant?.businessName ?? "Service Business",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            serviceType: serviceLabelOf(booking.serviceType),
            scheduledDate: formatBookingDate(booking.bookingDate),
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

      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(bookings)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(bookings.id, id), eq(bookings.tenantId, tenantId)))
          .returning();

        // DF-BK-21: Log cancel activity
        await tx.insert(bookingActivities).values({
          tenantId,
          bookingId: id,
          type: "booking.cancelled",
          description: `Booking cancelled (was "${existing.status}")`,
          metadata: { previousStatus: existing.status },
          performedBy: userId,
        });

        // Cancelling through DELETE and cancelling through PATCH are the same
        // event. The route above returns early for an already-cancelled
        // booking, so this is always a real transition.
        await emitBookingStatusEvents(tx, {
          tenantId,
          actorUserId: userId,
          transitions: [
            {
              bookingId: id,
              from: existing.status as BookingStatus,
              to: "cancelled",
            },
          ],
        });

        return row;
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

      const tenant = await db
        .select({
          businessName: tenants.businessName,
          logoUrl: tenants.logoUrl,
          phone: tenants.phone,
          address: tenants.address,
          slug: tenants.slug,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      // A converted booking's job stays on the calendar and in the pipeline unless
      // it is dealt with. Flag it on the response rather than silently deleting the
      // job — cancelling the appointment and cancelling the work are different
      // decisions, and only the contractor can make the second one (BOOK-24).
      const linkedJob = await db
        .select({ id: jobs.id, jobNumber: jobs.jobNumber })
        .from(jobs)
        .where(and(eq(jobs.bookingId, id), eq(jobs.tenantId, tenantId)))
        .then((r) => r[0]);

      // E-14: tell the customer. They were emailed when it was booked and, until
      // now, never when it was called off.
      if (existing.customerEmail) {
        const { sendBookingCancelledEmail } = await import("../../lib/email.js");

        sendBookingCancelledEmail({
          to: existing.customerEmail,
          props: {
            customerName: existing.customerName,
            businessName: tenant?.businessName ?? "Service Business",
            businessLogoUrl: tenant?.logoUrl ?? null,
            businessPhone: tenant?.phone ?? null,
            businessAddress: tenant?.address ?? null,
            serviceType: serviceLabelOf(existing.serviceType),
            bookingDate: formatBookingDate(existing.bookingDate),
            preferredTime: existing.preferredTime?.slice(0, 5) ?? null,
            rebookUrl: tenant?.slug ? `${env.FRONTEND_URL}/book/${tenant.slug}` : null,
          },
        }).catch((err) => console.error("[email] E-14 booking cancelled failed:", err));
      }

      return reply.send({
        data: updated,
        linkedJob: linkedJob
          ? { id: linkedJob.id, jobNumber: linkedJob.jobNumber }
          : null,
      });
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
   * Hard delete multiple bookings.
   *
   * Refuses any booking that has been converted to a job. Deleting one used to
   * take its job's origin with it — `jobs.booking_id` was left pointing at a row
   * that no longer existed, and `booking_activities` cascaded away (BOOK-11).
   * Archive is the reversible option and is now exposed in the UI.
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

      const foundIds = existing.map((r) => r.id);
      const errors: { id: string; reason: string }[] = ids
        .filter((id) => !foundIds.includes(id))
        .map((id) => ({ id, reason: "Not found" }));

      const linkedJobs = foundIds.length
        ? await db
            .select({ bookingId: jobs.bookingId, jobNumber: jobs.jobNumber })
            .from(jobs)
            .where(
              and(eq(jobs.tenantId, tenantId), inArray(jobs.bookingId, foundIds)),
            )
        : [];

      const blocked = new Map<string, string>();
      for (const j of linkedJobs) {
        if (j.bookingId) blocked.set(j.bookingId, j.jobNumber);
      }

      for (const [bookingId, jobNumber] of blocked) {
        errors.push({
          id: bookingId,
          reason: `Converted to job ${jobNumber} — archive it instead of deleting`,
        });
      }

      const validIds = foundIds.filter((id) => !blocked.has(id));

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

      // Same status machine as PATCH /bookings/:id (BOOK-22).
      const eligibleIds: string[] = [];
      const transitions: BookingStatusTransition[] = [];
      for (const row of existing) {
        const from = row.status as BookingStatus;
        if (!canTransitionBooking(from, status)) {
          errors.push({ id: row.id, reason: transitionError(from, status) });
        } else {
          eligibleIds.push(row.id);
          transitions.push({ bookingId: row.id, from, to: status });
        }
      }

      if (eligibleIds.length > 0) {
        await db.transaction(async (tx) => {
          await tx
            .update(bookings)
            .set({ status, updatedAt: new Date() })
            .where(
              and(eq(bookings.tenantId, tenantId), inArray(bookings.id, eligibleIds)),
            );

          // The same emitter the single path uses. JOB-22 was exactly this
          // divergence in the jobs domain — the bulk path silently skipped what
          // the single path did — and it is not going to be re-introduced here
          // by having two places that decide what a status change means.
          await emitBookingStatusEvents(tx, {
            tenantId,
            actorUserId: request.authUser.userId,
            transitions,
          });
        });
      }

      return reply.send({ succeeded: eligibleIds.length, failed: errors.length, errors });
    },
  );
};
export default bookingRoutes;
