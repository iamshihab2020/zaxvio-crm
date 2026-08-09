import type { NodeDefinition, NodeOutput } from "../../node-definition.js";
import { MIN_BRANCHES, MAX_BRANCHES, branchHandles } from "../../branches.js";

/**
 * Do several things at once — the unconditional fan-out.
 *
 * `condition.if` picks **one** output; this one leaves by **all** of them. That
 * is the entire difference, and it is why the executor contract grew `handles`
 * rather than making `handle` a list: a condition that returned two branches is
 * a bug, and keeping the two shapes separate means it cannot be written.
 *
 * ## Why this node has to exist before `logic.merge` is any use
 *
 * A merge is an AND-join: it waits for every incoming edge. The only shape
 * where that is satisfiable is one where every branch genuinely runs — which,
 * until now, nothing in the catalogue could produce. Feed a merge from the two
 * sides of an Only if and it waits forever, which is why the validator raises
 * `merge_never_completes` as an error rather than a warning. This node is the
 * other half of that pair.
 *
 * ## Ordering
 *
 * Branches are queued in order and the engine is single-threaded, so branch 1
 * finishes before branch 2 starts. Worth knowing, not worth relying on: it is a
 * consequence of the traversal rather than a promise, and an automation whose
 * correctness depends on branch order wants a chain, not a split.
 */
export default {
  node: "split.branch",
  version: 1,
  displayName: "Do several things",
  description: "Carry on down every branch below, not just one.",
  howItWorks:
    "Every branch runs, one after another. Use it when completing a job needs " +
    "two unrelated things to happen — tell the customer and raise the invoice — " +
    "rather than one or the other. To wait for them all to finish before " +
    "carrying on, put a Wait for all branches step underneath.",
  icon: "IconArrowsSplit",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  // No fixed outputs at all — every one comes from the configuration below.
  // `outputsFor` concatenates dynamic then fixed, so this staying empty is what
  // stops a stray "Then" handle appearing beside the branches.
  outputs: [],

  dynamicOutputs: (parameters): NodeOutput[] =>
    branchHandles(parameters).map((id, i) => ({ id, label: `Branch ${i + 1}` })),

  // The declaration that separates this node from every other branching one.
  // Without it the validator treats two branches from here as mutually
  // exclusive and refuses to publish a merge underneath — which is the only
  // shape a merge exists for.
  outputMode: "all",

  sideEffect: "none",

  properties: [
    {
      displayName: "How many branches",
      name: "branchCount",
      type: "number",
      default: MIN_BRANCHES,
      required: true,
      typeOptions: { minValue: MIN_BRANCHES, maxValue: MAX_BRANCHES },
      description:
        "Each branch runs. Lowering this removes the last branch — reconnect anything that was attached to it.",
    },
  ],
} satisfies NodeDefinition;
