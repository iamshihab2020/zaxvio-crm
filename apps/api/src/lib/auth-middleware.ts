import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";
import {
  getDb,
  tenants,
  user,
  member,
  adminImpersonationSessions,
  eq,
  and,
  inArray,
  sql,
} from "@hvac-saas/database";

export type AdminTier = "super_admin" | "support" | "billing_admin";

/** Mirrors the `tenants.timezone` column default. Used until a tenant is resolved. */
export const DEFAULT_TENANT_TIMEZONE = "America/Chicago";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string | null;
  adminTier: AdminTier | null;
  isOwner: boolean;
  activeOrganizationId: string | null;
  tenantId: string | null;
  /** IANA timezone for the resolved tenant. Drives every "today" boundary in analytics. */
  tenantTimezone: string;
  orgRole: string | null;
  isImpersonating: boolean;
  impersonationSessionId: string | null;
}

/** Parse a single cookie value from the raw Cookie header */
function parseCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  request.authUser = {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role ?? null,
    adminTier: null,
    isOwner: false,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
    tenantId: null,
    tenantTimezone: DEFAULT_TENANT_TIMEZONE,
    orgRole: null,
    isImpersonating: false,
    impersonationSessionId: null,
  };
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.authUser.role !== "admin") {
    return reply.status(403).send({ message: "Forbidden: admin role required" });
  }

  // Fetch admin tier + owner status from DB
  const db = getDb();
  const row = await db
    .select({ adminTier: user.adminTier, isOwner: user.isOwner })
    .from(user)
    .where(eq(user.id, request.authUser.userId))
    .then((r) => r[0]);

  request.authUser.adminTier = (row?.adminTier as AdminTier) ?? null;
  request.authUser.isOwner = row?.isOwner ?? false;
}

/**
 * Factory to create middleware that requires specific admin tiers.
 * Usage: `{ preHandler: [requireAdminTier(["super_admin", "support"])] }`
 */
export function requireAdminTier(allowedTiers: AdminTier[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    await requireAdmin(request, reply);
    if (reply.sent) return;

    const tier = request.authUser.adminTier;
    if (!tier || !allowedTiers.includes(tier)) {
      return reply.status(403).send({
        message: `Forbidden: requires one of [${allowedTiers.join(", ")}]`,
      });
    }
  };
}

const IMPERSONATION_MAX_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * May this admin open another tenant's event stream (`GET /events?tenantId=`)?
 *
 * The only caller that needs to is the superadmin impersonation dialog, waiting
 * for the tenant's answer to a visible-mode request it has just sent. Until
 * ONB-09 the check was `role === "admin"` and nothing else, so any tier —
 * `billing_admin` included, who cannot request access at all — could watch any
 * tenant's live notifications, conversations and job updates indefinitely, with
 * no reason given and nothing in `admin_audit_log`.
 *
 * Now the stream is tied to a request: the admin must be a tier that can make
 * one, and must have an open visible-mode session on that tenant. That request
 * is already audited (`impersonate_start`, with its reason), so the stream does
 * not need an audit row of its own — it can only exist inside one. The route
 * also narrows it to the `impersonation` channel, which is all the dialog reads.
 */
export async function canWatchTenantStream(
  authUser: AuthUser,
  tenantId: string,
): Promise<boolean> {
  if (authUser.role !== "admin") return false;

  const db = getDb();
  const [admin] = await db
    .select({ adminTier: user.adminTier })
    .from(user)
    .where(eq(user.id, authUser.userId));
  const tier = admin?.adminTier as AdminTier | null | undefined;
  if (tier !== "super_admin" && tier !== "support") return false;

  const [session] = await db
    .select({ id: adminImpersonationSessions.id })
    .from(adminImpersonationSessions)
    .where(
      and(
        eq(adminImpersonationSessions.adminUserId, authUser.userId),
        eq(adminImpersonationSessions.tenantId, tenantId),
        eq(adminImpersonationSessions.mode, "visible"),
        // `active` as well as `pending`: EventSource reconnects on its own, and
        // a reconnect landing just after approval must not 403 the dialog that
        // is about to read the approval.
        inArray(adminImpersonationSessions.status, ["pending", "active"]),
        sql`${adminImpersonationSessions.endedAt} IS NULL`,
      ),
    );
  return session !== undefined;
}

