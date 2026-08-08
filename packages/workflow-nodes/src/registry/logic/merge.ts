import type { NodeDefinition } from "../../node-definition.js";

/**
 * Wait for every branch, then carry on once.
 *
 * The **only** node in the catalogue with AND semantics. Everything else joins
 * with OR, and that default is deliberate: the common shape is an if/else whose
 * two branches both feed one "send the follow-up" step, and under AND that step
 * would never fire, because only one branch ever ran. So OR is right for the
 * common case and this node exists for the uncommon one — two genuinely
 * parallel chains that must both finish before the next step.
 *
 * The rule lives in the traverser's `isReady`, which has held the readiness
 * bookkeeping since P3 precisely so this could arrive as a node rather than a
 * rewrite. It does nothing itself; being reached is the whole of its job.
 *
 * ## The failure mode worth knowing about
 *
 * A merge waits for **every** incoming edge. Put one after an if/else and it
 * waits forever for the branch that did not run — the automation simply stops,
 * with no error, which is the worst way for something to fail. The validator
 * warns about that shape at publish time rather than letting a run hang.
 */
export default {
  node: "logic.merge",
  version: 1,
  displayName: "Wait for all branches",
  description: "Carry on only once every branch above has finished.",
  howItWorks:
    "Every step feeding into this one has to finish before anything below it " +
    "runs, and it runs once rather than once per branch. Only use it where the " +
    "branches genuinely all run — after an Only if, one side never does, so " +
    "the automation would wait forever.",
  icon: "IconArrowMerge",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  sideEffect: "none",

  properties: [
    {
      displayName: "notice",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "info",
        noticeMessage:
          "Nothing to set up. Connect every branch you want to wait for into the top of this step.",
      },
    },
  ],
} satisfies NodeDefinition;
