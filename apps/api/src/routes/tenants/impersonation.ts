import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  getDb,
  adminImpersonationSessions,
  eq,
  and,
  sql,
} from "@hvac-saas/database";
import { requireTenant } from "../../lib/auth-middleware.js";
import { publish } from "../../lib/event-bus.js";
import { respondImpersonationBody } from "../../lib/schemas/admin.js";
import { canGrantSupportAccess, resolveOrgRole } from "../../lib/tenant-guards.js";

/** How long a visible-mode request can wait for an answer. */
const REQUEST_TTL_MS = 5 * 60 * 1000;

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

const tenantImpersonationRoutes: FastifyPluginAsyncZod = async (fastify) => {
  // ── POST /respond — Tenant accepts or rejects request ─────
  fastify.post(
    "/respond",
    {
      preHandler: [requireTenant],
      schema: { body: respondImpersonationBody },
    },
    async (request, reply) => {
      const { sessionId, approved } = request.body;
      const tenantId = request.authUser.tenantId!;

      // An admin already inside this workspace cannot answer for it. Without
      // this, an admin holding a ghost session could approve their own
      // visible-mode request — the one form of access the tenant is meant to
      // see and decide on.
      if (request.authUser.isImpersonating) {
        return reply
          .status(403)
          .send({ message: "Support access can only be granted by the business itself." });
      }

      const db = getDb();

      // Owner or admin only (ONB-08). Resolved against THIS tenant's
      // organisation rather than the session's active one, which is the
      // question being asked: may this person decide for this workspace.
      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      if (!canGrantSupportAccess(role)) {
        return reply.status(403).send({
          message: "Only the workspace owner or an admin can answer a support access request.",
        });
      }

      // Find the pending visible session targeting this tenant
      const impSession = await db
        .select()
        .from(adminImpersonationSessions)
        .where(
          and(
            eq(adminImpersonationSessions.id, sessionId),
            eq(adminImpersonationSessions.tenantId, tenantId),
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

      // The same five minutes `/pending` enforces. Before, a request nobody had
      // answered stayed approvable for as long as the row existed — `/pending`
      // stopped showing it, but a dialog left open on another tab still worked.
      if (Date.now() - new Date(impSession.startedAt).getTime() > REQUEST_TTL_MS) {
        await db
          .update(adminImpersonationSessions)
          .set({ status: "expired", endedAt: new Date() })
          .where(
            and(
              eq(adminImpersonationSessions.id, sessionId),
              eq(adminImpersonationSessions.status, "pending"),
            ),
          );
        return reply
          .status(404)
          .send({ message: "This request has expired. Ask support to send a new one." });
      }

      // Compare-and-set on `pending`. The admin can cancel between the read
      // above and this write; an unconditional update would then resurrect a
      // cancelled request as `active`.
      const updated = await db
        .update(adminImpersonationSessions)
        .set(
          approved
            ? // Reset startedAt so the 2h timer starts from approval
              { status: "active", startedAt: new Date() }
            : { status: "rejected", endedAt: new Date() },
        )
        .where(
          and(
            eq(adminImpersonationSessions.id, sessionId),
            eq(adminImpersonationSessions.tenantId, tenantId),
            eq(adminImpersonationSessions.status, "pending"),
          ),
        )
        .returning({ id: adminImpersonationSessions.id });

      if (updated.length === 0) {
        return reply
          .status(404)
          .send({ message: "Pending impersonation request not found" });
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
  //
  // Answers `pending: false` to anyone who could not respond, so the dialog
  // only ever opens for somebody whose answer counts. The SSE `request` event
  // still reaches every tab in the workspace; the listener re-asks here rather
  // than trusting it.
  fastify.get(
    "/pending",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      if (request.authUser.isImpersonating) {
        return reply.send({ pending: false, request: null });
      }

      const db = getDb();
      const tenantId = request.authUser.tenantId!;

      const role = await resolveOrgRole(db, tenantId, request.authUser.userId);
      if (!canGrantSupportAccess(role)) {
        return reply.send({ pending: false, request: null });
      }

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
            eq(adminImpersonationSessions.tenantId, tenantId),
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
      if (elapsed > REQUEST_TTL_MS) {
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
};
export default tenantImpersonationRoutes;
