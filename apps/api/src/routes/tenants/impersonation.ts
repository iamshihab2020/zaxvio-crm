import type { FastifyInstance } from "fastify";
import {
  getDb,
  getSupabaseAdmin,
  tenants,
  adminImpersonationSessions,
  eq,
  and,
  sql,
} from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";

/** Broadcast a Supabase Realtime event on an impersonation channel */
async function broadcast(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  try {
    const supabase = getSupabaseAdmin();
    const channel = supabase.channel(`impersonation:${tenantId}`);
    await channel.send({ type: "broadcast", event, payload });
    await supabase.removeChannel(channel);
  } catch (err) {
    console.error("[impersonation] broadcast failed:", err);
  }
}

export default async function tenantImpersonationRoutes(
  fastify: FastifyInstance,
) {
  // ── POST /respond — Tenant accepts or rejects request ─────
  fastify.post<{
    Body: { sessionId: string; approved: boolean };
  }>(
    "/respond",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const { sessionId, approved } = request.body;

      if (!sessionId || typeof approved !== "boolean") {
        return reply
          .status(400)
          .send({ message: "sessionId and approved (boolean) are required" });
      }

      const db = getDb();

      // Find the pending visible session targeting this tenant
      const impSession = await db
        .select()
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(adminImpersonationSessions.id, sessionId),
            eq(
              adminImpersonationSessions.tenantId,
              request.authUser.tenantId!,
            ),
            eq(adminImpersonationSessions.mode, "visible"),
            eq(adminImpersonationSessions.status, "pending"),
          ),
        )
        .then((r) => r[0]);

      if (!impSession) {
        return reply
          .status(404)
          .send({ message: "Pending impersonation request not found" });
      }

      if (approved) {
        // Set active + reset startedAt so the 2h timer starts from approval
        await db
          .update(adminImpersonationSessions)
          .set({ status: "active", startedAt: new Date() })
          .where(eq(adminImpersonationSessions.id, sessionId));
      } else {
        await db
          .update(adminImpersonationSessions)
          .set({ status: "rejected", endedAt: new Date() })
          .where(eq(adminImpersonationSessions.id, sessionId));
      }

      // Broadcast response back to admin
      await broadcast(impSession.tenantId, "response", {
        sessionId,
        approved,
      });

      return reply.send({ success: true });
    },
  );

  // ── GET /pending — Check for pending requests (page-load recovery)
  fastify.get(
    "/pending",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const db = getDb();

      const pending = await db
        .select({
          id: adminImpersonationSessions.id,
          adminName: adminImpersonationSessions.adminName,
          reason: adminImpersonationSessions.reason,
          startedAt: adminImpersonationSessions.startedAt,
        })
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(
              adminImpersonationSessions.tenantId,
              request.authUser.tenantId!,
            ),
            eq(adminImpersonationSessions.mode, "visible"),
            eq(adminImpersonationSessions.status, "pending"),
          ),
        )
        .then((r) => r[0]);

      if (!pending) {
        return reply.send({ pending: false, request: null });
      }

      // Auto-expire if older than 5 minutes
      const elapsed =
        Date.now() - new Date(pending.startedAt).getTime();
      if (elapsed > 5 * 60 * 1000) {
        await db
          .update(adminImpersonationSessions)
          .set({ status: "expired", endedAt: new Date() })
          .where(eq(adminImpersonationSessions.id, pending.id));
        return reply.send({ pending: false, request: null });
      }

      return reply.send({
        pending: true,
        request: {
          sessionId: pending.id,
          adminName: pending.adminName ?? "Admin",
          reason: pending.reason,
        },
      });
    },
  );

  // ── GET /active-viewer — Check if admin is viewing (visible mode)
  fastify.get(
    "/active-viewer",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const db = getDb();

      const activeSession = await db
        .select({
          id: adminImpersonationSessions.id,
          adminName: adminImpersonationSessions.adminName,
          startedAt: adminImpersonationSessions.startedAt,
        })
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(
              adminImpersonationSessions.tenantId,
              request.authUser.tenantId!,
            ),
            eq(adminImpersonationSessions.mode, "visible"),
            eq(adminImpersonationSessions.status, "active"),
            sql`${adminImpersonationSessions.endedAt} IS NULL`,
          ),
        )
        .then((r) => r[0]);

      if (!activeSession) {
        return reply.send({ active: false, viewer: null });
      }

      return reply.send({
        active: true,
        viewer: {
          sessionId: activeSession.id,
          adminName: activeSession.adminName ?? "Admin",
        },
      });
    },
  );
}
