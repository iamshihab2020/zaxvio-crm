import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdmin } from "../../lib/auth-middleware.js";
import { getPlanPrice } from "../../lib/plan-prices.js";
import {
  getDb,
  tenants,
  tenantSubscriptions,
  platformEvents,
  jobs,
  customers,
  invoices,
  quotes,
  bookings,
  eq,
  and,
  gte,
  desc,
  count,
  sql,
  countDistinct,
} from "@hvac-saas/database";
import { churnQuery } from "../../lib/schemas/admin.js";

const adminAnalyticsRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /admin/analytics/mrr
   * MRR metrics: current, 30d ago delta, breakdown by plan.
   */
  fastify.get(
    "/mrr",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();

      // Current plan distribution
      const planCounts = await db
        .select({
          planName: tenantSubscriptions.planName,
          count: count(),
        })
        .from(tenantSubscriptions)
        .where(
          sql`${tenantSubscriptions.status} IN ('active', 'trialing')`,
        )
        .groupBy(tenantSubscriptions.planName);

      let currentMRR = 0;
      const breakdown = planCounts.map((row) => {
        const price = getPlanPrice(row.planName);
        const planMRR = price * Number(row.count);
        currentMRR += planMRR;
        return {
          planName: row.planName,
          count: Number(row.count),
          price,
          mrr: planMRR,
        };
      });

      // Total active tenants
      const totalActive = planCounts.reduce((sum, r) => sum + Number(r.count), 0);

      return reply.send({
        data: {
          currentMRR,
          totalActiveSubscriptions: totalActive,
          breakdown,
        },
      });
    },
  );

  /**
   * GET /admin/analytics/signups
   * Daily new tenant signups for last 90 days.
   */
  fastify.get(
    "/signups",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const signups = await db
        .select({
          date: sql<string>`DATE(${tenants.createdAt})`,
          count: count(),
        })
        .from(tenants)
        .where(gte(tenants.createdAt, ninetyDaysAgo))
        .groupBy(sql`DATE(${tenants.createdAt})`)
        .orderBy(sql`DATE(${tenants.createdAt})`);

      return reply.send({
        data: signups.map((r) => ({
          date: r.date,
          count: Number(r.count),
        })),
      });
    },
  );

  /**
   * GET /admin/analytics/active-users
   * DAT/WAT/MAT counts from platform_events.
   */
  fastify.get(
    "/active-users",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [dat, wat, mat] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, oneDayAgo))
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, sevenDaysAgo))
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: sql<number>`COUNT(DISTINCT ${platformEvents.tenantId})` })
          .from(platformEvents)
          .where(gte(platformEvents.createdAt, thirtyDaysAgo))
          .then((r) => Number(r[0]?.count ?? 0)),
      ]);

      return reply.send({
        data: { dat, wat, mat },
      });
    },
  );

  /**
   * GET /admin/analytics/churn
   * Tenants that cancelled in last 30/60/90 days.
   */
  fastify.get(
    "/churn",
    {
      preHandler: [requireAdmin],
      schema: { querystring: churnQuery },
    },
    async (request, reply) => {
      const { days } = request.query;
      const db = getDb();
      const since = new Date();
      since.setDate(since.getDate() - days);

      const churned = await db
        .select({
          tenantId: tenantSubscriptions.tenantId,
          businessName: tenants.businessName,
          planName: tenantSubscriptions.planName,
          cancelledAt: tenantSubscriptions.cancelledAt,
          createdAt: tenants.createdAt,
        })
        .from(tenantSubscriptions)
        .innerJoin(tenants, eq(tenants.id, tenantSubscriptions.tenantId))
        .where(
          and(
            eq(tenantSubscriptions.status, "cancelled"),
            gte(tenantSubscriptions.cancelledAt, since),
          ),
        )
        .orderBy(desc(tenantSubscriptions.cancelledAt));

      const data = churned.map((row) => ({
        ...row,
        mrrLost: getPlanPrice(row.planName),
        daysActive: row.cancelledAt && row.createdAt
          ? Math.floor(
              (row.cancelledAt.getTime() - row.createdAt.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : null,
      }));

      return reply.send({ data });
    },
  );

  /**
   * GET /admin/analytics/trial-conversion
   * Trial funnel: total → activated → converted → churned.
   */
  fastify.get(
    "/trial-conversion",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();

      const [totalTrials, activeTrials, converted, cancelled] =
        await Promise.all([
          db
            .select({ count: count() })
            .from(tenantSubscriptions)
            .then((r) => Number(r[0]?.count ?? 0)),
          db
            .select({ count: count() })
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.status, "trialing"))
            .then((r) => Number(r[0]?.count ?? 0)),
          db
            .select({ count: count() })
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.status, "active"))
            .then((r) => Number(r[0]?.count ?? 0)),
          db
            .select({ count: count() })
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.status, "cancelled"))
            .then((r) => Number(r[0]?.count ?? 0)),
        ]);

      return reply.send({
        data: {
          totalTrials,
          activeTrials,
          converted,
          cancelled,
          conversionRate:
            totalTrials > 0
              ? Math.round((converted / totalTrials) * 100 * 10) / 10
              : 0,
        },
      });
    },
  );

  /**
   * GET /admin/analytics/inactive-alerts
   * Tenants with no platform_events in last 14 days — churn risk.
   */
  fastify.get(
    "/inactive-alerts",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      // Get all active tenants
      const activeTenants = await db
        .select({
          id: tenants.id,
          businessName: tenants.businessName,
          ownerName: tenants.ownerName,
          email: tenants.email,
          createdAt: tenants.createdAt,
          planName: tenantSubscriptions.planName,
          subscriptionStatus: tenantSubscriptions.status,
        })
        .from(tenants)
        .leftJoin(
          tenantSubscriptions,
          eq(tenants.id, tenantSubscriptions.tenantId),
        )
        .where(eq(tenants.isActive, true));

      // Get tenants with recent activity
      const activeRecently = await db
        .select({
          tenantId: platformEvents.tenantId,
        })
        .from(platformEvents)
        .where(gte(platformEvents.createdAt, fourteenDaysAgo))
        .groupBy(platformEvents.tenantId);

      const activeIds = new Set(activeRecently.map((r) => r.tenantId));

      // Filter to only inactive tenants
      const inactive = activeTenants
        .filter((t) => !activeIds.has(t.id))
        .map((t) => ({
          ...t,
          mrr: getPlanPrice(t.planName),
          daysSinceActivity: null as number | null,
        }));

      return reply.send({ data: inactive });
    },
  );

  /**
   * GET /admin/analytics/feature-adoption
   * % of tenants using each feature.
   */
  fastify.get(
    "/feature-adoption",
    { preHandler: [requireAdmin] },
    async (_request, reply) => {
      const db = getDb();

      // Total active tenants
      const totalResult = await db
        .select({ count: count() })
        .from(tenants)
        .where(eq(tenants.isActive, true));
      const totalTenants = Number(totalResult[0]?.count ?? 0) || 1;

      // Count distinct tenants per feature
      const [
        tenantsWithJobs,
        tenantsWithCustomers,
        tenantsWithInvoices,
        tenantsWithQuotes,
        tenantsWithBookings,
      ] = await Promise.all([
        db
          .select({ count: countDistinct(jobs.tenantId) })
          .from(jobs)
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: countDistinct(customers.tenantId) })
          .from(customers)
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: countDistinct(invoices.tenantId) })
          .from(invoices)
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: countDistinct(quotes.tenantId) })
          .from(quotes)
          .then((r) => Number(r[0]?.count ?? 0)),
        db
          .select({ count: countDistinct(bookings.tenantId) })
          .from(bookings)
          .then((r) => Number(r[0]?.count ?? 0)),
      ]);

      const features = [
        { feature: "Jobs", tenants: tenantsWithJobs, percentage: Math.round((tenantsWithJobs / totalTenants) * 100) },
        { feature: "Customers", tenants: tenantsWithCustomers, percentage: Math.round((tenantsWithCustomers / totalTenants) * 100) },
        { feature: "Invoices", tenants: tenantsWithInvoices, percentage: Math.round((tenantsWithInvoices / totalTenants) * 100) },
        { feature: "Quotes", tenants: tenantsWithQuotes, percentage: Math.round((tenantsWithQuotes / totalTenants) * 100) },
        { feature: "Bookings", tenants: tenantsWithBookings, percentage: Math.round((tenantsWithBookings / totalTenants) * 100) },
      ];

      return reply.send({
        data: { totalTenants, features },
      });
    },
  );
};
export default adminAnalyticsRoutes;
