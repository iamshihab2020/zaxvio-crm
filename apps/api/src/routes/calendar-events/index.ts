import type { FastifyInstance } from "fastify";
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

/** Convert empty strings to null for optional DB fields */
function emptyToNull(val: string | undefined | null): string | null {
  if (val === undefined || val === null || val === "") return null;
  return val;
}

export default async function calendarEventRoutes(fastify: FastifyInstance) {
  /**
   * GET /calendar-events
   * List events with date range filters and pagination.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const query = request.query as {
        dateFrom?: string;
        dateTo?: string;
        page?: string;
        limit?: string;
      };

      const page = Math.max(1, parseInt(query.page ?? "1", 10));
      const limit = Math.min(200, Math.max(1, parseInt(query.limit ?? "50", 10)));
      const offset = (page - 1) * limit;

      const db = getDb();
      const filters: any[] = [eq(calendarEvents.tenantId, tenantId)];

      if (query.dateFrom) {
        filters.push(gte(calendarEvents.eventDate, query.dateFrom));
      }
      if (query.dateTo) {
        filters.push(lte(calendarEvents.eventDate, query.dateTo));
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
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
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
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as {
        title: string;
        description?: string;
        eventDate: string;
        startTime?: string;
        endTime?: string;
        contactName?: string;
        contactPhone?: string;
        address?: string;
        notes?: string;
        color?: string;
        customerId?: string;
      };

      if (!body.title || !body.eventDate) {
        return reply.status(400).send({ message: "Title and event date are required" });
      }

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
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        description?: string;
        eventDate?: string;
        startTime?: string;
        endTime?: string;
        contactName?: string;
        contactPhone?: string;
        address?: string;
        notes?: string;
        color?: string;
        customerId?: string | null;
      };

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
        const updates: Record<string, any> = { updatedAt: sql`now()` };
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
        if (body.customerId !== undefined) updates.customerId = emptyToNull(body.customerId as string);

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
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { id } = request.params as { id: string };
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
