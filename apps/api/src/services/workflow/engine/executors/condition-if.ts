/**
 * `condition.if` — send the run down one branch or the other.
 *
 * The first executor that returns a `handle` other than `main`, which is the
 * whole mechanism: the traverser already routes on `sourceHandle`, so branching
 * is a node deciding which output it leaves by, not a special case in the walk.
 *
 * **Comparison happens through the shared evaluator**, not here. `condition.if`
 * and trigger filters use one closed operator set and one implementation, so a
 * user who has learned what "is empty" does on a trigger has learned it here.
 * The system this was ported from grew a second comparison for its IF node and
 * the two disagreed about blank values.
 *
 * `params` arrives interpolated, so a rule's *value* may itself contain
 * `{{variables}}` and will already be resolved. The rule's **left side** is a
 * variable path rather than a token, and is resolved raw — a comparison needs
 * the number, not "$1,250.00".
 */

import {
  evaluateConditions,
  parseConditionRules,
  type Combinator,
} from "@hvac-saas/workflow-nodes";
import { resolveVariable } from "../interpolate.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const conditionIf: Executor = async ({ ctx, params, node }) => {
  const rules = parseConditionRules(params.rules);

  if (rules.length === 0) {
    throw new NodeFailure(
      "condition.if has no rules",
      `The "${node.label}" step has no checks set up, so it had no way to decide which path to take.`,
    );
  }

  const combinator: Combinator = params.combinator === "or" ? "or" : "and";

  const outcome = evaluateConditions(rules, combinator, (path) =>
    resolveVariable(path, ctx),
  );

  return {
    // Stable ids, matching the definition's outputs. Never the labels — an edge
    // stores this, so routing must not depend on wording.
    handle: outcome.passed ? "true" : "false",
    // Every rule's actual value and verdict, so the run log can say *which*
    // check decided it rather than only that the automation went left. That is
    // the difference between a branch you can debug and one you cannot.
    output: {
      passed: outcome.passed,
      combinator,
      checks: outcome.results,
    },
  };
};

export default conditionIf;
