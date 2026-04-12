import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { quoteStatusEnum, itemTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { jobs } from "./jobs";
import { equipment } from "./equipment";
import { catalogItems } from "./catalog";

export const quotes = pgTable(
  "quotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    quoteNumber: text("quote_number").notNull(),
    status: quoteStatusEnum("status").notNull().default("draft"),
    issuedDate: date("issued_date").notNull().defaultNow(),
    expiryDate: date("expiry_date"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
    discountAmount: numeric("discount_amount", {
      precision: 10,
      scale: 2,
    }).default("0"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    pdfStoragePath: text("pdf_storage_path"),
    equipmentId: uuid("equipment_id").references(() => equipment.id, {
      onDelete: "set null",
    }),
    convertedToJobId: uuid("converted_to_job_id").references(() => jobs.id, {
      onDelete: "set null",
    }),
    accessToken: text("access_token"),
    declineReason: text("decline_reason"),
    customerScheduledDate: date("customer_scheduled_date"),
    customerScheduledTime: text("customer_scheduled_time"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_quotes_tenant_quote_number").on(
      table.tenantId,
      table.quoteNumber,
    ),
  ],
);

export const quoteLineItems = pgTable("quote_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  quoteId: uuid("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, {
    onDelete: "set null",
  }),
  itemType: itemTypeEnum("item_type").notNull(),
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 10, scale: 2 })
    .notNull()
    .default("1"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total: numeric("total", { precision: 10, scale: 2 }).generatedAlwaysAs(
    sql`quantity * unit_price`,
  ),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
