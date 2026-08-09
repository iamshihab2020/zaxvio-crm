/**
 * The filter operators. One closed set, one implementation, shared by trigger
 * matching, `condition.if` and goal filters.
 *
 * The system this was ported from hand-codes filtering per event family across
 * 3,146 lines, so adding a filter to one trigger gives it to no other and a
 * missing branch means a filter the user configured **does nothing at all** —
 * silently, and in the direction of firing on everything. One generic evaluator
 * is what makes that unexpressible, and one matrix test covers all of it.
 *
 * ## `isUnset` is the load-bearing function in this file
 *
 * The builder persists every property, so an unconfigured filter is
 * *present-but-empty*, not absent. Getting this wrong makes every automation
 * fire on everything or on nothing — and the failure is invisible, because the
 * editor shows exactly what the user configured either way.
 *
 * **`0` and `false` are values.** A "minimum total: 0" filter read as unset is
 * the concrete bug: it would either match everything or nothing depending on
 * which way the mistake went, and neither is what the form said.
 */

import type { FilterOperator } from "../node-definition.js";

/**
 * Does the user have no opinion on this filter?
 *
 * `"__any__"` is included because a `<Select>` cannot hold `undefined` — the
 * "Any" row in a dropdown has to carry *some* value, and an empty string is
 * indistinguishable from a cleared field.
 */
export function isUnset(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "" || value === "__any__";
  if (Array.isArray(value)) return value.length === 0;
  // Deliberately absent: `0`, `false`, `NaN`. All three are answers.
  return false;
}

/**
 * Dotted lookup into a payload, with **own-property checks only**.
 *
 * `in` and bare bracket access both walk the prototype chain, so a `filter.path`
 * of `constructor` would resolve to a function and compare truthy. Payload
 * paths come from node definitions rather than from users, so this is defence
 * in depth — but the same helper backs `condition.if`, where the path *is*
 * user-chosen.
 */
