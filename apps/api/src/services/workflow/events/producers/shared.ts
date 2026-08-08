/**
 * Producer argument shapes.
 *
 * ## The rule this directory exists to enforce
 *
 * > **Never spread a database row into a payload.**
 *
 * Not a style preference. The reference implementation spread a raw ORM row
 * into an event; the row used `pipeline_stage_id` and the consumer read
 * `stageId`, both sides typed `Record<string, unknown>`, and every automation
 * that filtered on stage was dead in production for months while its unit test
 * stayed green.
 *
 * A spread also leaks: `...job` puts `notes`, `address` and every internal
 * column into a queue row that fans out per subscriber and into every trigger
 * evaluation record. Explicit field lists are the only construction here, and
 * a test over this directory (`src/test/workflow-producers.test.ts`) makes that
 * mechanical rather than remembered — it fails on any `...` in any file here.
 *
 * The interfaces below are **arguments**, not payloads. They are what a caller
 * has in hand at the call site — usually a row it just wrote — and the producer
 * maps them field by field onto the payload. Two shapes on purpose: if they
 * were one, the mapping would be a spread again.
 */

/** A customer, as every producer needs it. */
export interface CustomerArgs {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

/** Common to every producer call. */
export interface ProducerContext {
  tenantId: string;
  /** Null for a cron, a public portal visitor, or another automation. */
  actorUserId: string | null;
}

/**
 * A `numeric` column, as Drizzle returns it, made safe for a payload.
 *
 * Drizzle types `numeric` as `string`, but a nullable column returns `null` and
 * a few older rows predate a `NOT NULL DEFAULT`, so the honest input type is
 * `string | null`. Money on a payload is never null — an absent total is
 * `"0.00"`, because a filter comparing "greater than 100" against null is a
 * question with no good answer, whereas against zero it is simply false.
 *
 * Numbers are accepted and stringified rather than rejected, because a caller
 * computing a difference legitimately has one; `toFixed(2)` is applied so the
 * result always matches the payload's decimal-string shape.
 */
export function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "0.00";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
  }
  return value;
}

/** Same, but preserving "there is no figure" where the payload allows null. */
export function optionalMoney(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  return money(value);
}

/**
 * A `timestamptz` for a payload.
 *
 * Always an ISO string, never a `Date`. A `Date` parses on the way in and comes
 * back out of `jsonb` as a string, so it would pass the producer's parse and
 * fail the worker's — the exact write/read drift the double parse exists to
 * catch, introduced by the producer itself.
 */
export function isoDateTime(value: Date | string | null | undefined): string {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function optionalIsoDateTime(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * A `date` column for a payload.
 *
 * Drizzle returns `date` as a `YYYY-MM-DD` string already, which is what the
 * payload wants — so this is mostly a null-guard. The `Date` branch exists for
 * callers holding a computed date, and it slices the **UTC** ISO string
 * deliberately: `toLocaleDateString` would render in the server's zone, which
 * is how a job scheduled for the 1st gets stamped as the 31st.
 */
export function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/** A `time` column: `HH:MM:SS` or null. */
export function isoTime(value: string | null | undefined): string | null {
  return value ?? null;
}

/**
 * Which fields a PATCH changed.
 *
 * Compares only the keys the caller actually supplied — an absent key is "not
 * mentioned", not "set to undefined". Values are compared loosely on purpose:
 * a `numeric` arrives as a string and a form may send a number for the same
 * column, and reporting `totalAmount` as changed when `"100.00"` became `100`
 * would fire an automation for an edit nobody made.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): string[] {
  const changed: string[] = [];
  for (const key of Object.keys(after)) {
    const next = after[key];
    if (next === undefined) continue;
    const prev = before[key];
    if (prev === next) continue;
    // Dates compare by value, not identity.
    if (prev instanceof Date && next instanceof Date) {
      if (prev.getTime() !== next.getTime()) changed.push(key);
      continue;
    }
    if (prev === null || next === null) {
      changed.push(key);
      continue;
    }
    // eslint-disable-next-line eqeqeq -- deliberate: "100.00" and 100 are the
    // same amount, and reporting that as a change is a false trigger.
    if (prev != next) changed.push(key);
  }
  // The payload caps this at 64. A PATCH touching more columns than that is not
  // something an automation needs enumerated.
  return changed.slice(0, 64);
}

/** Whole days between two dates, or null when either is missing. */
export function daysBetween(
  from: Date | string | null | undefined,
  to: Date | string | null | undefined,
): number | null {
  if (!from || !to) return null;
  const a = from instanceof Date ? from : new Date(from);
  const b = to instanceof Date ? to : new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

/** `"1250.00"` → true when it is zero or less. Money is a string here. */
export function isSettled(balanceDue: string | number | null | undefined): boolean {
  const n = typeof balanceDue === "number" ? balanceDue : Number(balanceDue ?? 0);
  return Number.isFinite(n) && n <= 0;
}
