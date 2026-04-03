import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import { getDb } from "@hvac-saas/database";
import type { ReportSection } from "@hvac-saas/types";
import { buildDateRangeParams } from "../../services/analytics/types.js";
import { getReportBySection } from "../../services/analytics/reports.service.js";

export default async function reportRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireTenant);

  fastify.get("/stats", async (request) => {
    const db = getDb();
    const tenantId = request.authUser.tenantId!;
    const query = request.query as { section?: string; from?: string; to?: string };

    const section = (query.section ?? "revenue") as ReportSection;
    const params = buildDateRangeParams(tenantId, query.from, query.to);

    const data = await getReportBySection(db, section, params);
    if (!data) {
      return { data: null, error: `Unknown section: ${section}` };
    }

    return { data };
  });
}
