import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
 * Time worked on a job, by one person, in one sitting.
 *
 * ## Why this table exists
 *
 * `jobs.actual_hours` was a single number typed by hand into a box on the Costs
 * tab, days after the work, from memory — multiplied by a single rate resolved
 * from the job's *assignee*. Three things followed from that: nothing ever
 * prompted for it so in practice it was empty, a job worked by two people could
 * not be represented at all, and `buildCoverage()` spent its life emitting
 * "No hours recorded for this job". Labour is usually the largest cost line on a
 * service job, so the whole costing feature rested on a field nobody filled in.
 *
 * Entries are now the source. `jobs.actual_hours` survives only as a
 * denormalised cache maintained in the same transaction as every write here —
 * the same arrangement `recalculateJobTotals` already gives `jobs.total_amount`.
 *
 * ## Duration is never stored
 *
 * It is `ended_at - started_at`, every time. The costing service's own rule:
 * a figure derived from its inputs cannot drift from them, and a stored duration
 * would give it a way to.
 *
 * ## `hourly_cost_rate` is nullable, and snapshotted per entry
 *
 * Nullable because `resolveLaborCostRate` already treats null as a real answer
 * meaning "labour cost is unknown", and its docblock is explicit that callers
 * must not turn it into 0 — a zero rate reports every job's labour as free,
 * which is the single most misleading thing this feature could say. An entry
 * with no rate contributes **hours but no cost**, and the coverage gap says so.
 *
 * Snapshotted rather than joined, for the reason `jobs.labor_cost_rate` already
 * gives: a raise must not rewrite last year's margins. Per *entry* rather than
 * per job is what finally makes the two-person job cost what it actually cost —
 * each person's time at their own rate.
 */
export const jobTimeEntries = pgTable(
  "job_time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    /** Who did the work — not necessarily who recorded it. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    /** NULL means the clock is still running. */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    hourlyCostRate: numeric("hourly_cost_rate", { precision: 10, scale: 2 }),
    note: text("note"),
    /**
     * Closed by the sweep rather than by a person, because the timer ran past
     * the ceiling. The hours still count — the time is probably partly real —
     * but coverage reports it, so an auto-stop is never silently trusted and
     * never silently discarded.
     */
    autoStopped: boolean("auto_stopped").notNull().default(false),
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
    index("idx_job_time_entries_tenant_job").on(table.tenantId, table.jobId),
    index("idx_job_time_entries_tenant_user_started").on(
      table.tenantId,
      table.userId,
      table.startedAt,
    ),
    /**
     * One running timer per person, enforced by the database.
     *
     * A partial unique index, the same device `idx_goal_listeners_match` uses
     * and for the same reason: it makes "clocked into two jobs at once"
     * unexpressible rather than merely discouraged, and being **partial** is
     * what still lets the same person start a new timer once the last one has
     * stopped. Application-side checks race; this one cannot.
     */
    uniqueIndex("idx_job_time_entries_one_running")
      .on(table.tenantId, table.userId)
      .where(sql`ended_at IS NULL`),
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
