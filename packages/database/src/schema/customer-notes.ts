import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { user } from "./auth";
import { workflows } from "./workflows";

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /**
     * The person who wrote it. **Nullable**, because an automation can write a
     * note and an automation is not a user.
     *
     * Exactly one of `createdBy` and `createdByWorkflowId` is set. That is not
     * enforced by a constraint on purpose: a note written by a person *through*
     * an automation-triggered flow is a shape this product may want later, and
     * a CHECK would have to be dropped to allow it.
     */
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "cascade",
    }),
    /**
     * The automation that wrote it.
     *
     * `SET NULL`, not cascade: deleting an automation must not delete the notes
     * it wrote. A note records something that happened to this customer and
     * outlives the thing that caused it — the same reasoning as
     * `workflow_executions.customer_id`.
     */
    createdByWorkflowId: uuid("created_by_workflow_id").references(
      () => workflows.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_customer_notes_tenant_customer").on(
      table.tenantId,
      table.customerId,
    ),
    /** Partial. "What has this automation written" is the only question asked
     *  of the column; "which notes have no workflow" is not. */
    index("idx_customer_notes_workflow")
      .on(table.createdByWorkflowId)
      .where(sql`${table.createdByWorkflowId} IS NOT NULL`),
  ],
);
