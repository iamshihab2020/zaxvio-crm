import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../lib/auth-middleware.js";
import { getPlanPrice } from "../../lib/plan-prices.js";
import {
  getDb,
  tenants,
  tenantSubscriptions,
  platformEvents,
  eq,
  gte,
  count,
  sql,
} from "@hvac-saas/database";

/**
 * Single combined endpoint for the admin dashboard.
 * Returns all KPI data in one request instead of 5 separate calls.
 */
export default async function adminDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Run all queries in parallel — single session check, all data at once
      const [
        totalTenantsResult,
        planCounts,
        signups,
        dat,
        wat,
        mat,
        totalTrials,
        activeTrials,
        converted,
        cancelled,
      ] = await Promise.all([
        // Total tenants
        db.select({ count: count() }).from(tenants),
        // MRR breakdown
        db
          .select({
            planName: tenantSubscriptions.planName,
            count: count(),
          })
          .from(tenantSubscriptions)
          .where(sql`${tenantSubscriptions.status} IN ('active', 'trialing')`)
          .groupBy(tenantSubscriptions.planName),
        // Signups last 90 days
        db
          .select({
            date: sql<string>`DATE(${tenants.createdAt})`,
            count: count(),
          })
          .from(tenants)
          .where(gte(tenants.createdAt, ninetyDaysAgo))
          .groupBy(sql`DATE(${tenants.createdAt})`)
          .orderBy(sql`DATE(${tenants.createdAt})`),
        // DAT
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, oneDayAgo)),
        // WAT
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, sevenDaysAgo)),
        // MAT
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, thirtyDaysAgo)),
        // Trial funnel
        db.select({ count: count() }).from(tenantSubscriptions),
        db.select({ count: count() }).from(tenantSubscriptions).where(eq(tenantSubscriptions.status, "trialing")),
        db.select({ count: count() }).from(tenantSubscriptions).where(eq(tenantSubscriptions.status, "active")),
        db.select({ count: count() }).from(tenantSubscriptions).where(eq(tenantSubscriptions.status, "cancelled")),
      ]);

      // Calculate MRR
      let currentMRR = 0;
      const breakdown = planCounts.map((row) => {
        const price = getPlanPrice(row.planName);
        const planMRR = price * Number(row.count);
        currentMRR += planMRR;
        return { planName: row.planName, count: Number(row.count), price, mrr: planMRR };
      });

      const totalTrialsNum = Number(totalTrials[0]?.count ?? 0);
      const convertedNum = Number(converted[0]?.count ?? 0);

      return reply.send({
        data: {
          totalTenants: Number(totalTenantsResult[0]?.count ?? 0),
          mrr: {
            currentMRR,
            totalActiveSubscriptions: planCounts.reduce((s, r) => s + Number(r.count), 0),
            breakdown,
          },
          signups: signups.map((r) => ({ date: r.date, count: Number(r.count) })),
          activeUsers: {
            dat: Number(dat[0]?.count ?? 0),
            wat: Number(wat[0]?.count ?? 0),
            mat: Number(mat[0]?.count ?? 0),
          },
          trialConversion: {
            totalTrials: totalTrialsNum,
            activeTrials: Number(activeTrials[0]?.count ?? 0),
            converted: convertedNum,
            cancelled: Number(cancelled[0]?.count ?? 0),
            conversionRate: totalTrialsNum > 0 ? Math.round((convertedNum / totalTrialsNum) * 100 * 10) / 10 : 0,
          },
        },
      });
    },
  );
}
