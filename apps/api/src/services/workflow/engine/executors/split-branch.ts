/**
 * `split.branch` — leave by every branch, not one.
 *
 * The first executor to return `handles` rather than `handle`. It decides
 * nothing and touches nothing; the fan-out is entirely in which outputs it
 * names, exactly as `condition.if`'s branching is entirely in which one it
 * names. That symmetry is the point — the traverser gained a set membership
 * test and no new node kind.
 *
 * Branch ids come from the shared `branchCount` helper rather than being
 * recomputed here. The definition and the executor disagreeing about how many
 * branches there are would produce handles nothing is wired to: the run would
 * fan out into nowhere and report success, which is the failure mode the
 * definition↔executor scanner exists to catch.
 */

import { branchHandles } from "@hvac-saas/workflow-nodes";
import type { Executor } from "./types.js";

const splitBranch: Executor = async ({ params }) => {
  const handles = branchHandles(params);

  return {
    handles,
    // Recorded so the run log can say "fanned out into 3 branches" rather than
    // leaving a step that visibly did nothing. A split is the one node whose
    // whole contribution is invisible in its own row.
    output: { branches: handles.length },
  };
};

export default splitBranch;
