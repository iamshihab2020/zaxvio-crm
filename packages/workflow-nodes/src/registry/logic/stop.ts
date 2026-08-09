import type { NodeDefinition } from "../../node-definition.js";

/**
 * Ends the run deliberately.
 *
 * `cancelled` exists separately from `failed` because the difference decides
 * whether anyone gets notified: a crash is a bug worth an alert, while "this
 * customer already paid, stop chasing them" is the automation working. The
 * failure notification deliberately skips `cancelled` for exactly that reason.
 */
export default {
  node: "logic.stop",
  version: 1,
  displayName: "Stop",
  description: "End this automation here.",
  howItWorks:
    "Nothing after this step runs. Use it inside a branch to end early — for " +
    "example, stop chasing an invoice that has been paid.",
  icon: "IconPlayerStop",
  category: "logic",
  subcategory: "logic.control",

  inputs: [{ id: "main" }],
  outputs: [],

  sideEffect: "none",

  properties: [
    {
      displayName: "Record this run as",
      name: "outcome",
      type: "options",
      required: true,
      default: "completed",
      description:
        "Only affects how the run is labelled in the history, and whether " +
        "anyone is notified.",
      options: [
        {
          name: "Finished",
          value: "completed",
          description: "The normal case — it did its job and stopped.",
        },
        {
          name: "Stopped early",
          value: "cancelled",
          description: "Expected, so nobody is notified.",
        },
        {
          name: "Failed",
          value: "failed",
          description: "Something was wrong. Notifies the team.",
        },
      ],
    },
    {
      displayName: "Reason",
      name: "reason",
      type: "string",
      placeholder: "Invoice already paid",
      description: "Shown in the run history. Worth filling in.",
      encoding: "none",
    },
  ],
} satisfies NodeDefinition;
