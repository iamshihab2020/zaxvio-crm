import type { FastifyInstance } from "fastify";
import { requireAdminTier } from "../../lib/auth-middleware.js";
import { logAdminAction } from "../../lib/admin-audit.js";
import { auth } from "../../lib/auth.js";
import { getDb, user, eq, desc } from "@hvac-saas/database";

const VALID_TIERS = ["super_admin", "support", "billing_admin"] as const;

export default async function adminAdminsRoutes(fastify: FastifyInstance) {
  /**
   * GET /admin/admins
   * List all admin users.
   */
  fastify.get(
    "/",
    { preHandler: [requireAdminTier(["super_admin"])] },
    async (request, reply) => {
      const db = getDb();

      const admins = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          adminTier: user.adminTier,
          isOwner: user.isOwner,
          createdAt: user.createdAt,
        })
        .from(user)
        .where(eq(user.role, "admin"))
        .orderBy(desc(user.isOwner), desc(user.createdAt));

      return reply.send({ data: admins });
    },
  );

  /**
   * POST /admin/admins
   * Create a new admin user.
   */
  fastify.post(
    "/",
    { preHandler: [requireAdminTier(["super_admin"])] },
    async (request, reply) => {
      const { name, email, password, adminTier, makeOwner } = request.body as {
        name?: string;
        email?: string;
        password?: string;
        adminTier?: string;
        makeOwner?: boolean;
      };

      // Validation
      if (!name || !name.trim()) {
        return reply.status(400).send({ message: "Name is required" });
      }
      if (!email || !email.includes("@")) {
        return reply.status(400).send({ message: "Valid email is required" });
      }
      if (!password || password.length < 8) {
        return reply
          .status(400)
          .send({ message: "Password must be at least 8 characters" });
      }
      if (!adminTier || !VALID_TIERS.includes(adminTier as (typeof VALID_TIERS)[number])) {
        return reply.status(400).send({
          message: `adminTier must be one of: ${VALID_TIERS.join(", ")}`,
        });
      }

      // Only owner can create super_admin users or make owners
      if (adminTier === "super_admin" && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only an owner can create super_admin accounts" });
      }
      if (makeOwner && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only an owner can grant owner status" });
      }

      // Create user via Better Auth
      let newUserId: string;
      try {
        const result = await auth.api.signUpEmail({
          body: { name: name.trim(), email: email.trim().toLowerCase(), password },
        });

        if (!result?.user?.id) {
          return reply.status(500).send({ message: "Failed to create user" });
        }
        newUserId = result.user.id;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("already") || message.includes("exists")) {
          return reply
            .status(409)
            .send({ message: "A user with this email already exists" });
        }
        throw err;
      }

      // Set admin role + tier + optional owner
      const db = getDb();
      const updateData: Record<string, unknown> = {
        role: "admin",
        adminTier: adminTier as (typeof VALID_TIERS)[number],
      };
      if (makeOwner) {
        updateData.isOwner = true;
        // Owner must be super_admin
        updateData.adminTier = "super_admin";
      }
      await db
        .update(user)
        .set(updateData)
        .where(eq(user.id, newUserId));

      await logAdminAction(
        request.authUser.userId,
        "admin_create",
        null,
        { targetUserId: newUserId, email: email.trim().toLowerCase(), adminTier: makeOwner ? "super_admin" : adminTier, isOwner: !!makeOwner },
        request.ip,
      );

      return reply.status(201).send({
        data: { id: newUserId, name: name.trim(), email: email.trim().toLowerCase(), adminTier },
      });
    },
  );

  /**
   * PATCH /admin/admins/:id
   * Update an admin's tier.
   */
  fastify.patch(
    "/:id",
    { preHandler: [requireAdminTier(["super_admin"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { adminTier, makeOwner } = request.body as { adminTier?: string; makeOwner?: boolean };

      if (!adminTier || !VALID_TIERS.includes(adminTier as (typeof VALID_TIERS)[number])) {
        return reply.status(400).send({
          message: `adminTier must be one of: ${VALID_TIERS.join(", ")}`,
        });
      }

      // Self-edit prevention
      if (id === request.authUser.userId) {
        return reply
          .status(400)
          .send({ message: "Cannot change your own admin tier" });
      }

      const db = getDb();
      const target = await db
        .select({
          id: user.id,
          adminTier: user.adminTier,
          isOwner: user.isOwner,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, id))
        .then((r) => r[0]);

      if (!target || target.role !== "admin") {
        return reply.status(404).send({ message: "Admin user not found" });
      }

      // Owner protection — no one can demote/change an owner
      if (target.isOwner) {
        return reply
          .status(403)
          .send({ message: "Cannot modify an owner account" });
      }

      // Only owner can modify super_admin users
      if (target.adminTier === "super_admin" && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only an owner can modify super_admin accounts" });
      }

      // Only owner can promote to super_admin or grant owner
      if (adminTier === "super_admin" && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only an owner can promote to super_admin" });
      }
      if (makeOwner && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only an owner can grant owner status" });
      }

      const oldTier = target.adminTier;
      const updateData: Record<string, unknown> = {
        adminTier: adminTier as (typeof VALID_TIERS)[number],
      };
      if (makeOwner) {
        updateData.isOwner = true;
        updateData.adminTier = "super_admin";
      }
      await db
        .update(user)
        .set(updateData)
        .where(eq(user.id, id));

      await logAdminAction(
        request.authUser.userId,
        "admin_update_tier",
        null,
        { targetUserId: id, oldTier, newTier: makeOwner ? "super_admin" : adminTier, madeOwner: !!makeOwner },
        request.ip,
      );

      return reply.send({ data: { id, adminTier: makeOwner ? "super_admin" : adminTier, isOwner: !!makeOwner } });
    },
  );

  /**
   * DELETE /admin/admins/:id
   * Remove admin access (soft — sets role to 'user', clears tier).
   */
  fastify.delete(
    "/:id",
    { preHandler: [requireAdminTier(["super_admin"])] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Self-delete prevention
      if (id === request.authUser.userId) {
        return reply
          .status(400)
          .send({ message: "Cannot remove your own admin access" });
      }

      const db = getDb();
      const target = await db
        .select({
          id: user.id,
          email: user.email,
          adminTier: user.adminTier,
          isOwner: user.isOwner,
          role: user.role,
        })
        .from(user)
        .where(eq(user.id, id))
        .then((r) => r[0]);

      if (!target || target.role !== "admin") {
        return reply.status(404).send({ message: "Admin user not found" });
      }

      // Owner protection
      if (target.isOwner) {
        return reply
          .status(403)
          .send({ message: "Cannot remove the owner account" });
      }

      // Only owner can remove super_admin users
      if (target.adminTier === "super_admin" && !request.authUser.isOwner) {
        return reply
          .status(403)
          .send({ message: "Only the owner can remove super_admin accounts" });
      }

      await db
        .update(user)
        .set({ role: "user", adminTier: null })
        .where(eq(user.id, id));

      await logAdminAction(
        request.authUser.userId,
        "admin_remove",
        null,
        { targetUserId: id, email: target.email, removedTier: target.adminTier },
        request.ip,
      );

      return reply.send({ data: { success: true } });
    },
  );
}
