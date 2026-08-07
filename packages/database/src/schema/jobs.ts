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
  type AnyPgColumn,
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
import { jobPipelineStages } from "./pipeline-stages";
import { user } from "./auth";
// Circular by design: bookings -> jobs (converted_to_job_id) and
// jobs -> bookings (booking_id). Both sides declare the reference through a
// lazy callback, so neither needs the other to be initialised at module load.
import { bookings } from "./bookings";

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
    // The real booking -> job link. `bookings.converted_to_job_id` points the
    // other way; both are now written and both have integrity constraints.
    bookingId: uuid("booking_id").references((): AnyPgColumn => bookings.id, {
      onDelete: "set null",
    }),
    equipmentId: uuid("equipment_id").references(() => equipment.id, {
      onDelete: "set null",
    }),
    pipelineId: uuid("pipeline_id").references(() => pipelines.id, {
      onDelete: "set null",
    }),
    // The real pointer to the board column. `status` below is the stage's
    // `name` denormalised for the many queries that filter on it, but it is
    // only ever written from a stage resolved through this FK.
    // ON DELETE SET NULL, never CASCADE: deleting a column must not delete work.
    stageId: uuid("stage_id").references(() => jobPipelineStages.id, {
      onDelete: "set null",
    }),
    assigneeId: text("assignee_id").references(() => user.id, {
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
    /**
     * Hours actually spent on site, which is *not* the same as the labour that
     * got billed. A job quoted at a 3-hour flat rate that took 5 hours reads as
     * healthy margin if you only ever look at line items — the exact failure
     * that makes a costing tool worse than none, because it tells you you are
     * winning while you lose. Captured once at completion (prefilled from
     * scheduled_start/scheduled_end where both are set).
     */
    actualHours: numeric("actual_hours", { precision: 6, scale: 2 }),
    /**
     * The hourly cost rate applied to `actualHours`, snapshotted onto the job.
     *
     * Resolved at entry time from the assignee's `tenant_member_rates` row,
     * falling back to `tenants.default_labor_cost_rate`. Stored rather than
     * joined so that giving yourself a raise does not retroactively rewrite
     * last year's margins — same reasoning as the unit-cost snapshot on line
     * items below.
     */
    laborCostRate: numeric("labor_cost_rate", { precision: 10, scale: 2 }),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
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
    index("idx_jobs_booking_id").on(table.bookingId),
    index("idx_jobs_stage_id").on(table.stageId),
    index("idx_jobs_tenant_archived").on(table.tenantId, table.archivedAt),
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
  /**
   * Copied from `catalog_items.unit_cost` when the line is added, then freely
   * editable — a **snapshot, not a join**. Supplier prices move, and a closed
   * job's margin must not move with them. This mirrors `unitPrice` above,
   * which has always been copied rather than read through `catalogItemId`.
   *
   * NULL means the cost is unknown. See the note on `catalogItems.unitCost`.
   */
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }).generatedAlwaysAs(
    sql`quantity * unit_price`,
  ),
  /** Generated twin of `total`. NULL propagates, so an uncosted line stays
   *  visibly uncosted instead of silently contributing zero cost. */
  costTotal: numeric("cost_total", { precision: 10, scale: 2 }).generatedAlwaysAs(
    sql`quantity * unit_cost`,
  ),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
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
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
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
