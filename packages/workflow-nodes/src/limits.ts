/**
 * Every limit the engine enforces, in one file.
 *
 * Imported by the engine (which enforces them), the graph validator (which
 * blocks a publish that would exceed them) and the builder (which displays
 * them). One declaration is what stops the number enforced and the number shown
 * from drifting apart — the same reasoning as `lib/upload-limits.ts`, which
 * exists because a route advertised 2 MB while the parser enforced ~786 KB.
 *
 * A cap that is enforced silently is a support ticket. Every one of these is
 * surfaced somewhere in the UI before it can refuse anything.
 */

export const EXECUTION_LIMITS = {
  /**
   * Global wall clock for one run. A design constraint, not a tuning knob:
   * long work is a *delay*, which persists and resumes, not a slow node. If
   * bulk fan-out is ever needed it is a queue-backed executor, not a bigger
   * number here.
   */
  MAX_EXECUTION_MS: 5 * 60 * 1000,

  /** Nodes in one automation. Bounds the whole-graph PUT and keeps a canvas
   *  readable. The reference implementation allows 100; 60 is plenty for a
   *  service business and the difference is a payload nobody has to think about. */
  MAX_NODES_PER_WORKFLOW: 60,

  /** Node *executions* in one run — higher than the node count because loops
   *  and `logic.goto` revisit nodes legitimately. */
  MAX_NODES_EXECUTED: 200,

  MAX_LOOP_ITERATIONS: 500,

  /** Sub-automation recursion. */
  MAX_NESTING_DEPTH: 3,

  /** Per `logic.goto` node, tracked in the run's context. */
  MAX_GOTO_JUMPS: 5,

  /**
   * Serialised pause context. Over this the engine keeps the subject, customer,
   * tenant, trigger payload, loop state and the last five node outputs, drops
   * the rest and flags `context_truncated`. A truncation you can see beats a
   * 10 MB row you cannot.
   */
  MAX_CONTEXT_BYTES: 256 * 1024,

  /** Longest a single `delay.wait` may schedule. */
  MAX_DELAY_DAYS: 365,

  /** Longest a goal wait may sit before the reaper cancels it. */
  MAX_GOAL_WAIT_DAYS: 30,
} as const;

/**
 * Per-tenant budgets. The reference implementation has none, and its own audit
 * names that as the gap to close "before you have noisy neighbours".
 *
 * Surfaced in the automations list before they are ever enforced, and the first
 * refusal notifies the owner with the number and what to do about it.
 */
export const TENANT_QUOTAS = {
  MAX_CONCURRENT_EXECUTIONS: 25,
  MAX_DAILY_EXECUTIONS: 2_000,
  /** Counts toward a shared Resend sender reputation, so this one is real. */
  MAX_DAILY_AUTOMATION_EMAILS: 200,
  /**
   * Outbound HTTP calls per tenant per day. P10, and the last item on
   * [[wf-10-security|§10.5]]'s list — the one it names as most commonly missed.
   *
   * Not about cost. An unbounded outbound node makes this API a free, credible
   * traffic source pointed at whatever address a tenant types: the request comes
   * from our IP, with our reputation, and the tenant is the only one who knows
   * it was them. A ceiling is what keeps that a bug rather than a service.
   */
  MAX_DAILY_OUTBOUND_REQUESTS: 500,
} as const;

/** Outbox worker behaviour. */
export const QUEUE_SETTINGS = {
  /** The floor. An in-process nudge on enqueue makes the common case
   *  sub-second; this is what covers a missed nudge and a second instance. */
  POLL_INTERVAL_MS: 5_000,
  CLAIM_BATCH_SIZE: 20,
  MAX_ATTEMPTS: 5,
  /** 30s → 1m → 2m → 4m → 8m, then dead letter. */
  BACKOFF_BASE_MS: 30_000,
  BACKOFF_MAX_MS: 8 * 60 * 1000,
  /** A row left in `processing` this long is assumed orphaned by a dead
   *  process and returned to `pending`. */
  STALE_PROCESSING_MS: 5 * 60 * 1000,
  /** How often the recovery sweep runs. Well under STALE_PROCESSING_MS, so an
   *  orphaned row waits at most one stale window plus one sweep, not two. */
  RECOVERY_INTERVAL_MS: 60_000,
  /**
   * Batches one wake-up may drain before yielding.
   *
   * Without a cap a backlog would hold one tick open indefinitely; without a
   * drain loop a burst of 200 events would wait a full poll interval per batch
   * of 20, so the last one lands 50 seconds late. Ten batches is 200 events per
   * wake-up, which is a burst nobody notices.
   */
  MAX_BATCHES_PER_DRAIN: 10,
} as const;

/** Delay resume worker. */
export const RESUME_SETTINGS = {
  TICK_INTERVAL_MS: 60_000,
  CLAIM_BATCH_SIZE: 10,
} as const;

/**
 * Retention. Planned on day one because `node_execution_logs` grows one row per
 * node per run and is the fastest-growing table in the system.
 */
export const RETENTION = {
  NODE_LOG_DAYS: 90,
  QUEUE_COMPLETED_DAYS: 7,
  /** Longer, because an operator needs time to notice a dead letter. */
  QUEUE_FAILED_DAYS: 30,
  TRIGGER_EVALUATION_DAYS: 7,
  /** Keep the active version, the N most recent, and any version with a
   *  non-terminal run. */
  KEEP_RECENT_VERSIONS: 10,
  /**
   * How long a run may sit waiting on a goal that never happens.
   *
   * Without a ceiling, one goal nobody ever meets strands its run — and its
   * subject — permanently: `resume_at` is NULL for a goal wait, so the resume
   * worker never touches it and nothing else would. Cancelled rather than
   * completed, because "we gave up waiting" is not the same as "the goal was
   * met", and the run history has to be able to tell them apart.
   */
  GOAL_WAIT_DAYS: 30,
} as const;

export function backoffMs(attempts: number): number {
  const raw = QUEUE_SETTINGS.BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(raw, QUEUE_SETTINGS.BACKOFF_MAX_MS);
}
