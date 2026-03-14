import {
  pgTable,
  uuid,
  text,
  date,
  time,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";

export const availabilitySchedules = pgTable("availability_schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const scheduleOverrides = pgTable("schedule_overrides", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  overrideDate: date("override_date").notNull(),
  isAvailable: boolean("is_available").notNull().default(false),
  startTime: time("start_time"),
  endTime: time("end_time"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