export function getPath(source: unknown, path: string): unknown {
  if (!path) return source;
  let current = source;
  for (const segment of path.split(".")) {
    if (current === null || typeof current !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Apply one operator.
 *
 * Returns `false` for a comparison that cannot be made — a `greaterThan`
 * against a non-number, a `dateBefore` against a non-date. **Not `true`**: an
 * unanswerable question is not a match, and the opposite default would make a
 * malformed filter fire on everything, which is the loudest possible way to be
 * wrong.
 */
export function applyOperator(
  operator: FilterOperator,
  actual: unknown,
  configured: unknown,
): boolean {
  switch (operator) {
    case "equals":
      return looseEquals(actual, configured);
    case "notEquals":
      return !looseEquals(actual, configured);

    case "contains":
      return text(actual).includes(text(configured));
    case "notContains":
      return !text(actual).includes(text(configured));
    case "startsWith":
      return text(actual).startsWith(text(configured));
    case "endsWith":
      return text(actual).endsWith(text(configured));

    case "greaterThan":
      return compareNumbers(actual, configured, (a, b) => a > b);
    case "greaterThanOrEqual":
      return compareNumbers(actual, configured, (a, b) => a >= b);
    case "lessThan":
      return compareNumbers(actual, configured, (a, b) => a < b);
    case "lessThanOrEqual":
      return compareNumbers(actual, configured, (a, b) => a <= b);

    case "between": {
      // `[min, max]`, and both ends are inclusive. An exclusive `between` is a
      // thing nobody means when they type two numbers into two boxes.
      if (!Array.isArray(configured) || configured.length !== 2) return false;
      const value = toNumber(actual);
      const min = toNumber(configured[0]);
      const max = toNumber(configured[1]);
      if (value === null || min === null || max === null) return false;
      return value >= min && value <= max;
    }

    case "isEmpty":
      return isEmptyValue(actual);
    case "isNotEmpty":
      return !isEmptyValue(actual);

    // Strict. A filter that says "is true" must not match the string "false",
    // which is truthy, or the number 0, which is not a boolean at all.
    case "isTrue":
      return actual === true;
    case "isFalse":
      return actual === false;

    case "inList":
      return toList(configured).some((item) => looseEquals(actual, item));
    case "notInList":
      return !toList(configured).some((item) => looseEquals(actual, item));

    case "dateBefore":
      return compareDates(actual, configured, (a, b) => a < b);
    case "dateAfter":
      return compareDates(actual, configured, (a, b) => a > b);

    case "dateWithinNext": {
      // `configured` is a number of days. "Within the next 7 days" excludes
      // dates already past — a warranty that expired last month is not
      // expiring soon, and treating it as such is how a renewal automation
      // mails somebody about a contract that ended in March.
      const days = toNumber(configured);
      const target = toTime(actual);
      if (days === null || target === null) return false;
      const now = Date.now();
      return target >= now && target <= now + days * 86_400_000;
    }
    case "dateWithinLast": {
      const days = toNumber(configured);
      const target = toTime(actual);
      if (days === null || target === null) return false;
      const now = Date.now();
      return target <= now && target >= now - days * 86_400_000;
    }

    case "isToday": {
      // Compared as `YYYY-MM-DD` strings rather than by timestamp arithmetic.
      // A `date` column *is* a calendar day with no zone, and converting one
      // into an instant is the mistake that shifted the E-05 completion email
      // by a day.
      const value = dateOnly(actual);
      return value !== null && value === dateOnly(new Date().toISOString());
    }

    default:
      // Exhaustive over a closed union. A new operator that reaches here is a
      // compile error at the switch, not a silent `false` in production.
      return assertNever(operator);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coercion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loose on purpose.
 *
 * Money arrives from Postgres as the string `"1250.00"` and a form sends the
 * number `1250`; a stage id is a UUID string on both sides. Strict equality
 * would make "job total equals 1250" never match, and the user has no way to
 * know which side stringified.
 *
 * Numbers compare numerically when both sides parse; everything else compares
 * as trimmed strings. `null`/`undefined` never equal anything, including each
 * other — "not set" is not a value to match against, it is `isEmpty`.
 */
function looseEquals(actual: unknown, configured: unknown): boolean {
  if (actual === null || actual === undefined) return false;
  if (configured === null || configured === undefined) return false;
  if (typeof actual === "boolean" || typeof configured === "boolean") {
    return actual === configured;
  }

  const a = toNumber(actual);
  const b = toNumber(configured);
  if (a !== null && b !== null) return a === b;

  return text(actual) === text(configured);
}

function compareNumbers(
  actual: unknown,
  configured: unknown,
  compare: (a: number, b: number) => boolean,
): boolean {
  const a = toNumber(actual);
  const b = toNumber(configured);
  if (a === null || b === null) return false;
  return compare(a, b);
}

function compareDates(
  actual: unknown,
  configured: unknown,
  compare: (a: number, b: number) => boolean,
): boolean {
  const a = toTime(actual);
  const b = toTime(configured);
  if (a === null || b === null) return false;
  return compare(a, b);
}

/**
 * A number, or null.
 *
 * An empty string is **not** zero. `Number("")` is `0`, which would make
 * "total greater than -1" match a job with no total — a filter answering a
 * question about a value that does not exist.
 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Milliseconds, or null. A bare `YYYY-MM-DD` anchors at UTC noon. */
function toTime(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }
  if (typeof value !== "string" || value.trim() === "") return null;

  // Anchoring a date-only string at noon rather than midnight is what stops it
  // landing on the previous day in any negative-offset zone.
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value.trim())
    ? `${value.trim()}T12:00:00Z`
    : value;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** The `YYYY-MM-DD` part of a date or datetime string, or null. */
function dateOnly(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim().toLowerCase();
  return String(value).trim().toLowerCase();
}

/** A configured value that may be a single item or a list. */
function toList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === null || value === undefined ? [] : [value];
}

/**
 * Empty, for `isEmpty`/`isNotEmpty`.
 *
 * Distinct from `isUnset`: that one asks whether the **author** configured a
 * filter, this one asks whether the **record's** value is blank. `0` is not
 * empty here either — an invoice with a zero balance has a balance.
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled filter operator: ${String(value)}`);
}
