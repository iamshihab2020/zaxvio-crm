import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  index,
} from "drizzle-orm/pg-core";
import { refrigerantActionEnum } from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { jobs } from "./jobs";

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    equipmentType: text("equipment_type").notNull(),
    brand: text("brand"),
    model: text("model"),
    serialNumber: text("serial_number"),
    installDate: date("install_date"),
    warrantyExpiry: date("warranty_expiry"),
    location: text("location"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_equipment_tenant_customer").on(
      table.tenantId,
      table.customerId,
    ),
  ],
);

export const refrigerantLogs = pgTable("refrigerant_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
  equipmentId: uuid("equipment_id").references(() => equipment.id, {
    onDelete: "set null",
  }),
  refrigerantType: text("refrigerant_type").notNull(),
  action: refrigerantActionEnum("action").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").default("lbs"),
  technicianName: text("technician_name"),
  epaCertNumber: text("epa_cert_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
