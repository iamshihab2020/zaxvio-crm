/**
 * `logic.switch` — route by a value.
 *
 * ## Resolves the raw value, not the rendered one
 *
 * `resolveVariable` — the **raw** resolver — rather than interpolation, for the same reason
 * `condition.if` does it: interpolation renders values **for people**. A money
 * amount comes back as "$1,250.00" and a date as "12 Aug", and routing on a
 * localised display string means a route configured as `1250` matches nothing
 * and the run silently takes Otherwise.
 *
 * ## Comparison is string-wise, deliberately
 *
 * Every route value is typed into a text box, so it is a string. Comparing the
 * resolved value as a string means `status` = `"sent"` works, and `daysOverdue`
 * = `"7"` works too. What it does *not* do is guess: `"7.0"` does not match `7`,
 * and that is better than a coercion rule nobody can predict from looking at the
 * panel. Trimmed and case-insensitive, because a route typed as "Sent" against a
 * status of "sent" is a typo the author cannot see.
 *
 * ## No match is not a failure
 *
 * With no Otherwise route the branch simply ends. A Switch is a routing table,
 * and "none of these applied" is an ordinary answer — making it an error would
 * force every Switch over an open-ended value to carry a do-nothing branch just
 * to publish. The run log records which route was taken, or that none was.
 */

import { resolveVariable } from "../interpolate.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

/** One row of the routes table, as `keyValue` persists it. */
interface Route {
  key?: unknown;
  value?: unknown;
}

function normalise(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim().toLowerCase();
}

const logicSwitch: Executor = async ({ ctx, params, node }) => {
  const path = typeof params.variable === "string" ? params.variable.trim() : "";
  if (!path) {
    throw new NodeFailure(
      `logic.switch has no variable on ${node.id}`,
      `"${node.label}" does not say what to look at. Open the step and pick a value to route on.`,
    );
  }

  const rows: Route[] = Array.isArray(params.routes)
    ? params.routes.filter((r): r is Route => !!r && typeof r === "object")
    : [];

  if (rows.length === 0) {
    // Publish should have caught this — `required` covers an empty list. If it
    // reaches here the config was written by something other than the builder,
    // and failing loudly is better than silently ending the branch.
    throw new NodeFailure(
      `logic.switch has no routes on ${node.id}`,
      `"${node.label}" has no routes set up, so there was nowhere for the run to go.`,
    );
  }

  const resolved = resolveVariable(path, ctx);
  // `found: false` is a path that does not exist — a typo, or one this trigger
  // cannot provide. The validator now catches that at publish, so reaching it
  // here means the graph predates the check. Treated as "matches nothing",
  // which is the same answer an unanswerable comparison gets in `condition.if`.
  const actual = normalise(resolved.found ? resolved.value : undefined);

  for (const [index, row] of rows.entries()) {
    if (normalise(row.value) === actual) {
      return {
        handle: `route${index}`,
        output: {
          matched: true,
          route: typeof row.key === "string" ? row.key : `Route ${index + 1}`,
          value: resolved.value ?? null,
        },
      };
    }
  }

  if (params.fallback === true) {
    return {
      handle: "otherwise",
      output: { matched: false, route: "Otherwise", value: resolved.value ?? null },
    };
  }

  // An empty handle list ends this branch without ending the run — the shape
  // `ExecutorOutput.handles` documents for exactly this case.
  return {
    handles: [],
    output: { matched: false, route: null, value: resolved.value ?? null },
    skipped: `Nothing matched "${actual || "(empty)"}", and there is no Otherwise route, so this branch stopped here.`,
  };
};

export default logicSwitch;
