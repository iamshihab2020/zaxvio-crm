import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import { getDashboardStats } from "../../services/analytics/dashboard.service.js";

export default async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireTenant);

  // GET /dashboard/stats — all KPI data in one response
  fastify.get("/stats", async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const query = request.query as { from?: string; to?: string };

    const params = buildDateRangeParams(tenantId, query.from, query.to);
    const data = await getDashboardStats(db, params);

    return { data };
  });
}
