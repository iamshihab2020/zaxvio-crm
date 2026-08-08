/**
 * `logic.stop` — end the run here, in a state the author chose.
 *
 * Throws rather than returning, for the reason every pause does: this has to
 * end the *whole* run from wherever it is, including five nodes deep inside a
 * loop body. A return value would have to be checked by every frame between
 * here and the traverser, and one missed check means a "stop" that carries on.
 *
 * The three stop types are not cosmetic. `failed` fires a failure notification;
 * `cancelled` does not, because a cancel is expected behaviour and notifying on
 * one teaches people to ignore the notification.
 */

import { WorkflowStopped } from "../errors.js";
import type { Executor } from "./types.js";

type StopType = "completed" | "failed" | "cancelled";

const VALID: readonly StopType[] = ["completed", "failed", "cancelled"];

const logicStop: Executor = async ({ params, node }) => {
  const requested = typeof params.stopType === "string" ? params.stopType : "completed";
  // A value outside the set means a corrupt or hand-edited config. Ending the
  // run as completed is the conservative reading — the author asked for it to
  // stop, and inventing a failure would fire a notification they never asked
  // for over a config problem rather than a real one.
  const stopType: StopType = VALID.includes(requested as StopType)
    ? (requested as StopType)
    : "completed";

  const reason =
    (typeof params.reason === "string" && params.reason.trim()) ||
    `Stopped at "${node.label}"`;

  throw new WorkflowStopped(stopType, reason);
};

export default logicStop;
