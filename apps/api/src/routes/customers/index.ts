import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  customers,
  eq,
  and,
  or,
  ilike,
  desc,
  asc,
  count,
} from "@hvac-saas/database";

export default async function customerRoutes(fastify: FastifyInstance) {
  /**
   * GET /customers
   * List customers with search, pagination, sorting.
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const {
        search = "",
        page = "1",
        limit = "20",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = request.query as Record<string, string>;

      const tenantId = request.authUser.tenantId!;
      const db = getDb();
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      const baseFilter = eq(customers.tenantId, tenantId);

      const searchFilter = search
        ? or(
            ilike(customers.firstName, `%${search}%`),
            ilike(customers.lastName, `%${search}%`),
            ilike(customers.email, `%${search}%`),
            ilike(customers.phone, `%${search}%`),
          )
        : undefined;

      const whereClause = searchFilter
        ? and(baseFilter, searchFilter)
        : baseFilter;

      // Determine sort column
      const sortColumnMap = {
        createdAt: customers.createdAt,
        firstName: customers.firstName,
        lastName: customers.lastName,
        email: customers.email,
      } as const;
      const sortCol = sortColumnMap[sortBy as keyof typeof sortColumnMap] ?? customers.createdAt;
      const orderFn = sortOrder === "asc" ? asc : desc;

      const [data, totalResult] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(whereClause)
          .orderBy(orderFn(sortCol))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(customers)
          .where(whereClause),
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

  /**
   * POST /customers
   * Create a new customer.
   */
  fastify.post(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;

      if (!body.firstName || !body.lastName) {
        return reply
          .status(400)
          .send({ message: "firstName and lastName are required" });
      }

      const db = getDb();
      const [customer] = await db
        .insert(customers)
        .values({
          tenantId,
          firstName: body.firstName as string,
          lastName: body.lastName as string,
          email: (body.email as string) || null,
          phone: (body.phone as string) || null,
          address: (body.address as string) || null,
          city: (body.city as string) || null,
          state: (body.state as string) || null,
          zipCode: (body.zipCode as string) || null,
          notes: (body.notes as string) || null,
        })
        .returning();

      return reply.status(201).send({ data: customer });
    },
  );

  /**
   * GET /customers/:id
   * Get a single customer by ID.
   */
  fastify.get(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
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
   * PATCH /customers/:id
   * Update a customer.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const body = request.body as Record<string, unknown>;
      const db = getDb();

      // Verify ownership
      const existing = await db
        .select({ id: customers.id })
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

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (field in body) {
          updates[field] = body[field];
        }
      }

      const [updated] = await db
        .update(customers)
        .set(updates)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .returning();

      return reply.send({ data: updated });
    },
  );

  /**
   * DELETE /customers/:id
   * Delete a customer (hard delete, cascades via FK).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      // Verify ownership
      const existing = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)))
        .then((r) => r[0]);

      if (!existing) {
        return reply.status(404).send({ message: "Customer not found" });
      }

      await db
        .delete(customers)
        .where(and(eq(customers.tenantId, tenantId), eq(customers.id, id)));

      return reply.send({ message: "Customer deleted" });
    },
  );
}
