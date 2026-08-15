import type { NodeDefinition } from "../../node-definition.js";

/**
 * Do something once for each item in a list.
 *
 * ## What a list is here
 *
 * A variable whose type is `array` — a job's line items, a customer's assets,
 * the invoices attached to a job. Not an arbitrary expression: the closed
 * variable table is what makes "what can I loop over" answerable in the picker
 * rather than by trial and error.
 *
 * ## Two outputs, and they are not both branches
 *
 * `loop` runs once per item, with `{{loop.item}}`, `{{loop.index}}` and
 * `{{loop.isLast}}` available inside it. `done` runs once, after all of them.
 * That is why `outputMode` stays exclusive-by-default rather than `"all"`: the
 * two do not run concurrently, they run in sequence, and a merge waiting on both
 * would be waiting for something that already happened.
 *
 * ## Why a wait inside is refused
 *
 * `delay_in_loop` is an **error**, written into the validator at P6 and waiting
 * for this file. A loop of twenty items each pausing three days is a run that
 * lives for two months, holding a row in `workflow_executions` and a place in
 * the tenant's concurrent-run quota the whole time. The author almost never
 * means it, and the failure is invisible until somebody wonders why their
 * automations stopped.
 *
 * ## Bounded, and it says so
 *
 * `EXECUTION_LIMITS.MAX_LOOP_ITERATIONS` caps the iterations. A list longer than that
 * is truncated and the run log says how many were skipped — silently processing
 * the first N reads as "it worked", which is the failure this project keeps
 * finding in other guises.
 */
export default {
  node: "logic.loop",
  version: 1,
  displayName: "Repeat for Each",
  description: "Run the same steps once for every item in a list.",
  howItWorks:
    "Everything hanging off Each item runs once per item, and can use " +
    "{{loop.item}} to reach it. When the list is finished, the run carries on " +
    "from Afterwards. Waits are not allowed inside - put them after.",
  icon: "IconRepeat",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  outputs: [
    { id: "loop", label: "Each item" },
    { id: "done", label: "Afterwards" },
  ],

  sideEffect: "none",

  properties: [
    {
      displayName: "For each item in",
      name: "listVariable",
      type: "variablePath",
      required: true,
      typeOptions: { variableTypes: ["array"] },
      description: "A list — a job's line items, a customer's assets.",
    },
    {
      displayName: "Note",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "warning",
        noticeMessage:
          "Do not put a Wait inside the repeated steps. A loop that pauses can run for weeks and holds up everything behind it.",
      },
    },
  ],
} satisfies NodeDefinition;
