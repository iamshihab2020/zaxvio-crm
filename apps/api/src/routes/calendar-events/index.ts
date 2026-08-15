import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  calendarEvents,
  eq,
  and,
  gte,
  lte,
  asc,
  count,
  sql,
} from "@hvac-saas/database";
import { ownsCustomer } from "../../lib/tenant-guards.js";
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

const calendarEventRoutes: FastifyPluginAsyncZod = async (fastify) => {
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

      const db = getDb();

      // No read path joins this column back to `customers` today, so this is
      // integrity rather than disclosure — but it is a client-supplied FK on a
      // tenant table, and the day something renders the customer's name here is
      // the day it becomes a leak.
      const customerId = emptyToNull(body.customerId);
      if (customerId && !(await ownsCustomer(db, tenantId, customerId))) {
        return reply.status(400).send({ message: "Customer not found" });
      }

      try {
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
            customerId,
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

      const nextCustomerId =
        body.customerId !== undefined ? emptyToNull(body.customerId) : undefined;
      if (nextCustomerId && !(await ownsCustomer(db, tenantId, nextCustomerId))) {
        return reply.status(400).send({ message: "Customer not found" });
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
        if (body.customerId !== undefined) updates.customerId = nextCustomerId;

        // tenantId in the WHERE, not just the id ([[security-rules]] §1) — the
        // ownership check above is separated from this write by an `await`.
        const [updated] = await db
          .update(calendarEvents)
          .set(updates)
          .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)))
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

      // tenantId in the WHERE, not just the id ([[security-rules]] §1).
      await db
        .delete(calendarEvents)
        .where(and(eq(calendarEvents.id, id), eq(calendarEvents.tenantId, tenantId)));

      return reply.send({ message: "Event deleted" });
    },
  );
};
export default calendarEventRoutes;
