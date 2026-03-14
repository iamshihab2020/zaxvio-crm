import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { adminRoleEnum, eventTypeEnum } from "./enums";
import { tenants } from "./tenants";

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRoleEnum("role").notNull(),
    fullName: text("full_name").notNull(),
    isActive: boolean("is_active").default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("idx_admin_users_email").on(table.email)],
);

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    action: text("action").notNull(),
    targetTenantId: uuid("target_tenant_id").references(() => tenants.id, {
      onDelete: "set null",
    }),
    targetUserId: uuid("target_user_id"),
    metadata: jsonb("metadata"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  () => [],
);

export const adminImpersonationSessions = pgTable(
  "admin_impersonation_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminUserId: uuid("admin_user_id")
      .notNull()
      .references(() => adminUsers.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    tenantUserId: uuid("tenant_user_id").notNull(),
    reason: text("reason").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    actionsTaken: jsonb("actions_taken").default([]),
  },
  () => [],
);

export const platformEvents = pgTable(
  "platform_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    userId: uuid("user_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_platform_events_tenant_type_created").on(
      table.tenantId,
      table.eventType,
      table.createdAt,
    ),
  ],
);
