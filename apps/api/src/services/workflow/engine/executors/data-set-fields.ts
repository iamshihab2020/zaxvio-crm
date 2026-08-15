/**
 * `data.setFields` — remember a value for the rest of the run.
 *
 * Writes into `ctx.vars`, which every later step reads as `{{vars.name}}`. The
 * plumbing has existed since P3 — `ExecutionContext.vars` is documented as
 * *"written by `data.setFields`"* — and **nothing wrote to it**, so
 * `{{vars.anything}}` resolved to nothing for every automation ever built,
 * silently, because an unresolved token substitutes `""`. This is that writer.
 */

import { assertName } from "./data-shared.js";
import type { Executor } from "./types.js";

const dataSetFields: Executor = async ({ ctx, params, node }) => {
  // `keyValue` persists as an array of `{key, value}` rows, which is what keeps
  // the order the author put them in. An object would not.
  const rows = Array.isArray(params.fields) ? params.fields : [];
  const written: Record<string, unknown> = {};

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { key?: unknown; value?: unknown };
    if (typeof entry.key !== "string" || !entry.key.trim()) continue;
    const name = assertName(entry.key.trim(), node.label);
    // Already interpolated by the time it arrives — an executor never resolves.
    written[name] = entry.value ?? "";
    ctx.vars[name] = written[name];
  }

  if (Object.keys(written).length === 0) {
    return { skipped: "This step had no values filled in, so nothing was stored." };
  }

  return { output: { stored: Object.keys(written), values: written } };
};

export default dataSetFields;
