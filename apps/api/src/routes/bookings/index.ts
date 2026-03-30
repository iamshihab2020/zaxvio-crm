import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { attachChecklistToJob } from "../../lib/job-helpers.js";
import { emitPlatformEvent } from "../../lib/platform-events.js";
import {
  getDb,
  bookings,
  jobs,
  customers,
  jobActivities,
  jobPipelineStages,
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
} from "@hvac-saas/database";

export default async function bookingRoutes(fastify: FastifyInstance) {
  /**
   * GET /bookings
   *
   * List bookings with filters, search, and pagination.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const query = request.query as {
        status?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
        page?: string;
        limit?: string;
        sortBy?: string;
        sortOrder?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? "20", 10)));
      const offset = (page - 1) * limit;

      const db = getDb();
      const filters: any[] = [eq(bookings.tenantId, tenantId)];

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
   * GET /bookings/:id
   *
   * Get a single booking.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const { id } = request.params as { id: string };
      const body = (request.body as { pipelineStageId?: string } | null) ?? {};
      const db = getDb();

      // 1. Fetch booking
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

      // 2. Check if already converted
      const existingJob = await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.bookingId, id), eq(jobs.tenantId, tenantId)))
        .then((r) => r[0]);

      if (existingJob) {
        return reply.status(400).send({ message: "This booking has already been converted to a job" });
      }

      // 3. Resolve or create customer
      let customerId = booking.customerId;

      if (!customerId) {
        // Try to find by email
        if (booking.customerEmail) {
          const existingCustomer = await db
            .select({ id: customers.id })
            .from(customers)
            .where(
              and(
                eq(customers.tenantId, tenantId),
                eq(customers.email, booking.customerEmail),
              ),
            )
            .then((r) => r[0]);

          if (existingCustomer) {
            customerId = existingCustomer.id;
          }
        }

        // Create new customer if not found
        if (!customerId) {
          const nameParts = booking.customerName.trim().split(/\s+/);
          const firstName = nameParts[0] || booking.customerName;
          const lastName = nameParts.slice(1).join(" ") || "";

          const [newCustomer] = await db
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
        await db
          .update(bookings)
          .set({ customerId, updatedAt: new Date() })
          .where(eq(bookings.id, id));
      }

      // 4. Resolve pipeline stage (user-selected or first default)
      let status = "scheduled";
      if (body.pipelineStageId) {
        const selectedStage = await db
          .select({ name: jobPipelineStages.name })
          .from(jobPipelineStages)
          .where(and(eq(jobPipelineStages.id, body.pipelineStageId), eq(jobPipelineStages.tenantId, tenantId)))
          .then((r) => r[0]);
        if (selectedStage) status = selectedStage.name;
      } else {
        const firstStage = await db
          .select({ name: jobPipelineStages.name })
          .from(jobPipelineStages)
          .where(eq(jobPipelineStages.tenantId, tenantId))
          .orderBy(asc(jobPipelineStages.sortOrder))
          .limit(1)
          .then((r) => r[0]);
        if (firstStage) status = firstStage.name;
      }

      // 5. Create job
      const serviceLabel = booking.serviceType.charAt(0).toUpperCase() + booking.serviceType.slice(1);
      const [job] = await db
        .insert(jobs)
        .values({
          tenantId,
          customerId: customerId!,
          bookingId: booking.id,
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

      // 6. Auto-attach checklist
      await attachChecklistToJob(db, job.id, tenantId, booking.serviceType, userId);

      // 7. Update booking status to confirmed (if pending)
      if (booking.status === "pending") {
        await db
          .update(bookings)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(bookings.id, id));
      }

      // 8. Log activity
      await db.insert(jobActivities).values({
        tenantId,
        jobId: job.id,
        type: "job.created",
        description: "Job created from online booking",
        metadata: { bookingId: booking.id },
        performedBy: userId,
      });

      emitPlatformEvent(tenantId, "booking_received", userId);

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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
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

      const [updated] = await db
        .update(bookings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(bookings.id, id))
        .returning();

      return reply.send({ data: updated });
    },
  );
}
