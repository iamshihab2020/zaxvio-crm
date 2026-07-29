import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { jobStatusEnum } from "./enums";
import { tenants } from "./tenants";
import { pipelines } from "./pipelines";

export const jobPipelineStages = pgTable(
  "job_pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    label: text("label").notNull(),
    // Which of the four real job statuses this stage represents. A tenant can
    // name a stage anything ("awaiting_parts"); `lifecycle` is what the rest of
    // the system reasons about — transitions, completedAt, reporting. Without
    // it, `jobs.status` was doing two jobs at once and custom stages were
    // unreachable because every status schema hardcoded the four enum values.
    lifecycle: jobStatusEnum("lifecycle").notNull().default("scheduled"),
    color: text("color").notNull().default("gray"),
    sortOrder: integer("sort_order").notNull().default(0),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_pipeline_stages_pipeline_name").on(
      table.pipelineId,
      table.name,
    ),
    index("idx_pipeline_stages_pipeline_sort").on(
      table.pipelineId,
      table.sortOrder,
    ),
    index("idx_pipeline_stages_tenant_id").on(table.tenantId),
  ],
);
