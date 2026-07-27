import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { publish } from "../../lib/event-bus.js";
import {
  getDb,
  tenants,
  member,
  adminImpersonationSessions,
  eq,
  and,
  sql,
  asc,
} from "@hvac-saas/database";
import { requireAdmin, requireAdminTier } from "../../lib/auth-middleware.js";
import { logAdminAction } from "../../lib/admin-audit.js";
import {
  startImpersonationBody,
  endImpersonationBody,
  cancelImpersonationBody,
} from "../../lib/schemas/admin.js";

const IMPERSONATION_MAX_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Broadcast an SSE event on a tenant's impersonation channel */
async function broadcast(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    publish(tenantId, "impersonation", event, payload);
  } catch (err) {
    console.error("[impersonation] broadcast failed:", err);
  }
}

const impersonationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ── POST /start — Begin ghost impersonation ───────────────
  fastify.post(
    "/start",
    {
      preHandler: [requireAdminTier(["super_admin", "support"])],
      schema: { body: startImpersonationBody },
    },
    async (request, reply) => {
      const { tenantId, reason } = request.body;

      const db = getDb();

      // 1. Validate tenant exists and is active
      const tenant = await db
        .select({
          id: tenants.id,
          organizationId: tenants.organizationId,
          businessName: tenants.businessName,
          isActive: tenants.isActive,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }
      if (!tenant.isActive) {
        return reply
          .status(400)
          .send({ message: "Cannot impersonate an inactive tenant" });
      }

      // 2. Find the first member (owner) of the tenant's organization
      const firstMember = await db
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, tenant.organizationId))
        .orderBy(asc(member.createdAt))
        .limit(1)
        .then((r) => r[0]);

      if (!firstMember) {
        return reply
          .status(400)
          .send({ message: "Tenant has no members" });
      }

      // 3. Auto-end any existing active impersonation session for this admin
      await db
        .update(adminImpersonationSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(
              adminImpersonationSessions.adminUserId,
              request.authUser.userId,
            ),
            sql`${adminImpersonationSessions.endedAt} IS NULL`,
          ),
        );

      // 4. Create new ghost impersonation session
      const now = new Date();
      const expiresAt = new Date(now.getTime() + IMPERSONATION_MAX_MS);

      const [session] = await db
        .insert(adminImpersonationSessions)
        .values({
          adminUserId: request.authUser.userId,
          tenantId,
          tenantUserId: firstMember.userId,
          reason: reason.trim(),
          mode: "ghost",
          status: "active",
          adminName: request.authUser.name,
          startedAt: now,
        })
        .returning();

      // 5. Log audit action
      await logAdminAction(
        request.authUser.userId,
        "impersonate_start",
        tenantId,
        {
          reason: reason.trim(),
          tenantUserId: firstMember.userId,
          tenantName: tenant.businessName,
          mode: "ghost",
        },
        request.ip,
      );

      return reply.send({
        sessionId: session.id,
        tenantId,
        tenantUserId: firstMember.userId,
        tenantName: tenant.businessName,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );

  // ── POST /request — Request visible impersonation ─────────
  fastify.post(
    "/request",
    {
      preHandler: [requireAdminTier(["super_admin", "support"])],
      schema: { body: startImpersonationBody },
    },
    async (request, reply) => {
      const { tenantId, reason } = request.body;

      const db = getDb();

      // 1. Validate tenant
      const tenant = await db
        .select({
          id: tenants.id,
          organizationId: tenants.organizationId,
          businessName: tenants.businessName,
          isActive: tenants.isActive,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .then((r) => r[0]);

      if (!tenant) {
        return reply.status(404).send({ message: "Tenant not found" });
      }
      if (!tenant.isActive) {
        return reply
          .status(400)
          .send({ message: "Cannot impersonate an inactive tenant" });
      }

      // 2. Find first member
      const firstMember = await db
        .select({ userId: member.userId })
        .from(member)
        .where(eq(member.organizationId, tenant.organizationId))
        .orderBy(asc(member.createdAt))
        .limit(1)
        .then((r) => r[0]);

      if (!firstMember) {
        return reply.status(400).send({ message: "Tenant has no members" });
      }

      // 3. Auto-end any existing session for this admin
      await db
        .update(adminImpersonationSessions)
        .set({ endedAt: new Date() })
        .where(
          and(
            eq(
              adminImpersonationSessions.adminUserId,
              request.authUser.userId,
            ),
            sql`${adminImpersonationSessions.endedAt} IS NULL`,
          ),
        );

      // 4. Create pending visible session
      const [session] = await db
        .insert(adminImpersonationSessions)
        .values({
          adminUserId: request.authUser.userId,
          tenantId,
          tenantUserId: firstMember.userId,
          reason: reason.trim(),
          mode: "visible",
          status: "pending",
          adminName: request.authUser.name,
        })
        .returning();

      // 5. Broadcast request to tenant
      await broadcast(tenantId, "request", {
        sessionId: session.id,
        adminName: request.authUser.name,
        reason: reason.trim(),
      });

      // 6. Log audit
      await logAdminAction(
        request.authUser.userId,
        "impersonate_start",
        tenantId,
        {
          reason: reason.trim(),
          tenantUserId: firstMember.userId,
          tenantName: tenant.businessName,
          mode: "visible",
          status: "pending",
        },
        request.ip,
      );

      return reply.send({
        sessionId: session.id,
        status: "pending",
      });
    },
  );

  // ── POST /end — End impersonation ─────────────────────────
  fastify.post(
    "/end",
    {
      preHandler: [requireAdmin],
      schema: { body: endImpersonationBody },
    },
    async (request, reply) => {
      const { sessionId } = request.body;

      const db = getDb();

      const impSession = await db
        .select()
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(adminImpersonationSessions.id, sessionId),
            eq(
              adminImpersonationSessions.adminUserId,
              request.authUser.userId,
            ),
            sql`${adminImpersonationSessions.endedAt} IS NULL`,
          ),
        )
        .then((r) => r[0]);

      if (!impSession) {
        return reply
          .status(404)
          .send({ message: "Active impersonation session not found" });
      }

      const now = new Date();
      await db
        .update(adminImpersonationSessions)
        .set({ endedAt: now, status: "active" })
        .where(eq(adminImpersonationSessions.id, sessionId));

      const durationMs =
        now.getTime() - new Date(impSession.startedAt).getTime();

      await logAdminAction(
        request.authUser.userId,
        "impersonate_end",
        impSession.tenantId,
        {
          sessionId,
          durationMs,
          durationMinutes: Math.round(durationMs / 60000),
          mode: impSession.mode,
        },
        request.ip,
      );

      // Broadcast exit event for visible impersonation so tenant gets notified
      if (impSession.mode === "visible") {
        await broadcast(impSession.tenantId, "exit", { sessionId });
      }

      return reply.send({
        success: true,
        tenantId: impSession.tenantId,
      });
    },
  );

  // ── POST /cancel — Cancel a pending request ───────────────
  fastify.post(
    "/cancel",
    {
      preHandler: [requireAdmin],
      schema: { body: cancelImpersonationBody },
    },
    async (request, reply) => {
      const { sessionId } = request.body;

      const db = getDb();

      const impSession = await db
        .select()
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(adminImpersonationSessions.id, sessionId),
            eq(
              adminImpersonationSessions.adminUserId,
              request.authUser.userId,
            ),
            eq(adminImpersonationSessions.status, "pending"),
          ),
        )
        .then((r) => r[0]);

      if (!impSession) {
        return reply
          .status(404)
          .send({ message: "Pending session not found" });
      }

      await db
        .update(adminImpersonationSessions)
        .set({ endedAt: new Date(), status: "expired" })
        .where(eq(adminImpersonationSessions.id, sessionId));

      // Broadcast cancel so tenant dialog closes
      await broadcast(impSession.tenantId, "cancel", { sessionId });

      return reply.send({ success: true });
    },
  );

  // ── GET /active — Check for active impersonation session ──
  fastify.get(
    "/active",
    { preHandler: [requireAdmin] },
    async (request, reply) => {
      const db = getDb();

      const impSession = await db
        .select({
          id: adminImpersonationSessions.id,
          tenantId: adminImpersonationSessions.tenantId,
          tenantUserId: adminImpersonationSessions.tenantUserId,
          reason: adminImpersonationSessions.reason,
          mode: adminImpersonationSessions.mode,
          startedAt: adminImpersonationSessions.startedAt,
        })
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(
              adminImpersonationSessions.adminUserId,
              request.authUser.userId,
            ),
            sql`${adminImpersonationSessions.endedAt} IS NULL`,
            eq(adminImpersonationSessions.status, "active"),
          ),
        )
        .then((r) => r[0]);

      if (!impSession) {
        return reply.send({ active: false, session: null });
      }

      // Check if expired
      const elapsed =
        Date.now() - new Date(impSession.startedAt).getTime();
      if (elapsed > IMPERSONATION_MAX_MS) {
        await db
          .update(adminImpersonationSessions)
          .set({ endedAt: new Date() })
          .where(eq(adminImpersonationSessions.id, impSession.id));
        return reply.send({ active: false, session: null });
      }

      // Get tenant name
      const tenant = await db
        .select({ businessName: tenants.businessName })
        .from(tenants)
        .where(eq(tenants.id, impSession.tenantId))
        .then((r) => r[0]);

      const expiresAt = new Date(
        new Date(impSession.startedAt).getTime() + IMPERSONATION_MAX_MS,
      );

      return reply.send({
        active: true,
        session: {
          id: impSession.id,
          tenantId: impSession.tenantId,
          tenantName: tenant?.businessName ?? "Unknown",
          reason: impSession.reason,
          mode: impSession.mode,
          startedAt: impSession.startedAt,
          expiresAt: expiresAt.toISOString(),
        },
      });
    },
  );
};
export default impersonationRoutes;
