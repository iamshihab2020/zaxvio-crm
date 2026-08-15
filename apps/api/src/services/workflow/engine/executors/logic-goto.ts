/**
 * `logic.goto` — continue the run from a different step.
 *
 * The executor does not move anything. It resolves which node to continue at and
 * returns it as `jumpTo`; the traverser performs the jump, because only the
 * traverser holds `visited` — and a backwards jump that does not clear those
 * marks re-enqueues nodes that have already run, gets them dropped by the
 * revisit guard, and produces a **completed run with half its steps missing and
 * no error anywhere**. That is the failure this split exists to make
 * unwriteable.
 *
 * `MAX_GOTO_JUMPS` is enforced there too, for the same reason: an executor sees
 * one invocation and has nowhere to count.
 */

import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const logicGoto: Executor = async ({ params, node }) => {
  const target =
    typeof params.targetNodeId === "string" ? params.targetNodeId.trim() : "";

  if (!target) {
    throw new NodeFailure(
      `logic.goto has no target on ${node.id}`,
      `"${node.label}" does not say which step to jump to. Open it and pick one.`,
    );
  }

  // Pointing at itself is an immediate infinite loop that `MAX_GOTO_JUMPS`
  // would catch five steps later with a message about two steps pointing at
  // each other — true, and unhelpful when the answer is "this one".
  if (target === node.id) {
    throw new NodeFailure(
      `logic.goto points at itself on ${node.id}`,
      `"${node.label}" jumps to itself, which would never move on. Pick a different step.`,
    );
  }

  // A target that is not in this version's graph is left to the traverser, which
  // already treats an edge into a missing node as "stop this branch" rather than
  // as a failure — the version snapshot is immutable, so a missing node means
  // the graph was saved inconsistently, and a red run helps nobody.
  return { jumpTo: target, output: { jumpedTo: target } };
};

export default logicGoto;
