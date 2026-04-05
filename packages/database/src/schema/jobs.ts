import {
  pgTable,
  uuid,
  text,
  date,
  time,
  timestamp,
  numeric,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  jobPriorityEnum,
  serviceTypeEnum,
  itemTypeEnum,
  photoTagEnum,
} from "./enums";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { catalogItems } from "./catalog";
import { equipment } from "./equipment";
import { pipelines } from "./pipelines";
import { user } from "./auth";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id"),
    equipmentId: uuid("equipment_id").references(() => equipment.id, {
      onDelete: "set null",
    }),
    pipelineId: uuid("pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    jobNumber: text("job_number").notNull(),
    status: text("status").notNull().default("scheduled"),
    priority: jobPriorityEnum("priority").notNull().default("standard"),
    serviceType: serviceTypeEnum("service_type").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    scheduledDate: date("scheduled_date").notNull(),
    scheduledStart: time("scheduled_start"),
    scheduledEnd: time("scheduled_end"),
    address: text("address"),
    subtotal: numeric("subtotal", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 4 }).default("0"),
    taxAmount: numeric("tax_amount", { precision: 10, scale: 2 }).default("0"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_jobs_tenant_job_number").on(
      table.tenantId,
      table.jobNumber,
    ),
    index("idx_jobs_tenant_status").on(table.tenantId, table.status),
    index("idx_jobs_pipeline_status").on(table.pipelineId, table.status),
    index("idx_jobs_tenant_scheduled_date").on(
      table.tenantId,
      table.scheduledDate,
    ),
  ],
);

export const jobLineItems = pgTable("job_line_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
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

export const jobPhotos = pgTable("job_photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  storagePath: text("storage_path").notNull(),
  caption: text("caption"),
  tag: photoTagEnum("tag").notNull().default("general"),
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  fileSize: integer("file_size"),
  takenAt: timestamp("taken_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobDocuments = pgTable(
  "job_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id"),
    fileName: text("file_name").notNull(),
    storagePath: text("storage_path").notNull(),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_job_documents_job_id").on(table.jobId),
    index("idx_job_documents_tenant_id").on(table.tenantId),
  ],
);
