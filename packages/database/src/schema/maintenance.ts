import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { equipment } from "./equipment";

export const maintenanceContracts = pgTable("maintenance_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  equipmentId: uuid("equipment_id").references(() => equipment.id, {
    onDelete: "set null",
  }),
  contractName: text("contract_name").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  visitsPerYear: integer("visits_per_year").default(2),
  annualPrice: numeric("annual_price", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
