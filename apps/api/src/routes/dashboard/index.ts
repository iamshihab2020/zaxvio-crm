import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import { getDashboardStats } from "../../services/analytics/dashboard.service.js";
import { dashboardStatsQuery } from "../../lib/schemas/dashboard.js";

const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("preHandler", requireTenant);

  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /dashboard/stats — all KPI data in one response
  f.get("/stats", { schema: { querystring: dashboardStatsQuery } }, async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const { from, to, granularity, pipelineId } = request.query;

    const params = buildDateRangeParams(tenantId, from, to);
    const data = await getDashboardStats(db, params, granularity, pipelineId ?? null);

    return { data };
  });
};
export default dashboardRoutes;
