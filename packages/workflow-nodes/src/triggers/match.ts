/**
 * The declarative filter evaluator.
 *
 * One function walks `definition.properties` where `filter` is present, reads
 * the configured value out of the saved node parameters, reads the actual value
 * at `filter.path` from the **typed** event payload, and applies the operator.
 *
 * Four things this buys against a hand-coded cascade:
 *
 * - Every new trigger gets filtering for free.
 * - One code path to test, and one matrix covers every operator.
 * - A filter cannot silently not apply because somebody forgot a branch.
 * - `failedOn` / `expected` / `actual` go straight into the "why didn't my
 *   automation run?" answer, which is the single most common support question
 *   a feature like this generates.
 */

import type { NodeDefinition } from "../node-definition.js";
import { applyOperator, getPath, isUnset } from "./operators.js";

export interface MatchResult {
  matched: boolean;
  /** The property whose filter refused. Undefined on a match. */
  failedOn?: string;
  /** Its human label, so a diagnostic reads "Only these service types". */
  failedLabel?: string;
  expected?: unknown;
  actual?: unknown;
  /** Which filters were actually applied. Zero means "runs on everything". */
  applied: number;
}

/**
 * Does this event match what the author configured on this trigger node?
 *
 * **An unset filter matches everything.** The builder persists every property,
 * so an unconfigured filter is present-but-empty rather than absent — see
 * `isUnset`, which is the load-bearing function behind this whole file.
 */
export function matchesFilters(
  definition: NodeDefinition,
  parameters: Record<string, unknown>,
  payload: unknown,
): MatchResult {
  let applied = 0;

  for (const property of definition.properties) {
    if (!property.filter) continue;

    const configured = parameters[property.name];
    if (isUnset(configured)) continue;

    applied += 1;

    // `source: "subject"` reads the loaded record instead of the event. Not
    // used by any P3 trigger — the payloads carry what the filters need — and
    // it is declared here rather than silently ignored so a node that sets it
    // fails loudly instead of matching on `undefined`.
    if (property.filter.source === "subject") {
      throw new Error(
        `Filter source "subject" is not supported yet (${definition.node}.${property.name}).`,
      );
    }

    const actual = getPath(payload, property.filter.path);

    if (!applyOperator(property.filter.operator, actual, configured)) {
      return {
        matched: false,
        failedOn: property.name,
        failedLabel: property.displayName,
        expected: configured,
        actual,
        applied,
      };
    }
  }

  return { matched: true, applied };
}

/**
 * A sentence for the run history and for "why didn't this fire?".
 *
 * Written here rather than at the call site so the trigger matcher, the replay
 * page and the builder's dry-run preview all say the same thing — a diagnostic
 * that is phrased three ways is three diagnostics to support.
 */
export function describeMatch(result: MatchResult): string {
  if (result.matched) {
    return result.applied === 0
      ? "Matched — this trigger has no filters, so it runs every time."
      : `Matched all ${result.applied} filter${result.applied === 1 ? "" : "s"}.`;
  }
  return `Skipped: "${result.failedLabel ?? result.failedOn}" didn't match — expected ${format(result.expected)}, but this one was ${format(result.actual)}.`;
}

function format(value: unknown): string {
  if (value === null || value === undefined) return "not set";
  if (Array.isArray(value)) return value.length ? value.join(" or ") : "not set";
  if (value === "") return "empty";
  return String(value);
}
