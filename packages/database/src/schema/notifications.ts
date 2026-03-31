import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { user } from "./auth";
import {
  notificationTypeEnum,
  notificationChannelEnum,
  deliveryStatusEnum,
} from "./enums";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    dedupKey: text("dedup_key"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_notifications_tenant_created").on(
      table.tenantId,
      table.createdAt,
    ),
    uniqueIndex("idx_notifications_dedup")
      .on(table.tenantId, table.dedupKey)
      .where(sql`${table.dedupKey} IS NOT NULL`),
  ],
);

export const notificationReads = pgTable(
  "notification_reads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_notification_reads_user_notification").on(
      table.userId,
      table.notificationId,
    ),
    index("idx_notification_reads_notification").on(table.notificationId),
  ],
);

export const notificationChannelConfig = pgTable(
  "notification_channel_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    inApp: boolean("in_app").notNull().default(true),
    email: boolean("email").notNull().default(true),
    sms: boolean("sms").notNull().default(false),
    voice: boolean("voice").notNull().default(false),
  },
  (table) => [
    uniqueIndex("idx_notification_channel_config_unique").on(
      table.tenantId,
      table.userId,
      table.notificationType,
    ),
  ],
);

export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    recipientId: text("recipient_id").notNull(),
    status: deliveryStatusEnum("status").notNull(),
    errorMessage: text("error_message"),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_notification_deliveries_notification_channel").on(
      table.notificationId,
      table.channel,
    ),
  ],
);
