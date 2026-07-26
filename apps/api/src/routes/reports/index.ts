import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import { getReportBySection } from "../../services/analytics/reports.service.js";
import { reportStatsQuery } from "../../lib/schemas/dashboard.js";

const reportRoutes: FastifyPluginAsyncZod = async (fastify) => {
  fastify.addHook("preHandler", requireTenant);

  const f = fastify.withTypeProvider<ZodTypeProvider>();

  f.get("/stats", { schema: { querystring: reportStatsQuery } }, async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const { section, from, to, granularity } = request.query;

    const params = buildDateRangeParams(
      tenantId,
      from,
      to,
      request.authUser.tenantTimezone,
      granularity,
    );

    // `section` is a Zod enum and the service is exhaustive over it, so there is
    // no "unknown section" path left to model. A genuine failure now propagates
    // as a 5xx instead of a 200 whose error body the client rendered as
    // "No data available for this period."
    const data = await getReportBySection(db, section, params, request.log);

    return { data };
  });
};
export default reportRoutes;
