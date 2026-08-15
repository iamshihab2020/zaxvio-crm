import type { NodeDefinition } from "../../node-definition.js";

/**
 * The customer said no.
 *
 * Worth automating precisely because most businesses do nothing with it. The
 * payload carries `reason` when they gave one, which is the difference between
 * "we lost that one" and knowing you lost it on price.
 */
export default {
  node: "trigger.quote.declined",
  version: 1,
  displayName: "Quote Declined",
  description: "Runs when a customer declines a quote.",
  howItWorks:
    "Fires when the customer declines, whether from the portal or because you " +
    "marked it declined. Their reason comes through when they gave one.",
  icon: "IconThumbDown",
  category: "trigger",
  subcategory: "trigger.quote",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["quote.declined"],
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
