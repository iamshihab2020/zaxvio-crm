import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { invoiceStatusEnum, itemTypeEnum, paymentMethodEnum } from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { jobs } from "./jobs";
import { catalogItems } from "./catalog";

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    invoiceNumber: text("invoice_number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    issuedDate: date("issued_date").notNull().defaultNow(),
    dueDate: date("due_date"),
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
    amountPaid: numeric("amount_paid", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    balanceDue: numeric("balance_due", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    pdfStoragePath: text("pdf_storage_path"),
    reviewRequestedAt: timestamp("review_requested_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_invoices_tenant_invoice_number").on(
      table.tenantId,
      table.invoiceNumber,
    ),
    index("idx_invoices_tenant_status").on(table.tenantId, table.status),
  ],
);

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
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

export const invoicePayments = pgTable("invoice_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method"),
  paymentDate: date("payment_date").notNull().defaultNow(),
  referenceNumber: text("reference_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
