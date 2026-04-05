import type { FastifyInstance } from "fastify";
import {
  requireAdmin,
  requireAdminTier,
} from "../../lib/auth-middleware.js";
import {
  getDb,
  adminAuditLog,
  adminImpersonationSessions,
  platformEvents,
  tenants,
  user,
  eq,
  and,
  gte,
  lte,
  desc,
  count,
} from "@hvac-saas/database";
import {
  adminIdParam,
  auditLogQuery,
  impersonationLogQuery,
  tenantActivityQuery,
} from "../../lib/schemas/admin.js";

export default async function adminAuditRoutes(fastify: FastifyInstance) {
  /**
   * GET /admin/audit-log
   * Admin actions audit log with pagination and filters.
   */
  fastify.get(
    "/audit-log",
    {
      preHandler: [requireAdminTier(["super_admin", "support"])],
      schema: { querystring: auditLogQuery },
    },
    async (request, reply) => {
      const { page, limit, action, adminUserId } = request.query;

      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];
      if (action) conditions.push(eq(adminAuditLog.action, action));
      if (adminUserId)
        conditions.push(eq(adminAuditLog.adminUserId, adminUserId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: adminAuditLog.id,
            adminUserId: adminAuditLog.adminUserId,
            adminName: user.name,
            adminEmail: user.email,
            action: adminAuditLog.action,
            targetTenantId: adminAuditLog.targetTenantId,
            targetTenantName: tenants.businessName,
            metadata: adminAuditLog.metadata,
            ipAddress: adminAuditLog.ipAddress,
            createdAt: adminAuditLog.createdAt,
          })
          .from(adminAuditLog)
          .leftJoin(user, eq(user.id, adminAuditLog.adminUserId))
          .leftJoin(tenants, eq(tenants.id, adminAuditLog.targetTenantId))
          .where(where)
          .orderBy(desc(adminAuditLog.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(adminAuditLog)
          .where(where)
          .then((r) => r[0]),
      ]);

      return reply.send({
        data: rows,
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
   * GET /admin/impersonation-log
   * Impersonation session history.
   */
  fastify.get(
    "/impersonation-log",
    {
      preHandler: [requireAdminTier(["super_admin", "support"])],
      schema: { querystring: impersonationLogQuery },
    },
    async (request, reply) => {
      const { page, limit } = request.query;

      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const [rows, totalResult] = await Promise.all([
        db
          .select({
            id: adminImpersonationSessions.id,
            adminUserId: adminImpersonationSessions.adminUserId,
            adminName: user.name,
            tenantId: adminImpersonationSessions.tenantId,
            tenantName: tenants.businessName,
            reason: adminImpersonationSessions.reason,
            startedAt: adminImpersonationSessions.startedAt,
            endedAt: adminImpersonationSessions.endedAt,
            actionsTaken: adminImpersonationSessions.actionsTaken,
          })
          .from(adminImpersonationSessions)
          .leftJoin(user, eq(user.id, adminImpersonationSessions.adminUserId))
          .leftJoin(
            tenants,
            eq(tenants.id, adminImpersonationSessions.tenantId),
          )
          .orderBy(desc(adminImpersonationSessions.startedAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(adminImpersonationSessions)
          .then((r) => r[0]),
      ]);

      return reply.send({
        data: rows,
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
   * GET /admin/tenants/:id/activity
   * Platform events for a specific tenant.
   */
  fastify.get(
    "/tenants/:id/activity",
    {
      preHandler: [requireAdmin],
      schema: { params: adminIdParam, querystring: tenantActivityQuery },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { page, limit } = request.query;

      const db = getDb();
      const pageNum = page;
      const limitNum = limit;
      const offset = (pageNum - 1) * limitNum;

      const [rows, totalResult] = await Promise.all([
        db
          .select()
          .from(platformEvents)
          .where(eq(platformEvents.tenantId, id))
          .orderBy(desc(platformEvents.createdAt))
          .limit(limitNum)
          .offset(offset),
        db
          .select({ total: count() })
          .from(platformEvents)
          .where(eq(platformEvents.tenantId, id))
          .then((r) => r[0]),
      ]);

      return reply.send({
        data: rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalResult?.total ?? 0,
          totalPages: Math.ceil((totalResult?.total ?? 0) / limitNum),
        },
      });
    },
  );
}
