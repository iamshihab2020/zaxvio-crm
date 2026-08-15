import type { NodeDefinition } from "../../node-definition.js";

/**
 * Run another automation from inside this one.
 *
 * What it is for: the three-step chase you have written four times, extracted
 * once. Without it, "send the reminder sequence" has to be copied into every
 * automation that needs it, and fixing the wording means finding all four.
 *
 * ## The recursion is real and the guard is not optional
 *
 * This node can call an automation that calls this automation.
 * `EXECUTION_LIMITS.MAX_NESTING_DEPTH` bounds it, and the depth is carried on an
 * `AsyncLocalStorage` rather than threaded through every producer — a parameter
 * a caller can forget defaults to zero, which silently reopens the loop.
 *
 * The picker excludes the automation being edited, so the most obvious version
 * of the mistake is not offerable. That is a courtesy, not the guard: A calling
 * B calling A is still expressible and still caught.
 *
 * ## Deliberately fire-and-forget
 *
 * The child run is started and this step moves on. Waiting for it would mean a
 * parent holding a slot for three days because the child has a Wait in it, and
 * the two runs would then share a fate they do not share in the data model —
 * each has its own row, its own log and its own retry.
 */
export default {
  node: "workflow.run",
  version: 1,
  displayName: "Run Another Automation",
  description: "Start one of your other automations for this same record.",
  howItWorks:
    "Kicks off another automation and carries on - it does not wait for it to " +
    "finish. The other automation runs against the same customer or job as " +
    "this one, and gets its own entry in the run history.",
  icon: "IconRouteAltRight",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "Automation",
      name: "workflowId",
      type: "workflowSelect",
      required: true,
      description: "Which of your automations to run.",
      ownership: "workflow",
    },
    {
      displayName: "Note",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "info",
        noticeMessage:
          "This starts the other automation and moves straight on. It does not wait for it to finish, and it runs whether or not that automation is switched on.",
      },
    },
  ],
} satisfies NodeDefinition;
