import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdminTier } from "../../lib/auth-middleware.js";
import {
  getDb,
  tenants,
  tenantSubscriptions,
  eq,
  or,
  ilike,
} from "@hvac-saas/database";
import { getPlanPrice } from "../../lib/plan-prices.js";
import { adminSearchQuery } from "../../lib/schemas/admin.js";

const adminSearchRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /admin/search?q=term
   * Global cross-tenant search.
   */
  fastify.get(
    "/",
    {
      preHandler: [
        requireAdminTier(["super_admin", "support"]),
      ],
      schema: { querystring: adminSearchQuery },
    },
    async (request, reply) => {
      const { q, limit } = request.query;

      if (!q || q.length < 2) {
        return reply.send({ data: { tenants: [] } });
      }

      const db = getDb();
      const limitNum = limit;

      const tenantResults = await db
        .select({
          id: tenants.id,
          businessName: tenants.businessName,
          ownerName: tenants.ownerName,
          email: tenants.email,
          slug: tenants.slug,
          isActive: tenants.isActive,
          subscriptionStatus: tenantSubscriptions.status,
          planName: tenantSubscriptions.planName,
        })
        .from(tenants)
        .leftJoin(
          tenantSubscriptions,
          eq(tenants.id, tenantSubscriptions.tenantId),
        )
        .where(
          or(
            ilike(tenants.businessName, `%${q}%`),
            ilike(tenants.ownerName, `%${q}%`),
            ilike(tenants.email, `%${q}%`),
            ilike(tenants.slug, `%${q}%`),
          ),
        )
        .limit(limitNum);

      return reply.send({
        data: {
          tenants: tenantResults.map((r) => ({
            ...r,
            mrr: getPlanPrice(r.planName),
          })),
        },
      });
    },
  );
};
export default adminSearchRoutes;
