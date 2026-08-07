import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireOrgRole } from "../../lib/auth-middleware.js";
import {
  getDb,
  tenantMemberRates,
  member,
  user,
  organization,
  tenants,
  eq,
  and,
} from "@hvac-saas/database";
import {
  setMemberRateBody,
  memberRateParams,
} from "../../lib/schemas/job-costing.js";

/**
 * Per-member hourly cost rates.
 *
 * Owner/admin only, and deliberately so: a rate is what the business pays a
 * person, which is payroll information. A member could otherwise read every
 * colleague's cost by listing this endpoint.
 */
const memberRateRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /tenants/member-rates
   *
   * Every member of the tenant's organization with their effective rate, so
   * the settings screen can show who is still falling back to the default
   * instead of listing only the rows that happen to exist.
   */
  fastify.get(
    "/",
    { preHandler: [requireOrgRole(["owner", "admin"])] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const db = getDb();

      const [tenant] = await db
        .select({
          organizationId: tenants.organizationId,
          defaultRate: tenants.defaultLaborCostRate,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      const rows = await db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
          hourlyCostRate: tenantMemberRates.hourlyCostRate,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(
          tenantMemberRates,
          and(
            eq(tenantMemberRates.userId, user.id),
            // The tenant predicate belongs on the JOIN, not in a WHERE: without
            // it this left join would attach another tenant's rate row to a
            // shared user id. Three domains shipped exactly this bug.
            eq(tenantMemberRates.tenantId, tenantId),
          ),
        )
        .innerJoin(organization, eq(member.organizationId, organization.id))
        .where(eq(organization.id, tenant.organizationId));

      return reply.send({
        data: {
          defaultLaborCostRate: tenant.defaultRate,
          members: rows.map((r) => ({
            ...r,
            // Null here means "inherits the default", which the UI needs to
            // distinguish from an explicit override that happens to match it.
            isOverride: r.hourlyCostRate !== null,
          })),
        },
      });
    },
  );

  /**
   * PUT /tenants/member-rates
   *
   * Upsert one member's rate. Idempotent by (tenant, user) — the unique index
   * is what makes the conflict target valid, and re-sending the same rate is a
   * no-op rather than a duplicate row.
   */
  fastify.put(
    "/",
    {
      preHandler: [requireOrgRole(["owner", "admin"])],
      schema: { body: setMemberRateBody },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { userId, hourlyCostRate } = request.body;
      const db = getDb();

      // The user must be a member of *this* tenant's organization. Without this
      // check any valid user id would take a rate row, which both leaks the
      // existence of that account and pollutes the tenant's costing.
      const [tenant] = await db
        .select({ organizationId: tenants.organizationId })
        .from(tenants)
        .where(eq(tenants.id, tenantId));

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      const [membership] = await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, tenant.organizationId),
            eq(member.userId, userId),
          ),
        );

      if (!membership) {
        return reply
          .status(400)
          .send({ message: "That user is not a member of this business" });
      }

      const [row] = await db
        .insert(tenantMemberRates)
        .values({ tenantId, userId, hourlyCostRate })
        .onConflictDoUpdate({
          target: [tenantMemberRates.tenantId, tenantMemberRates.userId],
          set: { hourlyCostRate, updatedAt: new Date() },
        })
        .returning();

      return reply.send({ data: row });
    },
  );

  /**
   * DELETE /tenants/member-rates/:userId
   * Drop the override so this member falls back to the tenant default.
   */
  fastify.delete(
    "/:userId",
    {
      preHandler: [requireOrgRole(["owner", "admin"])],
      schema: { params: memberRateParams },
    },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const { userId } = request.params;
      const db = getDb();

      await db
        .delete(tenantMemberRates)
        .where(
          and(
            eq(tenantMemberRates.tenantId, tenantId),
            eq(tenantMemberRates.userId, userId),
          ),
        );

      // No 404 on a missing row: "this member has no override" is the state the
      // caller asked for, and it is already true.
      return reply.send({ data: { userId } });
    },
  );
};

export default memberRateRoutes;
