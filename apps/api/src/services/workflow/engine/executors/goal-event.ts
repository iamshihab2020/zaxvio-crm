/**
 * `goal.event` — the run has nothing left to do but wait for the goal.
 *
 * **This executor does not register the watch.** `execute()` does that at run
 * start, before traversal (step 7), and the ordering is the entire feature: a
 * goal must be watching *while* the chase runs. Registering it here would mean
 * the watch only goes live once the chain reaches this node — after the last
 * email — which is far too late for "stop the moment they accept" to mean
 * anything.
 *
 * So by the time this runs, the listener already exists. What is left is the
 * parking: the node has no outputs, so there is nothing below it, and the run
 * is not finished — it is watching. `GoalWait` makes `handleTerminal` pause it
 * with **`resume_at` NULL**, which is what keeps the resume worker away from
 * it: `resume_at` is a clock, and a goal wait has no clock. Only a matching
 * event ends it, or the 30-day reaper gives up on it.
 *
 * A goal placed mid-chain therefore ends that branch and parks the run. That is
 * the honest reading of a step with no outputs, and it is why the node renders
 * with zero handles (D-04) rather than one that leads nowhere.
 */

import { GoalWait, NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

const goalEvent: Executor = async ({ params, node }) => {
  const goal = typeof params.goalEvent === "string" ? params.goalEvent : "";

  if (!goal) {
    // Publish blocks an empty `goalEvent`, so reaching this means a graph saved
    // before the field was required, or one hand-built over the API.
    throw new NodeFailure(
      "goal.event has no event",
      `The "${node.label}" step doesn't say what it's waiting for. Open it and choose something.`,
    );
  }

  throw new GoalWait(node.id, goal);
};

export default goalEvent;
