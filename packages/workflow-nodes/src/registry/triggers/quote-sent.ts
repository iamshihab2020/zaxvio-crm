import type { NodeDefinition } from "../../node-definition.js";

/**
 * A quote went out to the customer.
 *
 * The missing half of the quote story. `trigger.quote.accepted` fires when the
 * customer says yes — but the automation a contractor actually needs is the one
 * for when they say nothing, which is most of the time. Chasing an unanswered
 * quote is the single highest-value follow-up in a service business, and until
 * this existed there was no event to hang it on.
 *
 * Fires on the send, not on the draft: `quote.sent` is emitted where the token
 * and the PDF are minted, which is the only point a quote becomes something the
 * customer can actually act on. That distinction is enforced upstream too —
 * `draft → sent` is absent from the bulk status transition table by construction
 * (QUO-01), so nothing else can put a quote into this state.
 */
export default {
  node: "trigger.quote.sent",
  version: 1,
  displayName: "Quote Sent",
  description: "Runs when you send a quote to a customer.",
  howItWorks:
    "Fires when the quote is emailed and the customer gets a link they can act " +
    "on — not when you first save a draft. Pair it with a Wait step to chase " +
    "anything still unanswered a few days later.",
  icon: "IconMail",
  category: "trigger",
  subcategory: "trigger.quote",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["quote.sent"],
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
    {
      // The payload carries this because a follow-up that says "click to
      // accept" is wrong when online acceptance is switched off — the customer
      // has no button to press. Offering it as a filter lets one automation
      // chase with a link and another chase with a phone call.
      displayName: "Online acceptance",
      name: "onlineAcceptanceEnabled",
      type: "options",
      default: "__any__",
      options: [
        { name: "Either way", value: "__any__" },
        { name: "Only quotes the customer can accept online", value: true },
        { name: "Only quotes they cannot accept online", value: false },
      ],
      filter: { path: "onlineAcceptanceEnabled", operator: "equals" },
    },
  ],
} satisfies NodeDefinition;
