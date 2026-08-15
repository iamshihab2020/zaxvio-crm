import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  requireAdmin,
  requireAdminTier,
} from "../../lib/auth-middleware.js";
import { logAdminAction } from "../../lib/admin-audit.js";
import { getPlanPrice } from "../../lib/plan-prices.js";
import {
  getDb,
  tenants,
  tenantSubscriptions,
  customers,
  jobs,
  invoices,
  invoicePayments,
  quotes,
  bookings,
  equipment,
  catalogItems,
  jobChecklistCompletions,
  platformEvents,
  eq,
  and,
  ne,
  or,
  ilike,
  desc,
  asc,
  count,
  sql,
} from "@hvac-saas/database";
import { stripHtmlTags } from "../../lib/sanitize.js";
import {
  adminIdParam,
  listTenantsQuery,
  extendTrialBody,
  overrideSubscriptionBody,
  patchTenantBody,
  deleteTenantBody,
} from "../../lib/schemas/admin.js";
import { containsPattern } from "../../lib/search.js";

const adminTenantRoutes: FastifyPluginAsyncZod = async (fastify) => {
  /**
   * GET /admin/tenants
   * List all tenants with search, pagination, sorting, status filter.
   */
  fastify.get(
    "/",
    {
      preHandler: [requireAdmin],
      schema: { querystring: listTenantsQuery },
    },
    async (request, reply) => {
      const { search, page, limit, status, sortBy, sortOrder } = request.query;

      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(tenants.businessName, containsPattern(search)),
            ilike(tenants.ownerName, containsPattern(search)),
            ilike(tenants.email, containsPattern(search)),
            ilike(tenants.slug, containsPattern(search)),
          ),
        );
      }

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      // Get tenants with subscription data
      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: tenants.id,
            businessName: tenants.businessName,
            ownerName: tenants.ownerName,
            email: tenants.email,
            slug: tenants.slug,
            phone: tenants.phone,
            isActive: tenants.isActive,
            trialEndsAt: tenants.trialEndsAt,
            referralSource: tenants.referralSource,
            createdAt: tenants.createdAt,
            subscriptionStatus: tenantSubscriptions.status,
            planName: tenantSubscriptions.planName,
          })
          .from(tenants)
          .leftJoin(
            tenantSubscriptions,
            eq(tenants.id, tenantSubscriptions.tenantId),
          )
          .where(where)
          .orderBy(
            sortOrder === "asc"
              ? asc(tenants[sortBy as keyof typeof tenants.$inferSelect] ?? tenants.createdAt)
              : desc(tenants[sortBy as keyof typeof tenants.$inferSelect] ?? tenants.createdAt),
          )
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(tenants)
          .where(where)
          .then((r) => r[0]),
      ]);

      // Filter by subscription status if provided
      let filteredRows = rows;
      if (status) {
        filteredRows = rows.filter((r) => r.subscriptionStatus === status);
      }

      const data = filteredRows.map((row) => ({
        ...row,
        mrr: getPlanPrice(row.planName),
      }));

      return reply.send({
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalResult?.total ?? 0,
          totalPages: Math.ceil((totalResult?.total ?? 0) / limitNum),
        },
      });
    },
  );

  /**
   * GET /admin/tenants/:id
   * Tenant detail with computed stats.
   */
  fastify.get(
    "/:id",
    {
      preHandler: [requireAdmin],
      schema: { params: adminIdParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const tenant = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, id))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      const [subscription, customerCount, jobCount, invoiceCount, lastEvent] =
        await Promise.all([
          db
            .select()
            .from(tenantSubscriptions)
            .where(eq(tenantSubscriptions.tenantId, id))
            .then((r) => r[0]),
          db
            .select({ count: count() })
            .from(customers)
            .where(eq(customers.tenantId, id))
            .then((r) => r[0]?.count ?? 0),
          db
            .select({ count: count() })
            .from(jobs)
            .where(eq(jobs.tenantId, id))
            .then((r) => r[0]?.count ?? 0),
          db
            .select({ count: count() })
            .from(invoices)
            .where(eq(invoices.tenantId, id))
            .then((r) => r[0]?.count ?? 0),
          db
            .select({ createdAt: platformEvents.createdAt })
            .from(platformEvents)
            .where(eq(platformEvents.tenantId, id))
            .orderBy(desc(platformEvents.createdAt))
            .limit(1)
            .then((r) => r[0]),
        ]);

      return reply.send({
        data: {
          ...tenant,
          subscription: subscription
            ? {
                ...subscription,
                mrr: getPlanPrice(subscription.planName),
              }
            : null,
          stats: {
            customerCount,
            jobCount,
            invoiceCount,
          },
          lastActiveAt: lastEvent?.createdAt ?? null,
        },
      });
    },
  );

  /**
   * POST /admin/tenants/:id/deactivate
   */
  fastify.post(
    "/:id/deactivate",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { params: adminIdParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      await db
        .update(tenants)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(tenants.id, id));

      await logAdminAction(
        request.authUser.userId,
        "tenant_deactivate",
        id,
        null,
        request.ip,
      );

      return reply.send({ success: true });
    },
  );

  /**
   * POST /admin/tenants/:id/activate
   */
  fastify.post(
    "/:id/activate",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { params: adminIdParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      await db
        .update(tenants)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(tenants.id, id));

      await logAdminAction(
        request.authUser.userId,
        "tenant_activate",
        id,
        null,
        request.ip,
      );

      return reply.send({ success: true });
    },
  );

  /**
   * POST /admin/tenants/:id/extend-trial
   */
  fastify.post(
    "/:id/extend-trial",
    {
      preHandler: [
        requireAdminTier(["super_admin", "support"]),
      ],
      schema: { params: adminIdParam, body: extendTrialBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { days } = request.body;

      const db = getDb();
      const tenant = await db
        .select({ trialEndsAt: tenants.trialEndsAt })
        .from(tenants)
        .where(eq(tenants.id, id))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      const baseDate = tenant.trialEndsAt ?? new Date();
      const newTrialEnd = new Date(baseDate);
      newTrialEnd.setDate(newTrialEnd.getDate() + days);

      await db
        .update(tenants)
        .set({ trialEndsAt: newTrialEnd, updatedAt: new Date() })
        .where(eq(tenants.id, id));

      await logAdminAction(
        request.authUser.userId,
        "trial_extend",
        id,
        { days, newTrialEndsAt: newTrialEnd.toISOString() },
        request.ip,
      );

      return reply.send({ success: true, trialEndsAt: newTrialEnd });
    },
  );

  /**
   * POST /admin/tenants/:id/override-subscription
   */
  fastify.post(
    "/:id/override-subscription",
    {
      preHandler: [
        requireAdminTier(["super_admin", "billing_admin"]),
      ],
      schema: { params: adminIdParam, body: overrideSubscriptionBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { status: newStatus, planName } = request.body;

      const db = getDb();
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (newStatus) updates.status = newStatus;
      if (planName) updates.planName = planName;

      await db
        .update(tenantSubscriptions)
        .set(updates)
        .where(eq(tenantSubscriptions.tenantId, id));

      await logAdminAction(
        request.authUser.userId,
        "subscription_override",
        id,
        { newStatus, planName },
        request.ip,
      );

      return reply.send({ success: true });
    },
  );

  /**
   * PATCH /admin/tenants/:id
   * Edit tenant details (P1)
   */
  fastify.patch(
    "/:id",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { params: adminIdParam, body: patchTenantBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const db = getDb();

      // Slug uniqueness check before update
      if (body.slug) {
        const conflict = await db
          .select({ id: tenants.id })
          .from(tenants)
          .where(and(eq(tenants.slug, body.slug), ne(tenants.id, id)))
          .then((r) => r[0]);
        if (conflict) {
          return reply.status(409).send({ message: "Slug already in use" });
        }
      }

      // Only allow specific fields
      const allowedFields = [
        "businessName",
        "ownerName",
        "email",
        "phone",
        "slug",
        "address",
        "city",
        "state",
        "zipCode",
      ] as const;
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updates[field] = body[field];
        }
      }

      // Sanitize text fields
      const SANITIZE_FIELDS = ["businessName", "ownerName", "address", "city", "state"];
      for (const field of SANITIZE_FIELDS) {
        if (typeof updates[field] === "string") {
          updates[field] = stripHtmlTags(updates[field] as string);
        }
      }

      await db.update(tenants).set(updates).where(eq(tenants.id, id));

      await logAdminAction(
        request.authUser.userId,
        "tenant_edit",
        id,
        { fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
        request.ip,
      );

      return reply.send({ success: true });
    },
  );

  /**
   * DELETE /admin/tenants/:id
   * Hard delete with confirmation (P1)
   */
  fastify.delete(
    "/:id",
    {
      preHandler: [requireAdminTier(["super_admin"])],
      schema: { params: adminIdParam, body: deleteTenantBody },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { confirmBusinessName } = request.body;

      const db = getDb();
      const tenant = await db
        .select({ businessName: tenants.businessName })
        .from(tenants)
        .where(eq(tenants.id, id))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }

      if (confirmBusinessName !== tenant.businessName) {
        return reply.status(400).send({
          message: "Business name confirmation does not match",
        });
      }

      await logAdminAction(
        request.authUser.userId,
        "tenant_delete",
        id,
        { businessName: tenant.businessName },
        request.ip,
      );

      await db.delete(tenants).where(eq(tenants.id, id));

      return reply.send({ success: true });
    },
  );

  /**
   * GET /admin/tenants/:id/analytics
   * Deep analysis — all metrics in one request.
   */
  fastify.get(
    "/:id/analytics",
    {
      preHandler: [requireAdmin],
      schema: { params: adminIdParam },
    },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      const tid = id;

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      const [
        customerCount,
        jobsByStatus,
        jobsByPriority,
        totalJobs,
        quotesByStatus,
        invoicesByStatus,
        bookingsByStatus,
        equipmentCount,
        catalogCount,
        lifetimeRevenue,
        outstandingBalance,
        revenueByMonth,
        paymentMethods,
        checklistStats,
        recentEvents,
      ] = await Promise.all([
        // Customers
        db.select({ count: count() }).from(customers)
          .where(eq(customers.tenantId, tid))
          .then((r) => Number(r[0]?.count ?? 0)),

        // Jobs by status
        db.select({ status: jobs.status, count: count() }).from(jobs)
          .where(eq(jobs.tenantId, tid))
          .groupBy(jobs.status),

        // Jobs by priority
        db.select({ priority: jobs.priority, count: count() }).from(jobs)
          .where(eq(jobs.tenantId, tid))
          .groupBy(jobs.priority),

        // Total jobs
        db.select({ count: count() }).from(jobs)
          .where(eq(jobs.tenantId, tid))
          .then((r) => Number(r[0]?.count ?? 0)),

        // Quotes by status
        db.select({ status: quotes.status, count: count() }).from(quotes)
          .where(eq(quotes.tenantId, tid))
          .groupBy(quotes.status),

        // Invoices by status
        db.select({ status: invoices.status, count: count() }).from(invoices)
          .where(eq(invoices.tenantId, tid))
          .groupBy(invoices.status),

        // Bookings by status
        db.select({ status: bookings.status, count: count() }).from(bookings)
          .where(eq(bookings.tenantId, tid))
          .groupBy(bookings.status),

        // Equipment
        db.select({ count: count() }).from(equipment)
          .where(eq(equipment.tenantId, tid))
          .then((r) => Number(r[0]?.count ?? 0)),

        // Catalog items (active)
        db.select({ count: count() }).from(catalogItems)
          .where(and(eq(catalogItems.tenantId, tid), eq(catalogItems.isActive, true)))
          .then((r) => Number(r[0]?.count ?? 0)),

        // Lifetime revenue (paid invoices)
        db.select({ total: sql<number>`COALESCE(SUM(${invoices.amountPaid}), 0)` })
          .from(invoices)
          .where(eq(invoices.tenantId, tid))
          .then((r) => Number(r[0]?.total ?? 0)),

        // Outstanding balance
        db.select({ total: sql<number>`COALESCE(SUM(${invoices.balanceDue}), 0)` })
          .from(invoices)
          .where(and(
            eq(invoices.tenantId, tid),
            sql`${invoices.status} NOT IN ('paid', 'void')`,
          ))
          .then((r) => Number(r[0]?.total ?? 0)),

        // Revenue by month (last 12 months from payments)
        db.select({
          month: sql<string>`TO_CHAR(${invoicePayments.paymentDate}, 'YYYY-MM')`,
          total: sql<number>`SUM(${invoicePayments.amount})`,
        })
          .from(invoicePayments)
          .where(and(
            eq(invoicePayments.tenantId, tid),
            sql`${invoicePayments.paymentDate} >= ${twelveMonthsAgo.toISOString()}`,
          ))
          .groupBy(sql`TO_CHAR(${invoicePayments.paymentDate}, 'YYYY-MM')`)
          .orderBy(sql`TO_CHAR(${invoicePayments.paymentDate}, 'YYYY-MM')`),

        // Payment method distribution
        db.select({
          method: invoicePayments.paymentMethod,
          count: count(),
          total: sql<number>`SUM(${invoicePayments.amount})`,
        })
          .from(invoicePayments)
          .where(eq(invoicePayments.tenantId, tid))
          .groupBy(invoicePayments.paymentMethod),

        // Checklist completion stats
        db.select({
          total: count(),
          completed: sql<number>`SUM(CASE WHEN ${jobChecklistCompletions.isCompleted} = true THEN 1 ELSE 0 END)`,
        })
          .from(jobChecklistCompletions)
          .where(eq(jobChecklistCompletions.tenantId, tid))
          .then((r) => ({
            total: Number(r[0]?.total ?? 0),
            completed: Number(r[0]?.completed ?? 0),
          })),

        // Recent platform events
        db.select()
          .from(platformEvents)
          .where(eq(platformEvents.tenantId, tid))
          .orderBy(desc(platformEvents.createdAt))
          .limit(30),
      ]);

      // Compute derived metrics
      const jobStatusMap = Object.fromEntries(
        jobsByStatus.map((r) => [r.status, Number(r.count)]),
      );
      const completedJobs = jobStatusMap["completed"] ?? 0;
      const jobCompletionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

      const quoteStatusMap = Object.fromEntries(
        quotesByStatus.map((r) => [r.status, Number(r.count)]),
      );
      const totalQuotes = Object.values(quoteStatusMap).reduce((s, v) => s + v, 0);
      const acceptedQuotes = quoteStatusMap["accepted"] ?? 0;
      const sentQuotes = (quoteStatusMap["sent"] ?? 0) + acceptedQuotes + (quoteStatusMap["declined"] ?? 0);
      const quoteAcceptanceRate = sentQuotes > 0 ? Math.round((acceptedQuotes / sentQuotes) * 100) : 0;

      const invoiceStatusMap = Object.fromEntries(
        invoicesByStatus.map((r) => [r.status, Number(r.count)]),
      );
      const totalInvoices = Object.values(invoiceStatusMap).reduce((s, v) => s + v, 0);

      const bookingStatusMap = Object.fromEntries(
        bookingsByStatus.map((r) => [r.status, Number(r.count)]),
      );
      const totalBookings = Object.values(bookingStatusMap).reduce((s, v) => s + v, 0);

      const checklistRate = checklistStats.total > 0
        ? Math.round((checklistStats.completed / checklistStats.total) * 100)
        : 0;

      const avgJobValue = totalJobs > 0 ? Math.round(lifetimeRevenue / totalJobs) : 0;

      return reply.send({
        data: {
          usage: {
            customers: customerCount,
            jobs: { total: totalJobs, byStatus: jobStatusMap, byPriority: Object.fromEntries(jobsByPriority.map((r) => [r.priority, Number(r.count)])) },
            quotes: { total: totalQuotes, byStatus: quoteStatusMap },
            invoices: { total: totalInvoices, byStatus: invoiceStatusMap },
            bookings: { total: totalBookings, byStatus: bookingStatusMap },
            equipment: equipmentCount,
            catalogItems: catalogCount,
          },
          financial: {
            lifetimeRevenue,
            outstandingBalance,
            revenueByMonth: revenueByMonth.map((r) => ({ month: r.month, total: Number(r.total) })),
            paymentMethods: paymentMethods.map((r) => ({ method: r.method, count: Number(r.count), total: Number(r.total) })),
            avgJobValue,
          },
          operational: {
            jobCompletionRate,
            quoteAcceptanceRate,
            checklistCompletionRate: checklistRate,
          },
          activity: recentEvents,
        },
      });
    },
  );
};
export default adminTenantRoutes;
