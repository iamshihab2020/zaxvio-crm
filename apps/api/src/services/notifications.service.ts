import { sql } from "@hvac-saas/database";
import type { getDb } from "@hvac-saas/database";

type DbClient = ReturnType<typeof getDb>;

export interface NotificationItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  description: string;
  entityType: string | null;
  entityId: string | null;
  actorId: string | null;
  metadata: unknown;
  createdAt: string;
  isRead: boolean;
}

export interface NotificationListResult {
  data: NotificationItem[];
  nextCursor: string | null;
}

/** Fetch notifications with read status via cursor-based pagination. */
export async function getNotifications(
  db: DbClient,
  tenantId: string,
  userId: string,
  limit: number,
  cursor?: string,
): Promise<NotificationListResult> {
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

  return { data, nextCursor };
}

/** Count unread notifications for a user. */
export async function getUnreadCount(
  db: DbClient,
  tenantId: string,
  userId: string,
): Promise<number> {
  const result = await db.execute<{ count: string }>(sql`
    SELECT COUNT(*)::text AS count
    FROM "notifications" n
    LEFT JOIN "notification_reads" nr
      ON nr."notification_id" = n."id" AND nr."user_id" = ${userId}
    WHERE n."tenant_id" = ${tenantId}
      AND (n."actor_id" IS NULL OR n."actor_id" != ${userId})
      AND nr."id" IS NULL
  `);

  return parseInt(result[0]?.count ?? "0", 10);
}
