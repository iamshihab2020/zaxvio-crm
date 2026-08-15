import { getDb } from "@hvac-saas/database";

/**
 * The whole integration-test story: run against the real database, commit
 * nothing.
 *
 * Every test body runs inside a transaction that is unconditionally rolled
 * back, so tests exercise real constraints — foreign keys, partial unique
 * indexes, generated columns, `FOR UPDATE SKIP LOCKED` — against real Postgres,
 * and leave the database exactly as they found it. No truncate step, no
 * fixtures to clean up, no ordering dependency between suites.
 *
 * This is only possible because the services in this repo already accept a
 * transaction handle: `lib/tenant-guards.ts` types its `Db` as
 * `Omit<ReturnType<typeof getDb>, "$client">` precisely so a `PgTransaction`
 * satisfies it. That decision was made for the quote→job conversion; this is
 * the second payoff.
 *
 * The one thing it cannot test is behaviour *across* transactions — two
 * connections racing for the same row. Those tests use `withCleanup` below and
 * delete after themselves.
 */

export type TestDb = Omit<ReturnType<typeof getDb>, "$client">;

/** Thrown to force the rollback. Never escapes `withRollback`. */
class RollbackSignal extends Error {
  constructor() {
    super("test rollback");
    this.name = "RollbackSignal";
  }
}

export async function withRollback<T>(fn: (db: TestDb) => Promise<T>): Promise<T> {
  const db = getDb();
  let result!: T;
  let captured: unknown;

  try {
    await db.transaction(async (tx) => {
      try {
        result = await fn(tx);
      } catch (err) {
        // Hold the real failure: the rollback below would otherwise replace it
        // with "test rollback" and the test would report the wrong cause.
        captured = err;
      }
      throw new RollbackSignal();
    });
  } catch (err) {
    if (!(err instanceof RollbackSignal)) throw err;
  }

  if (captured !== undefined) throw captured;
  return result;
}

/** Thrown when an operation that was supposed to violate a constraint didn't. */
class NoViolationSignal extends Error {
  constructor() {
    super("expected a constraint violation");
    this.name = "NoViolationSignal";
  }
}

/**
 * Assert that an operation violates a specific constraint, **without killing
 * the surrounding transaction**.
 *
 * Postgres aborts the whole transaction on any error — every subsequent
 * statement returns `25P02: current transaction is aborted`. So inside
 * `withRollback`, a test that deliberately triggers a `23505` cannot then go on
 * to assert anything else, which is exactly what a schema test wants to do
 * ("a duplicate is refused, but a legitimate second row is not").
 *
 * Wrapping the failing statement in a nested `transaction()` makes Drizzle emit
 * a SAVEPOINT, so the rollback undoes only that statement and the outer
 * transaction stays usable.
 *
 * @param code SQLSTATE, e.g. "23505" unique, "23503" foreign key, "23502" not null
 */
export async function expectViolation(
  db: TestDb,
  code: string,
  fn: (db: TestDb) => Promise<unknown>,
): Promise<void> {
  let captured: unknown;

  try {
    await db.transaction(async (savepoint) => {
      await fn(savepoint);
      throw new NoViolationSignal();
    });
  } catch (err) {
    captured = err;
  }

  if (captured instanceof NoViolationSignal) {
    throw new Error(
      `Expected the operation to fail with SQLSTATE ${code}, but it succeeded. ` +
        `The constraint is missing or does not cover this case.`,
    );
  }

  const actual = pgErrorCode(captured);
  if (actual !== code) {
    throw new Error(
      `Expected SQLSTATE ${code}, got ${actual ?? "a non-Postgres error"}: ` +
        `${captured instanceof Error ? captured.message : String(captured)}`,
    );
  }
}

/** SQLSTATE off a Drizzle-wrapped postgres-js error. */
export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code ?? e?.cause?.code;
}

/**
 * For the handful of tests that genuinely need committed rows — concurrency
 * against two connections, mainly. Registers cleanup that runs even when the
 * body throws.
 *
 * Prefer `withRollback`. Reach for this only when the thing under test is
 * *transaction visibility itself*.
 */
export async function withCleanup<T>(
  fn: (db: ReturnType<typeof getDb>, onCleanup: (f: () => Promise<void>) => void) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const cleanups: (() => Promise<void>)[] = [];
  try {
    return await fn(db, (f) => cleanups.push(f));
  } finally {
    // Reverse order, so a child is removed before its parent.
    for (const f of cleanups.reverse()) {
      await f().catch((err) => {
        console.error("[test] cleanup failed — the database may be dirty:", err);
      });
    }
  }
}
