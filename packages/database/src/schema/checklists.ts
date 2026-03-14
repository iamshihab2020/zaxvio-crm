import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { serviceTypeEnum } from "./enums";
import { tenants } from "./tenants";
import { user } from "./auth";
import { jobs } from "./jobs";
import { catalogItems } from "./catalog";

export const checklistTemplates = pgTable(
  "checklist_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    serviceType: serviceTypeEnum("service_type").notNull(),
    name: text("name").notNull(),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_checklist_templates_tenant_service").on(
      table.tenantId,
      table.serviceType,
    ),
  ],
);

export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  templateId: uuid("template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  isRequired: boolean("is_required").default(true),
  catalogItemId: uuid("catalog_item_id").references(() => catalogItems.id, {
    onDelete: "set null",
  }),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobChecklistCompletions = pgTable(
  "job_checklist_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    checklistItemId: uuid("checklist_item_id")
      .notNull()
      .references(() => checklistItems.id, { onDelete: "cascade" }),
    isCompleted: boolean("is_completed").default(false),
    completedBy: text("completed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_job_checklist_unique").on(
      table.jobId,
      table.checklistItemId,
    ),
  ],
);
