/**
 * The shape of a branching node's outputs, in one place.
 *
 * A node with dynamic outputs is described in three voices that must agree: the
 * definition (which draws the handles), the executor (which names the ones it
 * leaves by) and the validator (which checks nothing is left dangling). If each
 * worked out the handle ids for itself, a run could fan out into a handle the
 * canvas never drew — edges wired to nothing, and a run that reports success
 * having done half of what it was asked.
 *
 * So the ids are computed **here**, and all three import them. The registry
 * modules are not re-exported from the package index, which is the practical
 * reason this is not simply a helper next to the definition.
 */

/** 2–5. Two is the point of the node; beyond five a canvas stops being readable. */
export const MIN_BRANCHES = 2;
export const MAX_BRANCHES = 5;

/**
 * Clamp whatever is stored to a whole number of branches.
 *
 * Total by construction, because this runs on every render in the builder —
 * including while the author is mid-keystroke and the field holds `""`, `"1"`
 * or `"abc"`. Returning nothing for a moment would unmount the handles and
 * take the edges attached to them with it.
 */
export function branchCount(parameters: Record<string, unknown>): number {
  const raw = parameters.branchCount;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n)) return MIN_BRANCHES;
  return Math.min(MAX_BRANCHES, Math.max(MIN_BRANCHES, Math.trunc(n)));
}

/**
 * `branch1`, `branch2`, … — stable ids, one per branch.
 *
 * Numbered rather than derived from a label so that renaming means nothing and
 * **reducing the count orphans the last branch rather than renumbering the
 * survivors**. Renumbering would silently re-point every remaining edge one
 * branch to the left, which is the kind of change an author cannot see.
 */
export function branchHandles(parameters: Record<string, unknown>): string[] {
  return Array.from({ length: branchCount(parameters) }, (_unused, i) => `branch${i + 1}`);
}
