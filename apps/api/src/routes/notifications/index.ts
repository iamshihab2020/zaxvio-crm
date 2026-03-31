import type { FastifyInstance } from "fastify";
import { requireTenant } from "../../lib/auth-middleware.js";
import {
  getDb,
  notifications,
  notificationReads,
  notificationChannelConfig,
  eq,
  and,
  sql,
  desc,
} from "@hvac-saas/database";

export default async function notificationRoutes(fastify: FastifyInstance) {
  /**
   * GET /notifications
   * List recent notifications for the current tenant + user.
   * Query params: limit (default 20), cursor (ISO date for pagination)
   */
  fastify.get(
    "/",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query.limit ?? "20", 10) || 20, 50);
      const cursor = query.cursor;

      const db = getDb();

      const cursorFilter = cursor
        ? sql`AND n."created_at" < ${cursor}::timestamptz`
        : sql``;

      const rows = await db.execute<{
        id: string;
        tenant_id: string;
        type: string;
        title: string;
        description: string;
        entity_type: string | null;
        entity_id: string | null;
        actor_id: string | null;
        metadata: unknown;
        dedup_key: string | null;
        created_at: string;
        is_read: boolean;
      }>(sql`
        SELECT
          n.*,
          CASE WHEN nr.id IS NOT NULL THEN true ELSE false END AS is_read
        FROM "notifications" n
        LEFT JOIN "notification_reads" nr
          ON nr."notification_id" = n."id" AND nr."user_id" = ${userId}
        WHERE n."tenant_id" = ${tenantId}
          AND (n."actor_id" IS NULL OR n."actor_id" != ${userId})
          ${cursorFilter}
        ORDER BY n."created_at" DESC
        LIMIT ${limit}
      `);

      const data = rows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        type: r.type,
        title: r.title,
        description: r.description,
        entityType: r.entity_type,
        entityId: r.entity_id,
        actorId: r.actor_id,
        metadata: r.metadata,
        createdAt: r.created_at,
        isRead: r.is_read,
      }));

      const nextCursor =
        data.length === limit ? data[data.length - 1].createdAt : null;

      return reply.send({ data, nextCursor });
    },
  );

  /**
   * GET /notifications/unread-count
   * Returns count of unread notifications for the current user.
   */
  fastify.get(
    "/unread-count",
    { preHandler: [requireTenant] },
    async (request, reply) => {
      const tenantId = request.authUser.tenantId!;
      const userId = request.authUser.userId;

      const db = getDb();

      const result = await db.execute<{ count: string }>(sql`
        SELECT COUNT(*)::text AS count
        FROM "notifications" n
        LEFT JOIN "notification_reads" nr
          ON nr."notification_id" = n."id" AND nr."user_id" = ${userId}
        WHERE n."tenant_id" = ${tenantId}
          AND (n."actor_id" IS NULL OR n."actor_id" != ${userId})
          AND nr."id" IS NULL
      `);

      return reply.send({ count: parseInt(result[0]?.count ?? "0", 10) });
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
