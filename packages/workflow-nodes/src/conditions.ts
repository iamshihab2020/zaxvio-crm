/**
 * Conditions — what `condition.if` evaluates.
 *
 * **The same closed operator set as trigger filters**, not a parallel one. That
 * is the whole reason `FILTER_OPERATORS` is closed: one matrix test covers
 * filtering everywhere in the product, and a user who has learned what
 * "is empty" means on a trigger has learned it for conditions too. The system
 * this was ported from grew a second comparison implementation for its IF node,
 * and the two disagreed about blank values.
 *
 * Pure and dependency-free, so the browser evaluates a preview with exactly the
 * function the engine runs.
 */

import { applyOperator, isUnset } from "./triggers/operators.js";
import type { FilterOperator } from "./node-definition.js";

/** Operators that ask about presence, so they need no configured value. */
export const UNARY_OPERATORS: readonly FilterOperator[] = [
  "isEmpty",
  "isNotEmpty",
  "isTrue",
  "isFalse",
  "isToday",
] as const;

export function isUnaryOperator(operator: FilterOperator): boolean {
  return UNARY_OPERATORS.includes(operator);
}

export interface ConditionRule {
  /** A variable path — `invoice.totalAmount`, not `{{invoice.totalAmount}}`. */
  variable: string;
  operator: FilterOperator;
  /** Absent for the unary operators above. */
  value?: unknown;
}

export type Combinator = "and" | "or";

/**
 * Resolve a variable path to its raw value.
 *
 * `found: false` means the path is not a variable at all — a typo, or one this
 * trigger cannot provide. Distinct from a variable that exists and is empty,
 * which is a legitimate thing to test for with `isEmpty`.
 */
export type ResolveVariable = (path: string) => { found: boolean; value: unknown };

export interface ConditionOutcome {
  passed: boolean;
  /** Per-rule results, so a run log can say *which* rule decided it. */
  results: {
    variable: string;
    operator: FilterOperator;
    actual: unknown;
    passed: boolean;
    /** Set when the path resolved to nothing declared. */
    unresolved?: boolean;
  }[];
}

/**
 * Evaluate a set of rules.
 *
 * Two rules about failure, both deliberate:
 *
 * - **An unresolvable variable fails its rule.** Not throws, not passes. A path
 *   the run cannot resolve is a question that cannot be answered, and the
 *   answer to an unanswerable question is never "yes" — the same rule the
 *   trigger matcher follows. It is reported in `results` so the run log can
 *   name it rather than leaving a silent false.
 * - **No rules fails.** "And" over an empty set is vacuously true in logic and
 *   would be a trap here: a condition step nobody finished configuring would
 *   send everything down the Yes branch. Publish blocks an empty rule list
 *   anyway, so this is the belt to that braces.
 */
export function evaluateConditions(
  rules: ConditionRule[],
  combinator: Combinator,
  resolve: ResolveVariable,
): ConditionOutcome {
  if (rules.length === 0) return { passed: false, results: [] };

  const results = rules.map((rule) => {
    const { found, value } = resolve(rule.variable);

    if (!found) {
      return {
        variable: rule.variable,
        operator: rule.operator,
        actual: undefined,
        passed: false,
        unresolved: true,
      };
    }

    // A binary operator with nothing to compare against is unconfigured, not
    // "compare with empty" — `0` and `false` ARE values, so this cannot be a
    // falsiness check.
    if (!isUnaryOperator(rule.operator) && isUnset(rule.value)) {
      return {
        variable: rule.variable,
        operator: rule.operator,
        actual: value,
        passed: false,
      };
    }

    return {
      variable: rule.variable,
      operator: rule.operator,
      actual: value,
      passed: applyOperator(rule.operator, value, rule.value),
    };
  });

  const passed =
    combinator === "and"
      ? results.every((r) => r.passed)
      : results.some((r) => r.passed);

  return { passed, results };
}

/** Narrow unknown config into rules, dropping anything malformed. */
export function parseConditionRules(value: unknown): ConditionRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (rule): rule is ConditionRule =>
      !!rule &&
      typeof rule === "object" &&
      typeof (rule as ConditionRule).variable === "string" &&
      typeof (rule as ConditionRule).operator === "string",
  );
}
