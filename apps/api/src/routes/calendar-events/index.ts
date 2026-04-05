import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  calendarEvents,
  eq,
  and,
  gte,
  lte,
  desc,
  asc,
  count,
  sql,
} from "@hvac-saas/database";
import {
  calendarEventsQuery,
  createCalendarEventBody,
  updateCalendarEventBody,
} from "../../lib/schemas/calendar-events.js";
import { idParam } from "../../lib/schemas/common.js";

/** Convert empty strings to null for optional DB fields */
function emptyToNull(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val === "") return null;
  return val;
}

export default async function calendarEventRoutes(fastify: FastifyInstance) {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /calendar-events
   * List events with date range filters and pagination.
   */
  f.get(
    "/",
    {
      preHandler: [requireTenant],
      schema: { querystring: calendarEventsQuery },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { dateFrom, dateTo, page, limit } = request.query;

      const offset = (page - 1) * limit;

      const db = getDb();
      const filters: ReturnType<typeof eq>[] = [eq(calendarEvents.tenantId, tenantId)];

      if (dateFrom) {
        filters.push(gte(calendarEvents.eventDate, dateFrom));
      }
      if (dateTo) {
        filters.push(lte(calendarEvents.eventDate, dateTo));
      }

      const whereClause = and(...filters);

      const [data, [{ total }]] = await Promise.all([
        db
          .select()
          .from(calendarEvents)
          .where(whereClause)
          .orderBy(asc(calendarEvents.eventDate), asc(calendarEvents.startTime))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(calendarEvents)
          .where(whereClause),
      ]);

      return reply.send({
        data,
        pagination: {
          page,
          limit,
          total: Number(total),
          totalPages: Math.ceil(Number(total) / limit),
        },
      });
    },
  );

  /**
   * GET /calendar-events/:id
   */
  f.get(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const db = getDb();

      const [event] = await db
        .select()
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)));

      if (!event) {
        return reply.status(404).send({ message: "Event not found" });
      }

      return reply.send({ data: event });
    },
  );

  /**
   * POST /calendar-events
   */
  f.post(
    "/",
    {
      preHandler: [requireTenant],
      schema: { body: createCalendarEventBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body;

      try {
        const db = getDb();
        const [event] = await db
          .insert(calendarEvents)
          .values({
            tenantId,
            title: body.title,
            description: emptyToNull(body.description),
            eventDate: body.eventDate,
            startTime: emptyToNull(body.startTime),
            endTime: emptyToNull(body.endTime),
            contactName: emptyToNull(body.contactName),
            contactPhone: emptyToNull(body.contactPhone),
            address: emptyToNull(body.address),
            notes: emptyToNull(body.notes),
            color: body.color || "purple",
            customerId: emptyToNull(body.customerId),
          })
          .returning();

        return reply.status(201).send({ data: event });
      } catch (err) {
        fastify.log.error(err, "Failed to create calendar event");
        return reply.status(500).send({ message: "Failed to create event" });
      }
    },
  );

  /**
   * PATCH /calendar-events/:id
   */
  f.patch(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam, body: updateCalendarEventBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const body = request.body;

      const db = getDb();

      // Verify ownership
      const [existing] = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)));

      if (!existing) {
        return reply.status(404).send({ message: "Event not found" });
      }

      try {
        const updates: Record<string, unknown> = { updatedAt: sql`now()` };
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = emptyToNull(body.description);
        if (body.eventDate !== undefined) updates.eventDate = body.eventDate;
        if (body.startTime !== undefined) updates.startTime = emptyToNull(body.startTime);
        if (body.endTime !== undefined) updates.endTime = emptyToNull(body.endTime);
        if (body.contactName !== undefined) updates.contactName = emptyToNull(body.contactName);
        if (body.contactPhone !== undefined) updates.contactPhone = emptyToNull(body.contactPhone);
        if (body.address !== undefined) updates.address = emptyToNull(body.address);
        if (body.notes !== undefined) updates.notes = emptyToNull(body.notes);
        if (body.color !== undefined) updates.color = body.color;
        if (body.customerId !== undefined) updates.customerId = emptyToNull(body.customerId);

        const [updated] = await db
          .update(calendarEvents)
          .set(updates)
          .where(eq(calendarEvents.id, id))
          .returning();

        return reply.send({ data: updated });
      } catch (err) {
        fastify.log.error(err, "Failed to update calendar event");
        return reply.status(500).send({ message: "Failed to update event" });
      }
    },
  );

  /**
   * DELETE /calendar-events/:id
   */
  f.delete(
    "/:id",
    {
      preHandler: [requireTenant],
      schema: { params: idParam },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params;
      const db = getDb();

      const [existing] = await db
        .select({ id: calendarEvents.id })
        .from(calendarEvents)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)));

      if (!existing) {
        return reply.status(404).send({ message: "Event not found" });
      }

      await db.delete(calendarEvents).where(eq(calendarEvents.id, id));

      return reply.send({ message: "Event deleted" });
    },
  );
}
