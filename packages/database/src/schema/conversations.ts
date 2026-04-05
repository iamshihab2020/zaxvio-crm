import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { customers } from "./customers";

// ── Enums ──────────────────────────────────────────────────────────────────

export const conversationChannelEnum = pgEnum("conversation_channel", [
  "sms",
  "email",
]);

export const messageDirectionEnum = pgEnum("message_direction", [
  "inbound",
  "outbound",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "received",
]);

// ── conversations ──────────────────────────────────────────────────────────

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    channel: conversationChannelEnum("channel").notNull(),
    subject: text("subject"), // email thread subject (optional)
    status: text("status").notNull().default("active"), // "active" | "archived"
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_conversations_tenant").on(table.tenantId, table.lastMessageAt),
    index("idx_conversations_customer").on(table.tenantId, table.customerId),
    uniqueIndex("idx_conversations_unique").on(
      table.tenantId,
      table.customerId,
      table.channel,
    ),
  ],
);

// ── messages ───────────────────────────────────────────────────────────────

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    direction: messageDirectionEnum("direction").notNull(),
    channel: conversationChannelEnum("channel").notNull(),
    body: text("body").notNull(),
    subject: text("subject"), // email subject override (optional)
    status: messageStatusEnum("status").notNull().default("queued"),
    externalId: text("external_id"), // Resend email ID / future Twilio SID
    senderId: text("sender_id"), // userId for outbound messages
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_messages_conversation").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);
