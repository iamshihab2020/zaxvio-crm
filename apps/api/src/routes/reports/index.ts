import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import { getReportBySection } from "../../services/analytics/reports.service.js";
import { reportStatsQuery } from "../../lib/schemas/dashboard.js";

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireTenant);

  const f = fastify.withTypeProvider<ZodTypeProvider>();

  f.get("/stats", { schema: { querystring: reportStatsQuery } }, async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const { section, from, to } = request.query;

    const params = buildDateRangeParams(tenantId, from, to);

    const data = await getReportBySection(db, section, params);
    if (!data) {
      return { data: null, error: `Unknown section: ${section}` };
    }

    return { data };
  });
}