export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  // Check for impersonation cookie — admin impersonating a tenant
  const impersonationId = parseCookie(
    request.headers.cookie as string | undefined,
    "x-impersonation-id",
  );

  if (impersonationId && request.authUser.role === "admin") {
    const db = getDb();
    const impSession = await db
      .select()
      .from(adminImpersonationSessions)
      .where(
        and(
          eq(adminImpersonationSessions.id, impersonationId),
          eq(
            adminImpersonationSessions.adminUserId,
            request.authUser.userId,
          ),
          sql`${adminImpersonationSessions.endedAt} IS NULL`,
          // `active` only. A visible-mode request is inserted `pending` with
          // `ended_at` NULL, and before this line it passed every check above —
          // so the admin who asked could set the cookie to the new session id
          // and walk into the tenant before the tenant had answered, or after
          // ignoring the dialog (ONB-08). Approval is the only thing that sets
          // `active` on a visible session; ghost sessions are created `active`.
          eq(adminImpersonationSessions.status, "active"),
        ),
      )
      .then((r) => r[0]);

    if (!impSession) {
      return reply
        .status(403)
        .send({ message: "Impersonation session not found or already ended" });
    }

    // Check 2-hour expiry
    const elapsed =
      Date.now() - new Date(impSession.startedAt).getTime();
    if (elapsed > IMPERSONATION_MAX_MS) {
      // Auto-end expired session
      await db
        .update(adminImpersonationSessions)
        .set({ endedAt: new Date() })
        .where(eq(adminImpersonationSessions.id, impersonationId));
      return reply
        .status(403)
        .send({ message: "Impersonation session expired" });
    }

    // Inject tenant context from impersonation session
    const impTenant = await db
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, impSession.tenantId))
      .then((r) => r[0]);

    request.authUser.tenantId = impSession.tenantId;
    request.authUser.tenantTimezone =
      impTenant?.timezone ?? DEFAULT_TENANT_TIMEZONE;
    request.authUser.isImpersonating = true;
    request.authUser.impersonationSessionId = impersonationId;
    return;
  }

  // Normal tenant resolution
  const orgId = request.authUser.activeOrganizationId;
  if (!orgId) {
    return reply
      .status(403)
      .send({ message: "Forbidden: no active organization" });
  }

  const db = getDb();
  const tenant = await db
    .select({ id: tenants.id, timezone: tenants.timezone })
    .from(tenants)
    .where(eq(tenants.organizationId, orgId))
    .then((r) => r[0]);

  if (!tenant) {
    return reply
      .status(403)
      .send({ message: "Tenant not initialized. Call POST /tenants/initialize first." });
  }

  request.authUser.tenantId = tenant.id;
  request.authUser.tenantTimezone = tenant.timezone ?? DEFAULT_TENANT_TIMEZONE;
}

/**
 * Factory to create middleware that requires specific organization-level roles.
 * Must be used after requireTenant (which resolves activeOrganizationId).
 * Usage: `{ preHandler: [requireOrgRole(["owner", "admin"])] }`
 */
export function requireOrgRole(allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    await requireTenant(request, reply);
    if (reply.sent) return;

    const orgId = request.authUser.activeOrganizationId;
    if (!orgId) {
      return reply.status(403).send({ message: "Forbidden: no active organization" });
    }

    const db = getDb();
    const memberRow = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, request.authUser.userId),
          eq(member.organizationId, orgId),
        ),
      )
      .then((r) => r[0]);

    if (!memberRow || !allowedRoles.includes(memberRow.role)) {
      return reply.status(403).send({
        message: `Forbidden: requires one of [${allowedRoles.join(", ")}]`,
      });
    }

    request.authUser.orgRole = memberRow.role;
  };
}
