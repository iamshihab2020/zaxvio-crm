import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { user } from "./auth";

export const customerActivities = pgTable(
  "customer_activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
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
    index("idx_customer_activities_tenant_customer").on(
      table.tenantId,
      table.customerId,
    ),
    index("idx_customer_activities_created_at").on(table.createdAt),
  ],
);
