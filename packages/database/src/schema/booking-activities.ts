import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { bookings } from "./bookings";
import { user } from "./auth";

export const bookingActivities = pgTable(
  "booking_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    description: text("description").notNull(),
    metadata: jsonb("metadata"),
    performedBy: text("performed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_booking_activities_tenant_booking").on(table.tenantId, table.bookingId),
    index("idx_booking_activities_created_at").on(table.createdAt),
  ],
);
