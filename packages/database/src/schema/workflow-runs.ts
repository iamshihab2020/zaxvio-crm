import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { customers } from "./customers";
import { workflows, workflowVersions } from "./workflows";
import {
  nodeExecutionStatusEnum,
  workflowExecutionSourceEnum,
  workflowExecutionStatusEnum,
  workflowSubjectTypeEnum,
} from "./enums";

/**
 * One run of one automation, and one row per node within it.
 */

export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    /**
     * Pinned. Resume loads **this** snapshot, never the live draft.
     *
     * `restrict` rather than `cascade`: a version with a run attached to it
     * cannot be pruned, which is the whole guarantee. The retention sweep
     * checks for non-terminal runs before deleting a version, and this
     * constraint is what makes that check load-bearing rather than polite.
     */
    workflowVersionId: uuid("workflow_version_id")
      .notNull()
      .references(() => workflowVersions.id, { onDelete: "restrict" }),

    // ── the subject ──────────────────────────────────────────────────────────
    /** Nullable: a webhook or scheduled run may have no subject at all. */
    subjectType: workflowSubjectTypeEnum("subject_type"),
    subjectId: uuid("subject_id"),
    /**
     * Always resolved from the subject where one exists — every subject table
     * carries a customer id. Powers "which automations have touched this
     * customer", and lets `{{customer.email}}` work on a job- or
     * invoice-triggered run without the author thinking about it.
     *
     * SET NULL rather than cascade: deleting a customer must not erase the
     * history of what was done on their behalf.
     */
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),

    status: workflowExecutionStatusEnum("status").notNull().default("running"),
    source: workflowExecutionSourceEnum("source").notNull(),

    triggerNodeId: uuid("trigger_node_id"),
    triggerEvent: text("trigger_event"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    /** The technical failure, for logs. */
    errorMessage: text("error_message"),
    /**
     * The same failure in plain language, for the person who has to fix it.
     *
     * "This customer unsubscribed on 12 July, so we didn't email them" — never
     * a stack or a code. Written once here so the replay page, the failure
     * notification and the run list all inherit it, because workflow failures
     * are the number one support driver a feature like this generates.
     */
    errorHint: text("error_hint"),

    // ── durable pause ────────────────────────────────────────────────────────
    /** Set for a delay; NULL for a goal wait. Half of the resume query's index. */
    resumeAt: timestamp("resume_at", { withTimezone: true }),
    currentNodeId: uuid("current_node_id"),
    /** The whole serialised context. Capped — see contextTruncated. */
    waitingContext: jsonb("waiting_context"),
    /**
     * The context exceeded its size cap and older node outputs were dropped.
     * Surfaced in the replay view: a truncation you can see beats a 10 MB row
     * you cannot.
     */
    contextTruncated: boolean("context_truncated").notNull().default(false),

    /** Set by "run from here" — links a replay fork to what it replayed. */
    parentExecutionId: uuid("parent_execution_id"),

    // ── deduplication ────────────────────────────────────────────────────────
    /**
     * Stops the *same event* delivered twice from creating two runs.
     * `sha256(workflowId:triggerNodeId:queueRowId)`. A 23505 here means
     * "already handled" and is not an error.
     */
    idempotencyKey: text("idempotency_key"),
    /**
     * Stops a *different* event for a subject that is already mid-run from
     * creating a second one. `workflowId:subjectType:subjectId`, and NULL for
     * manual, test and webhook runs, which may legitimately overlap.
     *
     * A 23505 here means "refresh this run's context, do not start another" —
     * which is a structural guarantee rather than the query-then-insert race
     * the system this was ported from relies on.
     */
    activeDedupKey: text("active_dedup_key"),

    nodesExecuted: integer("nodes_executed").notNull().default(0),

    /**
     * How many automations deep this run is. Mirrors
     * `workflow_event_queue.causation_depth`, and it is stored rather than
     * derived because a run that **pauses** has to keep it: a resume is the
     * same chain continuing days later, and restarting the count at 0 would
     * make a loop with a one-minute wait in it unbounded again — slower than a
     * tight cycle, and no less runaway.
     */
    causationDepth: integer("causation_depth").notNull().default(0),
  },
  (table) => [
    index("idx_wf_exec_workflow").on(table.workflowId, table.startedAt),
    index("idx_wf_exec_tenant_status").on(table.tenantId, table.status),
    /** THE resume query: waiting rows whose resume_at has passed. */
    index("idx_wf_exec_resume").on(table.status, table.resumeAt),
    index("idx_wf_exec_subject").on(
      table.tenantId,
      table.subjectType,
      table.subjectId,
    ),
    index("idx_wf_exec_customer").on(table.tenantId, table.customerId),
    index("idx_wf_exec_parent").on(table.parentExecutionId),
    uniqueIndex("idx_wf_exec_idempotency")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    /** One live run per (workflow, subject). Partial, so completed runs never
     *  block a legitimate re-enrolment later. */
    uniqueIndex("idx_wf_exec_active_dedup")
      .on(table.activeDedupKey)
      .where(
        sql`${table.activeDedupKey} IS NOT NULL AND ${table.status} IN ('running', 'waiting')`,
      ),
  ],
);

