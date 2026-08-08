import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `quote.accepted`, emitted from the serialised accept/decline claim
 * in `claimQuoteResponse` — the one write that can settle a quote's outcome.
 *
 * That serialisation is why this can be trusted. Accept and decline used to be
 * an unserialised read-then-write (QUO-03), so a customer clicking both in
 * quick succession could leave a scheduled job on a declined quote — and an
 * automation on that would have thanked someone who had just said no.
 */
export default {
  node: "trigger.quote.accepted",
  version: 1,
  displayName: "Quote Accepted",
  description: "Runs when a customer accepts a quote from the portal link.",
  howItWorks:
    "Fires the moment the customer presses Accept on the quote you emailed them. " +
    "It does not fire when you mark a quote accepted yourself, so it is a real " +
    "signal from the customer rather than a change of your own.",
  icon: "IconCircleCheck",
  category: "trigger",
  subcategory: "trigger.quote",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["quote.accepted"],
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
