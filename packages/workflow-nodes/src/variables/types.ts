import type { SubjectType } from "../node-definition.js";
import type { ExecutionContext } from "../execution-context.js";

/**
 * One variable, declared once.
 *
 * The resolver map, the picker, the "did you mean" suggestions, the reference
 * documentation and the registry test are all **derived from this array**. The
 * reference implementation kept a path list and a resolver map — roughly 700
 * entries each — in sync by convention, and the two failure modes were exactly
 * what you would predict: a path declared but not mapped resolved to `""`, and
 * a path mapped but not declared worked and never appeared in the picker.
 * Deriving one from the other removes the entire class of "the variable is in
 * the dropdown but comes out blank".
 */
export interface VariableDef {
  /**
   * IMMUTABLE. Saved automations, seeded templates and exported data reference
   * this exact string, so it is a permanent public API. New paths are fine;
   * renames and removals are not. Same rule as node ids, same test.
   */
  path: string;
  /** Freely renameable — this is display only. */
  label: string;
  description: string;
  type:
    | "string"
    | "number"
    | "money"
    | "boolean"
    | "date"
    | "datetime"
    | "time"
    | "array"
    | "object";

  /**
   * How to render it, **declared rather than inferred from the value's shape**.
   * The reference implementation guessed and rendered a ten-digit Google Ads
   * campaign id as `(123) 456-7890`.
   */
  format?: "phone" | "money" | "date" | "datetime" | "time" | "percent" | "titleCase" | "list";

  /** Which subject types provide it. Scopes the picker so a booking-triggered
   *  automation is not offered `{{invoice.balanceDue}}`. */
  providedBy?: SubjectType[];
  /** Or: which trigger events provide it, for `trigger.*`. */
  providedByEvent?: string[];

  /**
   * Default output encoding. Declared with the variable rather than chosen at
   * each call site — a node that forgot to pass one silently got `none` in the
   * system this was ported from.
   */
  encoding?: "none" | "html" | "url";

  /** A realistic value, shown in the picker. Not a placeholder: the sample is a
   *  promise about what the email will actually say. */
  sample: string;

  /** THE implementation. There is no second hand-written map. */
  resolve: (ctx: ExecutionContext) => unknown;
}

/**
 * Namespaces whose members cannot be enumerated ahead of time.
 *
 * `previous.*` depends on what nodes the author added, `vars.*` on what they
 * named, `trigger.*` on the event's payload, `loop.*` on the list. These
 * resolve by walking the object rather than through the declared map, and the
 * resolver has to know which prefixes are allowed to do that — an open fallback
 * is how `{{constructor.prototype}}` becomes reachable.
 */
export const DYNAMIC_NAMESPACES = ["previous", "vars", "trigger", "loop"] as const;
export type DynamicNamespace = (typeof DYNAMIC_NAMESPACES)[number];
