import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  availabilitySchedules,
  scheduleOverrides,
  eq,
  and,
  gte,
  asc,
  sql,
} from "@hvac-saas/database";
import { getTenantToday } from "../../lib/timezone.js";

/** Seed default Mon-Fri 8am-5pm availability for a tenant (lazy init). */
async function seedDefaultAvailability(db: ReturnType<typeof getDb>, tenantId: string) {
  await db.insert(availabilitySchedules).values(
    [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      tenantId,
      dayOfWeek: day,
      startTime: "08:00",
      endTime: "17:00",
      isActive: day >= 1 && day <= 5,
    })),
  );
  return db
    .select()
    .from(availabilitySchedules)
    .where(eq(availabilitySchedules.tenantId, tenantId))
    .orderBy(asc(availabilitySchedules.dayOfWeek));
}

export default async function availabilityRoutes(fastify: FastifyInstance) {
  /**
   * GET /availability
   *
   * Returns the tenant's weekly schedule (7 rows) + upcoming overrides.
   * Lazy-seeds defaults if no schedule exists (for tenants created before seeding was added).
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      let [weeklySchedule, overrides] = await Promise.all([
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
              gte(scheduleOverrides.overrideDate, getTenantToday("America/Chicago")),
            ),
          )
          .orderBy(asc(scheduleOverrides.overrideDate)),
      ]);

      // Lazy-seed default schedule for existing tenants
      if (weeklySchedule.length === 0) {
        weeklySchedule = await seedDefaultAvailability(db, tenantId);
      }

      return reply.send({
        data: { weeklySchedule, overrides },
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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as {
        schedule: Array<{
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          isActive: boolean;
        }>;
      };

      const { schedule } = body;

      // Validate: exactly 7 items
      if (!Array.isArray(schedule) || schedule.length !== 7) {
        return reply.status(400).send({ message: "Schedule must have exactly 7 entries (one per day)" });
      }

      // Validate each entry
      const seenDays = new Set<number>();
      for (const entry of schedule) {
        if (typeof entry.dayOfWeek !== "number" || entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
          return reply.status(400).send({ message: `Invalid dayOfWeek: ${entry.dayOfWeek}. Must be 0-6.` });
        }
        if (seenDays.has(entry.dayOfWeek)) {
          return reply.status(400).send({ message: `Duplicate dayOfWeek: ${entry.dayOfWeek}` });
        }
        seenDays.add(entry.dayOfWeek);

        if (!/^\d{2}:\d{2}$/.test(entry.startTime) || !/^\d{2}:\d{2}$/.test(entry.endTime)) {
          return reply.status(400).send({ message: `Invalid time format for day ${entry.dayOfWeek}. Expected HH:MM.` });
        }

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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as {
        overrideDate: string;
        isAvailable: boolean;
        startTime?: string;
        endTime?: string;
        reason?: string;
      };

      // Validate date format
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.overrideDate)) {
        return reply.status(400).send({ message: "Invalid date format. Expected YYYY-MM-DD." });
      }

      // Validate date is not in the past
      const today = getTenantToday("America/Chicago");
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

      const db = getDb();

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
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
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

      await db
        .delete(scheduleOverrides)
        .where(eq(scheduleOverrides.id, id));

      return reply.status(204).send();
    },
  );
}
