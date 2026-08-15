import type { NodeDefinition } from "../../node-definition.js";

/**
 * Jump to another step.
 *
 * ## What it is really for
 *
 * Rejoining. An if/else whose two branches both end up doing the same three
 * things has to either duplicate those three steps or converge — and converging
 * with edges means dragging a line back across the canvas, which is exactly the
 * shape that makes a graph unreadable. A Goto is a named landing point instead.
 *
 * ## Why it has no output
 *
 * The run continues at the target, so nothing follows a Goto. That makes it a
 * terminal node structurally while being the opposite of one semantically — and
 * the validator is right to treat a dangling one as an `orphan_node`, since a
 * node with an input and no outputs belongs at the end of a chain.
 *
 * ## The two rules that already existed
 *
 * The validator has had both since P6, waiting for this file:
 *
 * - `goto_target_missing` — the target is a node id held in a **parameter**, so
 *   nothing else in the graph refers to it. Delete the target and every other
 *   check still passes; only this one notices.
 * - `goto_after_split` — a warning, not an error. A Goto inside a fan-out branch
 *   makes "which branch continues afterwards" genuinely ambiguous, but it is not
 *   *wrong*, and blocking publish on it would refuse a shape somebody may have
 *   good reason for.
 *
 * ## Loops are possible and bounded, not prevented
 *
 * A Goto pointing backwards is a loop. It is not refused, because a bounded
 * retry ("check again in an hour, up to five times") is a real thing to want and
 * is otherwise unbuildable. Two limits bound it — `MAX_GOTO_JUMPS` counts the
 * jumps and `MAX_NODES_EXECUTED` counts everything — and the run log says which
 * step it stopped on, rather than the run simply ending.
 */
export default {
  node: "logic.goto",
  version: 1,
  displayName: "Jump to a Step",
  description: "Continue the run from a different step.",
  howItWorks:
    "Sends the run to another step instead of carrying on. Useful when two " +
    "branches should end up doing the same thing - point them both at it " +
    "rather than building it twice.",
  icon: "IconArrowBackUp",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  // Nothing follows a Goto — the run continues at the target.
  outputs: [],

  sideEffect: "none",

  properties: [
    {
      displayName: "Jump to",
      name: "targetNodeId",
      type: "nodeSelect",
      required: true,
      description: "The step to continue from.",
      hint: "Pointing backwards repeats those steps. There is a limit on how many steps one run may take, so it will stop rather than loop forever.",
    },
  ],
} satisfies NodeDefinition;
