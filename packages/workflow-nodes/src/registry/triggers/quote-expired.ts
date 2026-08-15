import type { NodeDefinition } from "../../node-definition.js";

/**
 * A quote ran out without an answer.
 *
 * Comes from the hourly expiry sweep, not from someone opening the quote —
 * expiry is *derived* in tenant time and swept rather than `UPDATE`d on read
 * (QUO-10). That matters here: it means this fires for the quotes **nobody
 * looked at**, which are exactly the ones worth chasing.
 */
export default {
  node: "trigger.quote.expired",
  version: 1,
  displayName: "Quote Expired",
  description: "Runs when a quote passes its expiry date unanswered.",
  howItWorks:
    "Fires once, at roughly the hour it lapses - including for quotes nobody " +
    "ever opened. A good moment to offer a fresh price rather than a nudge.",
  icon: "IconClockX",
  category: "trigger",
  subcategory: "trigger.quote",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["quote.expired"],
  requiresSubject: ["quote"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only quotes of at least",
      name: "minTotal",
      type: "moneyInput",
      description: "Leave empty for any amount.",
      filter: { path: "totalAmount", operator: "greaterThanOrEqual" },
    },
  ],
} satisfies NodeDefinition;
