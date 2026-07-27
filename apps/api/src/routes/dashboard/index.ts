import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import {
  getDashboardStats,
  getDashboardPipelineBreakdown,
} from "../../services/analytics/dashboard.service.js";
import {
  dashboardStatsQuery,
  dashboardPipelineQuery,
} from "../../lib/schemas/dashboard.js";

const dashboardRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("preHandler", requireTenant);

  const f = fastify.withTypeProvider<ZodTypeProvider>();

  // GET /dashboard/stats — all KPI data in one response
  f.get("/stats", { schema: { querystring: dashboardStatsQuery } }, async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const { from, to, granularity } = request.query;

    const params = buildDateRangeParams(
      tenantId,
      from,
      to,
      request.authUser.tenantTimezone,
    );
    const data = await getDashboardStats(db, params, granularity, fastify.log);

    return { data };
  });

  // GET /dashboard/pipeline — stage distribution only.
  // Split out so changing the pipeline selector does not re-run the full
  // 20-query dashboard fan-out just to repaint one segmented bar.
  f.get(
    "/pipeline",
    { schema: { querystring: dashboardPipelineQuery } },
    async (request) => {
      const db = getDb();
      const tenantId = request.authUser.tenantId!;

      const data = await getDashboardPipelineBreakdown(
        db,
        tenantId,
        request.query.pipelineId ?? null,
        fastify.log,
      );

      return { data };
    },
  );
};
export default dashboardRoutes;
