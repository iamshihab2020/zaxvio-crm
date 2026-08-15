/**
 * `logic.loop` — run the body once per item.
 *
 * The executor resolves the list and returns it; the traverser iterates it,
 * because the body is a **subgraph** and the thing that knows how to walk a
 * subgraph is the walker. It is also the only place that can clear `visited`
 * between passes, without which the second iteration would execute nothing and
 * the run would complete looking as though it had.
 *
 * ## The raw value, not the rendered one
 *
 * `resolveVariable`, not interpolation — interpolation stringifies for a human,
 * and a list rendered for a human is `"Item A, Item B"`, which is one string, not
 * two items. `formatList` exists precisely to do that on purpose elsewhere.
 *
 * ## A non-list is a config problem, an empty list is not
 *
 * They fail differently on purpose. A path that resolves to a number means the
 * author picked the wrong variable and only they can fix it, so it fails loudly.
 * A list that is genuinely empty — a job with no line items — is the ordinary
 * case, runs the body zero times, and continues at `done`. Failing on that would
 * make every loop need an Only-if in front of it.
 */

import { EXECUTION_LIMITS } from "@hvac-saas/workflow-nodes";
import { resolveVariable } from "../interpolate.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const logicLoop: Executor = async ({ ctx, params, node }) => {
  const path =
    typeof params.listVariable === "string" ? params.listVariable.trim() : "";

  if (!path) {
    throw new NodeFailure(
      `logic.loop has no list on ${node.id}`,
      `"${node.label}" does not say what to repeat over. Open it and pick a list.`,
    );
  }

  const resolved = resolveVariable(path, ctx);

  if (!resolved.found) {
    throw new NodeFailure(
      `logic.loop variable not found on ${node.id}: ${path}`,
      `"${node.label}" is set to repeat over "${path}", which this automation cannot read. Check it against what the trigger provides.`,
    );
  }

  if (!Array.isArray(resolved.value)) {
    throw new NodeFailure(
      `logic.loop got a non-list on ${node.id}`,
      `"${node.label}" is set to repeat over "${path}", but that is a single value rather than a list. Pick something that holds several things — a job's line items, a customer's assets.`,
    );
  }

  const total = resolved.value.length;
  const truncated = total > EXECUTION_LIMITS.MAX_LOOP_ITERATIONS;

  // Said out loud rather than silently taking the first N. A run that processed
  // 500 of 900 and reported success is the shape of failure this project keeps
  // finding — the retention sweep, the report row cap, the bulk bar — and the
  // fix each time was to name what was dropped.
  return {
    loopItems: resolved.value,
    output: {
      total,
      ran: truncated ? EXECUTION_LIMITS.MAX_LOOP_ITERATIONS : total,
      truncated,
    },
    ...(truncated
      ? {
          skipped: `That list had ${total} items and an automation can only repeat ${EXECUTION_LIMITS.MAX_LOOP_ITERATIONS} times, so the rest were left out.`,
        }
      : {}),
  };
};

export default logicLoop;
