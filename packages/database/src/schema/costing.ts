import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { expenseCategoryEnum } from "./enums";
import { tenants } from "./tenants";
import { jobs } from "./jobs";
import { user } from "./auth";

/**
 * Money spent on a job that never appears on its line items.
 *
 * Line items answer "what did we charge?"; this table answers "what did it
 * cost?". For a service business most real cost lives here — the trip to the
 * supply house, the permit fee, the sub you called in — and none of it is
 * visible from the invoice.
 *
 * There is deliberately no `billable` flag. Nothing in the product can turn a
 * flagged expense into a line item, so the flag would be a promise the code
 * does not keep; bill it by adding a line item, and the expense stays what it
 * is: a cost.
 */
export const jobExpenses = pgTable(
  "job_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    category: expenseCategoryEnum("category").notNull().default("material"),
    description: text("description").notNull(),
    /** Always a real number. Unlike a unit cost, an expense you bothered to
     *  record is one you know the amount of, so there is no "unknown" state. */
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    /** Date the money went out, which is not always the job's scheduled date —
     *  parts are often bought days before the visit. */
    incurredOn: date("incurred_on").notNull(),
    vendor: text("vendor"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_job_expenses_tenant_job").on(table.tenantId, table.jobId),
    index("idx_job_expenses_tenant_incurred").on(
      table.tenantId,
      table.incurredOn,
    ),
  ],
);

/**
 * Per-member hourly cost override.
 *
 * A separate table rather than a column on `user` or `member`: those are Better
 * Auth's tables, and the less this application writes into a plugin's schema
 * the better — the same reasoning that closed the native admin surface.
 *
 * One row per (tenant, user). A member with no row falls back to
 * `tenants.default_labor_cost_rate`.
 */
export const tenantMemberRates = pgTable(
  "tenant_member_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    hourlyCostRate: numeric("hourly_cost_rate", {
      precision: 10,
      scale: 2,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_tenant_member_rates_tenant_user").on(
      table.tenantId,
      table.userId,
    ),
  ],
);
