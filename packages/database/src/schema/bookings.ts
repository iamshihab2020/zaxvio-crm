import {
  pgTable,
  uuid,
  text,
  date,
  time,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { bookingStatusEnum, serviceTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { quotes } from "./quotes";
import { jobs } from "./jobs";

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    quoteId: uuid("quote_id").references(() => quotes.id, {
      onDelete: "set null",
    }),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    serviceType: serviceTypeEnum("service_type").notNull(),
    bookingDate: date("booking_date").notNull(),
    preferredTime: time("preferred_time"),
    address: text("address"),
    description: text("description"),
    status: bookingStatusEnum("status").notNull().default("pending"),
    source: text("source").notNull().default("portal"),
    convertedToJobId: uuid("converted_to_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_bookings_tenant_status").on(table.tenantId, table.status),
    index("idx_bookings_tenant_date").on(table.tenantId, table.bookingDate),
  ],
);
