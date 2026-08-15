/**
 * What the three data executors share.
 *
 * Split out because the ship gate asserts one executor module per node id, and
 * it is right to: "find the executor for this node" should be a filename.
 *
 * The only three executors that touch no table at all. They read and write
 * `ctx.vars`, which every later step reaches as `{{vars.name}}`.
 *
 * ## `ctx.vars` had a writer declared and none written
 *
 * `ExecutionContext.vars` has carried the comment *"written by
 * `data.setFields`"* since P3, and nothing wrote to it — so `{{vars.anything}}`
 * resolved to nothing for every automation ever built, silently, because an
 * unresolved token substitutes `""`. This is that writer.
 *
 * ## Money is a string, and that is the whole difficulty
 *
 * Every amount in this system comes off a `numeric` column, so it arrives as
 * `"1250.00"`. `Number("1250.00")` is fine; `Number("$1,250.00")` is `NaN`, and
 * a `NaN` that reaches a customer-facing message prints the word. Interpolation
 * *formats* declared variables for humans before an executor ever sees them, so
 * a value pulled from `{{invoice.total}}` may well arrive already carrying a
 * currency symbol and separators. `toNumber` below undoes that, deliberately and
 * narrowly, rather than trusting either shape.
 */

import { NodeFailure } from "../errors.js";

/**
 * Parse a number out of something a human or a `numeric` column produced.
 *
 * Strips currency symbols, thousands separators and spaces — and **only** those.
 * It does not try to be clever about locale: a string with a comma as the
 * decimal mark is not something this system produces, and guessing between
 * `1,5` meaning one-point-five and one-thousand-five is exactly the kind of
 * shape-guessing the interpolator refuses to do.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A name that can appear in `{{vars.x}}`.
 *
 * Bounded and restricted because it becomes a key in a `jsonb` column and a path
 * segment in a template. A name with a dot in it would produce a variable path
 * nobody can address — `{{vars.my.value}}` reads as a nested lookup — and the
 * author would see an empty string with no explanation.
 */
const VALID_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export function assertName(name: unknown, label: string): string {
  if (typeof name !== "string" || !VALID_NAME.test(name)) {
    throw new NodeFailure(
      `Invalid variable name in ${label}`,
      `"${label}" needs a name made of letters, numbers and underscores, starting with a letter — that is what makes it usable later as {{vars.yourName}}.`,
    );
  }
  return name;
}