export const nodeExecutionLogs = pgTable(
  "node_execution_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    executionId: uuid("execution_id")
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: "cascade" }),

    /**
     * **No foreign key**, deliberately. A node deleted from the draft graph
     * must not delete the history of what it did, and the node this points at
     * may only exist inside an old published snapshot.
     */
    nodeId: uuid("node_id").notNull(),

    /** Denormalised so an operator can query failures without three joins. */
    workflowId: uuid("workflow_id").notNull(),
    nodeType: text("node_type").notNull(),
    nodeLabel: text("node_label"),
    /** Execution order within the run. Also part of the re-entry guard. */
    sequence: integer("sequence").notNull(),

    status: nodeExecutionStatusEnum("status").notNull(),
    /** "disabled", "customer unsubscribed", "quiet hours" — shown to the user. */
    skipReason: text("skip_reason"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),

    /**
     * Always stored: what this node actually tried to do, after variable
     * interpolation. Small, and it answers ~95% of "why did this happen".
     * Secrets are redacted before it is written.
     */
    resolvedParams: jsonb("resolved_params"),
    output: jsonb("output"),

    /**
     * Failed nodes and test runs only.
     *
     * A full context snapshot per node per run is what makes this table
     * unmanageable, and it is exactly where you do not need it — a node that
     * succeeded is not the one being debugged.
     */
    contextSnapshot: jsonb("context_snapshot"),

    errorMessage: text("error_message"),
    errorHint: text("error_hint"),
  },
  (table) => [
    index("idx_node_logs_execution").on(table.executionId, table.sequence),
    index("idx_node_logs_tenant_status").on(table.tenantId, table.status),
    index("idx_node_logs_workflow_status").on(table.workflowId, table.status),
    /** The retention sweep. */
    index("idx_node_logs_started").on(table.startedAt),
    /**
     * The at-most-once guard: one row per (run, node, attempt). A resume that
     * finds an existing `running` row for a node that sends refuses rather than
     * sending twice.
     */
    uniqueIndex("idx_node_logs_attempt").on(
      table.executionId,
      table.nodeId,
      table.sequence,
    ),
  ],
);

/**
 * Live "stop this run when X happens" watches.
 *
 * A goal is the inverse of a trigger: a trigger asks whether a dispatched event
 * should **start** a run, a goal asks whether it should **end** one already in
 * flight. Both read the same event and both evaluate their conditions with the
 * same filter engine, which is why a goal costs a table and one indexed lookup
 * rather than a second matching implementation.
 *
 * The row is what makes it durable — a three-day chase outlives any process
 * that could hold the watch in memory, and the system this was ported from
 * keeps its equivalent in a module-level Map, so "once only" there means "once
 * per replica per uptime window".
 *
 * The goal node has **no outputs** (D-04). When the goal fires the run
 * completes from wherever it had reached; it does not jump to a branch. The
 * reference implementation gives its goal node a downstream branch that is
 * silently dead, which is worse than either behaviour.
 */
export const workflowGoalListeners = pgTable(
  "workflow_goal_listeners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),

    /**
     * CASCADE, unlike almost everything else pointing at a run.
     *
     * A listener is not a record of something that happened — it is a live
     * watch, meaningless without the run it would end. Retention deletes
     * terminal executions, and a listener outliving its execution would be a
     * watch that can never fire.
     */
    executionId: uuid("execution_id")
      .notNull()
      .references(() => workflowExecutions.id, { onDelete: "cascade" }),

    /**
     * The goal node inside the version's graph snapshot.
     *
     * Deliberately NOT a foreign key: `workflow_nodes` holds the **draft**, and
     * a run is pinned to a published version whose nodes live in the snapshot.
     * An FK would break the moment the author deleted the step from their
     * draft, while the run legitimately continues on the old version.
     */
    nodeId: uuid("node_id").notNull(),

    subjectType: workflowSubjectTypeEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),

    /**
     * An **event** name (`booking.created`), never a node id
     * (`trigger.booking.created`). That distinction has already caused two
     * separate outages in this feature — first matching nothing silently, then
     * throwing `22P02` — so it is stated here, in the migration and in the
     * column comment.
     */
    goalEvent: text("goal_event").notNull(),

    /** Extra conditions, evaluated by the same matcher as trigger filters. */
    goalFilter: jsonb("goal_filter").notNull().default(sql`'{}'::jsonb`),

    /** active = watching · met = fired and ended the run · inactive = run ended otherwise. */
    status: text("status").notNull().default("active"),
    metAt: timestamp("met_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /**
     * THE lookup, on every dispatched event any goal watches for.
     *
     * `.where(...)` is not decoration: the migration creates these PARTIAL on
     * `status = 'active'`, and an index declared here without the predicate is
     * a different index. Schema drift that only shows up as a slow query is
     * the hardest kind to notice.
     */
    index("idx_goal_listeners_match")
      .on(table.tenantId, table.subjectType, table.subjectId, table.goalEvent)
      .where(sql`status = 'active'`),
    /** Deactivating every listener for a run, on each terminal transition. */
    index("idx_goal_listeners_execution").on(table.executionId, table.status),
    /** The 30-day reaper's scan. */
    index("idx_goal_listeners_reaper")
      .on(table.createdAt)
      .where(sql`status = 'active'`),
    /** One live watch per (run, node) — a double registration is unrepresentable. */
    uniqueIndex("idx_goal_listeners_one_per_node")
      .on(table.executionId, table.nodeId)
      .where(sql`status = 'active'`),
  ],
);
