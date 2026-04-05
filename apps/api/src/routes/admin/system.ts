import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdminTier } from "../../lib/auth-middleware.js";
import {
  getDb,
  webhookLogs,
  cronJobHistory,
  desc,
  count,
  sql,
} from "@hvac-saas/database";
import { systemLimitQuery } from "../../lib/schemas/admin.js";

const adminSystemRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /admin/system
   * System health overview.
   */
  fastify.get(
    "/",
    { preHandler: [requireAdminTier(["super_admin"])] },
    async (_request, reply) => {
      const uptime = process.uptime();
      const memory = process.memoryUsage();

      // Quick DB connectivity check
      let dbStatus = "healthy";
      try {
        const db = getDb();
        await db.execute(sql`SELECT 1`);
      } catch {
        dbStatus = "unhealthy";
      }

      return reply.send({
        data: {
          uptime: Math.round(uptime),
          database: dbStatus,
          memory: {
            heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
            rssMB: Math.round(memory.rss / 1024 / 1024),
          },
          nodeVersion: process.version,
        },
      });
    },
  );

  /**
   * GET /admin/system/webhooks
   * Last 100 webhook deliveries.
   */
  fastify.get(
    "/webhooks",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { querystring: systemLimitQuery },
    },
    async (request, reply) => {
      const { limit = 100 } = request.query;
      const db = getDb();
      const limitNum = Math.min(200, limit);

      const rows = await db
        .select()
        .from(webhookLogs)
        .orderBy(desc(webhookLogs.createdAt))
        .limit(limitNum);

      return reply.send({ data: rows });
    },
  );

  /**
   * GET /admin/system/crons
   * Cron job execution history.
   */
  fastify.get(
    "/crons",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { querystring: systemLimitQuery },
    },
    async (request, reply) => {
      const { limit = 50 } = request.query;
      const db = getDb();
      const limitNum = Math.min(200, limit);

      const rows = await db
        .select()
        .from(cronJobHistory)
        .orderBy(desc(cronJobHistory.startedAt))
        .limit(limitNum);

      return reply.send({ data: rows });
    },
  );
};
export default adminSystemRoutes;
