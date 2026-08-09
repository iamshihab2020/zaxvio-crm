import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { workflowEventStatusEnum, workflowSubjectTypeEnum } from "./enums";

/**
 * The transactional outbox.
 *
 * A domain service that changes something inserts here **in its own
 * transaction**, so the event and the change that caused it commit together or
 * not at all. Nothing is sent inline: the caller returns as soon as the row is
 * written, and a worker picks it up.
 *
 * That ordering is the whole design. The alternative — do the work inline, or
 * enqueue after commit — has two failure modes this cannot have: an email sent
 * for a transaction that then rolled back, and a committed change whose
 * automation was lost because the process died in the gap.
 */
export const workflowEventQueue = pgTable(
  "workflow_event_queue",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),

    /** A key of `WORKFLOW_EVENTS`. Deliberately `text`, not an enum. */
    eventType: text("event_type").notNull(),

    /**
     * Validated by the producer before the insert and **again** by the worker
     * after the read.
     *
     * The second parse is the one that earns its keep: it catches a payload
     * whose shape changed between write and read, which is precisely what a
     * deploy does to rows already sitting in this table.
     */
    payload: jsonb("payload").notNull(),

    /** Null for `schedule.*`, which is about nothing in particular. */
    subjectType: workflowSubjectTypeEnum("subject_type"),
    subjectId: uuid("subject_id"),

    /**
     * Who caused it. `text` because Better Auth owns `user.id` and types it
     * `text`. No FK: a user can be deleted, and the history of what they did
     * must survive them — the same reasoning as `node_execution_logs.node_id`.
     */
    actorUserId: text("actor_user_id"),

    /**
     * One row per subscriber, and that is the point.
     *
     * The reference implementation ran nine coupled concerns serially in one
     * handler, so a throw in the seventh failed the event and retried the first
     * — an automation re-ran because *nurture enrollment* had failed. Separate
     * rows mean separate statuses and separate retry counts, so a broken goal
     * listener cannot re-trigger a workflow that already ran correctly.
     */
    subscriber: text("subscriber").notNull(),

    status: workflowEventStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),

    /** When it became eligible. Set by the producer, not the worker. */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Backoff: `min(30s · 2^(attempts-1), 8min)`. */
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

    /**
     * Groups the per-subscriber rows that came from one domain event, so the
     * run log can say "this run and that goal check came from the same stage
     * change" without inventing a parent table.
     */
    correlationId: uuid("correlation_id").notNull(),

    /**
     * How many automations deep the chain that produced this event is.
     *
     * 0 for anything a person, a cron or the public portal caused. An event
     * raised by an automation running at depth N is stamped N+1, and the
     * matcher hands it to `execute({ depth })`, whose existing guard refuses
     * beyond `MAX_NESTING_DEPTH`.
     *
     * Without it, `execute()`'s depth guard covered only one automation calling
     * another **directly** — an event-triggered run started fresh at 0 every
     * time, so two automations triggering each other through the outbox would
     * cycle until the tenant's quota or the disk stopped them. Harmless while
     * executors wrote their tables silently; a live hazard the moment they
     * started going through the domain services that raise events.
     */
    causationDepth: integer("causation_depth").notNull().default(0),

    /**
     * Producer-supplied, and unique per subscriber where present.
     *
     * Structural rather than a check-then-insert, for the same reason
     * `quotes.access_token` got a UNIQUE index: two requests can both pass a
     * check before either commits. A double-fired producer gets a `23505` and
     * the second insert is skipped.
     */
    dedupKey: text("dedup_key"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * The claim index. Column order matters: the claiming query filters on
     * `status` and orders by `scheduled_at`, so this one index answers both and
     * the planner never sorts.
     */
    index("idx_wf_queue_claim").on(t.status, t.scheduledAt),
    index("idx_wf_queue_retry").on(t.status, t.nextRetryAt),
    index("idx_wf_queue_tenant").on(t.tenantId, t.status),
    index("idx_wf_queue_correlation").on(t.correlationId),
    /** Recovery sweep: rows stuck in `processing` past the stale threshold. */
    index("idx_wf_queue_stale").on(t.status, t.claimedAt),
    /**
     * Partial, so the millions of rows with no dedup key cost nothing and do
     * not collide with each other on NULL.
     */
    uniqueIndex("idx_wf_queue_dedup")
      .on(t.dedupKey, t.subscriber)
      .where(sql`${t.dedupKey} IS NOT NULL`),
  ],
);
