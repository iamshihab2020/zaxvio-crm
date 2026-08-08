/**
 * Retention — deleting what nobody will read again.
 *
 * Every constant, index and schema comment this needs was written on day one.
 * `RETENTION` has sat in `limits.ts` since P0, `idx_node_logs_started` exists
 * carrying the comment "the retention sweep", and
 * `workflow_executions.workflow_version_id` is `ON DELETE restrict` specifically
 * so that *"the retention sweep checks for non-terminal runs before deleting a
 * version, and this constraint is what makes that check load-bearing rather than
 * polite"*.
 *
 * **The sweep itself was never written.** Four tables grew forever, and the
 * `invoice.overdue` sweep added two queue rows per overdue invoice per day on
 * top — roughly 15,000 rows a year for a tenant with twenty unpaid invoices,
 * none of which anything would ever read again.
 *
 * ## Order is load-bearing
 *
 * Executions first, versions last. A version cannot be deleted while a run
 * references it — that is the `restrict` doing its job — so pruning executions
 * is what *makes* old versions prunable. The other order fails every time,
 * quietly, forever.
 *
 * ## Raw SQL, deliberately
 *
 * Bulk `DELETE … WHERE id IN (SELECT … LIMIT n)` and a `row_number()` window are
 * exactly what [[api-rules]] §3 reserves raw SQL for. Expressing them through
 * the query builder was tried first and produced a duplicated predicate and a
 * derived table stitched together with `sql` fragments — harder to read than the
 * SQL it was hiding.
 *
 * ## Each step has its own try/catch
 *
 * Lifted from wf-05: "a cleanup failure can never block a resume". One table
 * failing to prune must not stop the other three, and none of this is worth
 * taking the process down for.
 */

import { getDb, sql } from "@hvac-saas/database";
import { RETENTION } from "@hvac-saas/workflow-nodes";

type Db = Omit<ReturnType<typeof getDb>, "$client">;

/**
 * Rows per table per pass.
 *
 * An unbounded `DELETE` on a table nobody has ever pruned is how a retention
 * sweep takes a lock long enough to be noticed. The first pass on a busy tenant
 * has a lot to catch up on and simply takes several days of ticks to do it.
 */
const BATCH_LIMIT = 5_000;

/** Daily. Nothing here is urgent, and a tight loop on four DELETEs is waste. */
const TICK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Well after boot, so a deploy's first minutes are not spent pruning. */
const FIRST_TICK_DELAY_MS = 5 * 60 * 1000;

let tickTimer: NodeJS.Timeout | null = null;
let firstTimer: NodeJS.Timeout | null = null;
let running = false;

export interface RetentionResult {
  executions: number;
  queueCompleted: number;
  queueFailed: number;
  versions: number;
  orphanLogs: number;
}

