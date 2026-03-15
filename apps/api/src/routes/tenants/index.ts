import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../lib/auth-middleware.js";
import {
  getDb,
  tenants,
  tenantSubscriptions,
  user,
  organization,
  eq,
} from "@hvac-saas/database";

export default async function tenantRoutes(fastify: FastifyInstance) {
  /**
   * POST /tenants/initialize
   *
   * Idempotent endpoint to create a tenant + subscription for the
   * caller's active organization. Handles the edge case of orgs
   * created before the databaseHook was added.
   */
  fastify.post(
    "/initialize",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { activeOrganizationId, userId } = request.authUser;

      if (!activeOrganizationId) {
        return reply
          .status(400)
          .send({ message: "No active organization in session" });
      }

      const db = getDb();

      // Check if tenant already exists (idempotent)
      const existing = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.organizationId, activeOrganizationId))
        .then((r) => r[0]);

      if (existing) {
        return reply
          .status(200)
          .send({ message: "Tenant already exists", tenantId: existing.id });
      }

      // Fetch org + user details
      const [org, creator] = await Promise.all([
        db
          .select()
          .from(organization)
          .where(eq(organization.id, activeOrganizationId))
          .then((r) => r[0]),
        db
          .select()
          .from(user)
          .where(eq(user.id, userId))
          .then((r) => r[0]),
      ]);

      if (!org) {
        return reply.status(404).send({ message: "Organization not found" });
      }

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const [tenant] = await db
        .insert(tenants)
        .values({
          organizationId: org.id,
          businessName: org.name,
          ownerName: creator?.name ?? "Owner",
          email: creator?.email ?? "",
          slug: org.slug ?? org.id,
          trialEndsAt,
        })
        .returning();

      await db.insert(tenantSubscriptions).values({
        tenantId: tenant.id,
        status: "trialing",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      });

      return reply
        .status(201)
        .send({ message: "Tenant created", tenantId: tenant.id });
    },
  );
}
