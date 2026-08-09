/**
 * `logic.merge` — the executor that does nothing, on purpose.
 *
 * The node's entire behaviour is in the traverser: `isReady` will not let it run
 * until every incoming edge has been satisfied, and `visited` will not let it
 * run twice. By the time this function is called, both facts are already true.
 *
 * It exists because the engine dispatches by node id, and a node in
 * `ACTIVE_NODES` without an executor is what the ship gate is there to prevent.
 */

import type { Executor } from "./types.js";

const logicMerge: Executor = async () => ({
  // Recorded so the run log shows the join happening rather than a blank step —
  // "all branches arrived" is the useful thing to see on a replay.
  output: { joined: true },
});

export default logicMerge;