export async function runRetentionTick(db: Db = getDb()): Promise<RetentionResult> {
  const result: RetentionResult = {
    executions: 0,
    queueCompleted: 0,
    queueFailed: 0,
    versions: 0,
    orphanLogs: 0,
  };

  /**
   * 1 · Finished runs past the window.
   *
   * Their node logs go with them: `node_execution_logs.execution_id` is
   * `ON DELETE cascade`, so this is one statement rather than two that could
   * disagree about what "old" means.
   *
   * **Terminal runs only.** A `waiting` run older than 90 days is a three-month
   * delay somebody deliberately set, and deleting it would cancel their
   * automation as a side effect — the automation would simply never resume, with
   * nothing anywhere saying why.
   */
  await step(result, "executions", () =>
    deleteBatch(
      db,
      sql`
        DELETE FROM workflow_executions
        WHERE id IN (
          SELECT id FROM workflow_executions
          WHERE status IN ('completed', 'failed', 'cancelled')
            AND started_at < clock_timestamp() - make_interval(days => ${RETENTION.NODE_LOG_DAYS}::int)
          ORDER BY started_at ASC
          LIMIT ${BATCH_LIMIT}
        )
      `,
    ),
  );

  /**
   * 2 · Queue rows, in two windows.
   *
   * They answer different questions: a completed row is history nobody reads,
   * and a dead letter is something an operator has to have time to notice. The
   * schema says 30 days for that, so this does too.
   */
  await step(result, "queueCompleted", () =>
    deleteBatch(
      db,
      sql`
        DELETE FROM workflow_event_queue
        WHERE id IN (
          SELECT id FROM workflow_event_queue
          WHERE status IN ('completed', 'cancelled')
            AND scheduled_at < clock_timestamp() - make_interval(days => ${RETENTION.QUEUE_COMPLETED_DAYS}::int)
          ORDER BY scheduled_at ASC
          LIMIT ${BATCH_LIMIT}
        )
      `,
    ),
  );

  await step(result, "queueFailed", () =>
    deleteBatch(
      db,
      sql`
        DELETE FROM workflow_event_queue
        WHERE id IN (
          SELECT id FROM workflow_event_queue
          WHERE status = 'failed'
            AND scheduled_at < clock_timestamp() - make_interval(days => ${RETENTION.QUEUE_FAILED_DAYS}::int)
          ORDER BY scheduled_at ASC
          LIMIT ${BATCH_LIMIT}
        )
      `,
    ),
  );

  /**
   * 3 · Versions — last, and only now that step 1 has released the runs holding
   *     them.
   *
   * Three things protect a version, and all three are necessary:
   *
   *  - **It is live.** `active_version_id`, which is *not* always the highest
   *    number — restoring an old version and publishing it makes that one live —
   *    so "keep the most recent N" does not cover this.
   *  - **It is one of the most recent N**, so version history stays useful.
   *  - **A run still points at it.** Enforced by the FK as well; checking it
   *    here is what turns a constraint violation into a row we simply skip.
   */
  await step(result, "versions", () =>
    deleteBatch(
      db,
      sql`
        DELETE FROM workflow_versions
        WHERE id IN (
          SELECT v.id
          FROM (
            SELECT id,
                   workflow_id,
                   row_number() OVER (
                     PARTITION BY workflow_id ORDER BY version DESC
                   ) AS rn
            FROM workflow_versions
          ) v
          WHERE v.rn > ${RETENTION.KEEP_RECENT_VERSIONS}::int
            AND NOT EXISTS (
              SELECT 1 FROM workflows w WHERE w.active_version_id = v.id
            )
            AND NOT EXISTS (
              SELECT 1 FROM workflow_executions e WHERE e.workflow_version_id = v.id
            )
          LIMIT ${BATCH_LIMIT}
        )
      `,
    ),
  );

  /**
   * 4 · Node logs whose execution is already gone.
   *
   * The cascade in step 1 means this should always be zero. It is here because
   * "should always be zero" is a claim: a future path that removes an execution
   * some other way, or a cascade that is not what the schema says it is, would
   * otherwise leave rows nothing ever looks at again. A non-zero count here is a
   * signal that something upstream is wrong, which is why it is logged loudly
   * and separately.
   *
   * `NOT EXISTS` rather than `NOT IN`: a `NOT IN` against a subquery that yields
   * a NULL is never true for any row, so the statement would silently delete
   * nothing at all.
   */
  await step(result, "orphanLogs", () =>
    deleteBatch(
      db,
      sql`
        DELETE FROM node_execution_logs
        WHERE id IN (
          SELECT l.id FROM node_execution_logs l
          WHERE l.started_at < clock_timestamp() - make_interval(days => ${RETENTION.NODE_LOG_DAYS}::int)
            AND NOT EXISTS (
              SELECT 1 FROM workflow_executions e WHERE e.id = l.execution_id
            )
          LIMIT ${BATCH_LIMIT}
        )
      `,
    ),
  );

  return result;
}

/** Run a bulk delete and report how many rows it removed. */
async function deleteBatch(db: Db, statement: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute(statement);
  // `rowCount` is what a DELETE reports; the driver wrappers differ on whether
  // it is present, so `rows.length` is the fallback rather than an assumption.
  const asRecord = result as unknown as { rowCount?: number; rows?: unknown[] };
  return asRecord.rowCount ?? asRecord.rows?.length ?? 0;
}

/**
 * One prune, guarded.
 *
 * Its own try/catch per wf-05: a cleanup failure must never stop the next one.
 */
async function step(
  result: RetentionResult,
  key: keyof RetentionResult,
  run: () => Promise<number>,
): Promise<void> {
  try {
    result[key] = await run();
  } catch (error) {
    console.error(`[workflow] Retention step "${key}" failed`, error);
  }
}

export function startRetentionWorker(): void {
  if (tickTimer) return;

  firstTimer = setTimeout(() => {
    void tick();
    tickTimer = setInterval(() => void tick(), TICK_INTERVAL_MS);
    tickTimer.unref?.();
  }, FIRST_TICK_DELAY_MS);
  firstTimer.unref?.();

  console.log(
    `[workflow] Retention worker started (every ${TICK_INTERVAL_MS / 3_600_000}h)`,
  );
}

function tick(): Promise<void> {
  if (running) return Promise.resolve();
  running = true;
  return runRetentionTick()
    .then((result) => {
      const total =
        result.executions + result.queueCompleted + result.queueFailed + result.versions;
      if (total > 0) {
        console.log(
          `[workflow] Retention: ${result.executions} runs, ${result.queueCompleted} queue rows, ` +
            `${result.queueFailed} dead letters, ${result.versions} versions`,
        );
      }
      if (result.orphanLogs > 0) {
        console.warn(
          `[workflow] Retention removed ${result.orphanLogs} orphaned node logs — the execution cascade is not doing what the schema says`,
        );
      }
    })
    .catch((error) => console.error("[workflow] Retention tick failed", error))
    .finally(() => {
      running = false;
    });
}

export function stopRetentionWorker(): void {
  if (firstTimer) {
    clearTimeout(firstTimer);
    firstTimer = null;
  }
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}
