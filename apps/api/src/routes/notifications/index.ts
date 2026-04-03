import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  notificationReads,
  notificationChannelConfig,
  eq,
  and,
  sql,
} from "@hvac-saas/database";
import {
  getNotifications,
  getUnreadCount,
} from "../../services/notifications.service.js";

export default async function notificationRoutes(fastify: FastifyInstance) {
  /**
   * GET /notifications
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query.limit ?? "20", 10) || 20, 50);

      const db = getDb();
      const result = await getNotifications(db, tenantId, userId, limit, query.cursor);
      return reply.send(result);
    },
  );

  /**
   * GET /notifications/unread-count
   */
  fastify.get(
    "/unread-count",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const db = getDb();

      const count = await getUnreadCount(db, tenantId, userId);
      return reply.send({ count });
    },
  );

  /**
   * PATCH /notifications/:id/read
   * Mark a single notification as read for the current user.
   */
  fastify.patch(
    "/:id/read",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const userId = request.authUser.userId;
      const { id } = request.params as { id: string };

      const db = getDb();

      await db
        .insert(notificationReads)
        .values({
          notificationId: id,
          userId,
        })
        .onConflictDoNothing();

      return reply.send({ success: true });
    },
  );

  /**
   * PATCH /notifications/read-all
   * Mark all unread notifications as read for the current user.
   */
  fastify.patch(
    "/read-all",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;

      const db = getDb();

      await db.execute(sql`
        INSERT INTO "notification_reads" ("notification_id", "user_id")
        SELECT n."id", ${userId}
        FROM "notifications" n
        LEFT JOIN "notification_reads" nr
          ON nr."notification_id" = n."id" AND nr."user_id" = ${userId}
        WHERE n."tenant_id" = ${tenantId}
          AND (n."actor_id" IS NULL OR n."actor_id" != ${userId})
          AND nr."id" IS NULL
        ON CONFLICT DO NOTHING
      `);

      return reply.send({ success: true });
    },
  );

  /**
   * GET /notifications/preferences
   * Get channel preferences for the current user (all notification types).
   */
  fastify.get(
    "/preferences",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;

      const db = getDb();

      const configs = await db
        .select()
        .from(notificationChannelConfig)
        .where(
          and(
            eq(notificationChannelConfig.tenantId, tenantId),
            eq(notificationChannelConfig.userId, userId),
          ),
        );

      return reply.send({ data: configs });
    },
  );

  /**
   * PATCH /notifications/preferences
   * Update channel preferences for the current user.
   * Body: { preferences: [{ type, inApp, email, sms, voice }] }
   */
  fastify.patch(
    "/preferences",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const body = request.body as {
        preferences: Array<{
          type: string;
          inApp: boolean;
          email: boolean;
          sms: boolean;
          voice: boolean;
        }>;
      };

      if (!body.preferences || !Array.isArray(body.preferences)) {
        return reply
          .status(400)
          .send({ message: "preferences array is required" });
      }

      const db = getDb();

      // Upsert each preference
      for (const pref of body.preferences) {
        await db
          .insert(notificationChannelConfig)
          .values({
            tenantId,
            userId,
            notificationType: pref.type as typeof notificationChannelConfig.$inferInsert.notificationType,
            inApp: pref.inApp,
            email: pref.email,
            sms: pref.sms,
            voice: pref.voice,
          })
          .onConflictDoNothing()
          .then(async (result) => {
            // If conflict (row exists), update instead
            await db
              .update(notificationChannelConfig)
              .set({
                inApp: pref.inApp,
                email: pref.email,
                sms: pref.sms,
                voice: pref.voice,
              })
              .where(
                and(
                  eq(notificationChannelConfig.tenantId, tenantId),
                  eq(notificationChannelConfig.userId, userId),
                  eq(
                    notificationChannelConfig.notificationType,
                    pref.type as typeof notificationChannelConfig.$inferInsert.notificationType,
                  ),
                ),
              );
          });
      }

      return reply.send({ success: true });
    },
  );
}
