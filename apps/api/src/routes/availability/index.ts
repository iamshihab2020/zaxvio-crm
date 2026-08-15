import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  idParam,
  updateAvailabilityBody,
  createScheduleOverrideBody,
} from "../../lib/schemas/availability.js";
import {
  getDb,
  availabilitySchedules,
  scheduleOverrides,
  tenants,
  eq,
  and,
  gte,
  asc,
} from "@hvac-saas/database";
import { getTenantToday } from "../../lib/timezone.js";
import { seedDefaultAvailability } from "../../services/availability.service.js";

const availabilityRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /availability
   *
   * Returns the tenant's weekly schedule (7 rows), upcoming overrides, the tenant
   * timezone and the concurrent-booking capacity.
   *
   * Overrides were always in this payload; the internal calendar just never read
   * them, so a contractor who closed 25 December saw the portal refuse bookings
   * while their own calendar showed a normal working day (BOOK-10). Timezone is
   * returned so the calendar can stop rendering in the browser's zone (BOOK-25).
   *
   * Lazy-seeds defaults if no schedule exists (for tenants created before seeding was added).
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Load tenant timezone (DF-BK-02)
      const tenantRow = await db
        .select({
          timezone: tenants.timezone,
          slotCapacity: tenants.bookingSlotCapacity,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);
      const tz = tenantRow?.timezone ?? "America/Chicago";

      // `weeklySchedule` is reassigned below when the tenant has none yet;
      // `overrides` never is, so they are declared apart rather than both being
      // `let` for the sake of one.
      const [initialSchedule, overrides] = await Promise.all([
        db
          .select()
          .from(availabilitySchedules)
          .where(eq(availabilitySchedules.tenantId, tenantId))
          .orderBy(asc(availabilitySchedules.dayOfWeek)),
        db
          .select()
          .from(scheduleOverrides)
          .where(
            and(
              eq(scheduleOverrides.tenantId, tenantId),
              gte(scheduleOverrides.overrideDate, getTenantToday(tz)),
            ),
          )
          .orderBy(asc(scheduleOverrides.overrideDate)),
      ]);

      // Lazy-seed default schedule for existing tenants
      let weeklySchedule = initialSchedule;
      if (weeklySchedule.length === 0) {
        weeklySchedule = await seedDefaultAvailability(db, tenantId);
      }

      return reply.send({
        data: {
          weeklySchedule,
          overrides,
          timezone: tz,
          slotCapacity: tenantRow?.slotCapacity ?? 1,
        },
      });
    },
  );

  /**
   * PUT /availability
   *
   * Bulk upsert the weekly schedule (all 7 days).
   * Replaces all existing rows in a transaction.
   */
  fastify.put(
    "/",
    { preHandler: [requireTenant], schema: { body: updateAvailabilityBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { schedule, slotCapacity } = request.body;

      // Business logic: no duplicate days, and active entries must have startTime < endTime
      const seenDays = new Set<number>();
      for (const entry of schedule) {
        if (seenDays.has(entry.dayOfWeek)) {
          return reply.status(400).send({ message: `Duplicate dayOfWeek: ${entry.dayOfWeek}` });
        }
        seenDays.add(entry.dayOfWeek);

        if (entry.isActive && entry.startTime >= entry.endTime) {
          return reply.status(400).send({ message: `startTime must be before endTime for day ${entry.dayOfWeek}` });
        }
      }

      const db = getDb();

      // Transaction: delete all existing + insert new
      await db.transaction(async (tx) => {
        await tx
          .delete(availabilitySchedules)
          .where(eq(availabilitySchedules.tenantId, tenantId));

        await tx.insert(availabilitySchedules).values(
          schedule.map((entry) => ({
            tenantId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            isActive: entry.isActive,
          })),
        );

        if (slotCapacity !== undefined) {
          await tx
            .update(tenants)
            .set({ bookingSlotCapacity: slotCapacity, updatedAt: new Date() })
            .where(eq(tenants.id, tenantId));
        }
      });

      // Return the updated schedule
      const updated = await db
        .select()
        .from(availabilitySchedules)
        .where(eq(availabilitySchedules.tenantId, tenantId))
        .orderBy(asc(availabilitySchedules.dayOfWeek));

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /availability/overrides
   *
   * Create a schedule override (holiday, closure, custom hours).
   */
  fastify.post(
    "/overrides",
    { preHandler: [requireTenant], schema: { body: createScheduleOverrideBody } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;
      const db = getDb();

      // Load tenant timezone (DF-BK-02)
      const tenantRow = await db.select({ timezone: tenants.timezone })
        .from(tenants).where(eq(tenants.id, tenantId)).then((r) => r[0]);
      const tz = tenantRow?.timezone ?? "America/Chicago";

      // Validate date is not in the past
      const today = getTenantToday(tz);
      if (body.overrideDate < today) {
        return reply.status(400).send({ message: "Override date cannot be in the past." });
      }

      // If available with custom hours, validate times
      if (body.isAvailable) {
        if (!body.startTime || !body.endTime) {
          return reply.status(400).send({ message: "startTime and endTime are required when isAvailable is true." });
        }
        if (body.startTime >= body.endTime) {
          return reply.status(400).send({ message: "startTime must be before endTime." });
        }
      }

      // Check for duplicate
      const existing = await db
        .select({ id: scheduleOverrides.id })
        .from(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.tenantId, tenantId),
            eq(scheduleOverrides.overrideDate, body.overrideDate),
          ),
        )
        .then((r) => r[0]);

      if (existing) {
        return reply.status(409).send({ message: "An override already exists for this date." });
      }

      const [created] = await db
        .insert(scheduleOverrides)
        .values({
          tenantId,
          overrideDate: body.overrideDate,
          isAvailable: body.isAvailable,
          startTime: body.isAvailable ? body.startTime : null,
          endTime: body.isAvailable ? body.endTime : null,
          reason: body.reason?.trim() || null,
        })
        .returning();

      return reply.status(201).send({ data: created });
    },
  );

  /**
   * DELETE /availability/overrides/:id
   *
   * Delete a schedule override.
   */
  fastify.delete(
    "/overrides/:id",
    { preHandler: [requireTenant], schema: { params: idParam } },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const db = getDb();

      const existing = await db
        .select({ id: scheduleOverrides.id })
        .from(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.id, id),
            eq(scheduleOverrides.tenantId, tenantId),
          ),
        )
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Override not found." });
      }

      // tenantId in the WHERE, not just the id ([[security-rules]] §1). The
      // ownership SELECT above is a guard, not a substitute: it is separated from
      // the write by an `await`, and the next person to edit this handler will not
      // know the guard is load-bearing.
      await db
        .delete(scheduleOverrides)
        .where(
          and(
            eq(scheduleOverrides.id, id),
            eq(scheduleOverrides.tenantId, tenantId),
          ),
        );

      return reply.status(204).send();
    },
  );
};
export default availabilityRoutes;
