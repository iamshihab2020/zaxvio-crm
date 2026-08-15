import type { NodeDefinition } from "../../node-definition.js";

/**
 * The customer opened their quote.
 *
 * ## The distinction this exists to make
 *
 * `trigger.quote.sent` fires when you send it and `trigger.quote.accepted` fires
 * if they say yes. Neither tells you the thing a contractor actually wants to
 * know about a quote that has gone quiet: **did they even look at it?**
 *
 * Those are different problems with different follow-ups. "Sent and never
 * opened" is a deliverability or an attention problem — resend it, ring them.
 * "Opened and ignored" is a price or a trust problem, and a second copy of the
 * same email will not help. Until this existed a chase automation could not
 * tell them apart, so every chase had to assume the worse case.
 *
 * ## Once per quote, ever
 *
 * `quotes.first_viewed_at` is stamped only while it is null, in the `WHERE`
 * clause rather than by a read-then-write — so two tabs opened at the same
 * instant produce exactly one event.
 *
 * **First, not last**, and that is the whole design. A column that moved on
 * every view would restart the "gone quiet" clock each time they glanced at it
 * again — so the customer who keeps re-reading it and never decides would never
 * be chased, and that is precisely the customer to chase.
 */
export default {
  node: "trigger.quote.viewed",
  version: 1,
  displayName: "Quote Opened",
  description: "Runs the first time a customer opens their quote link.",
  howItWorks:
    "Fires once per quote, the first time it is opened. Pair it with a Wait to " +
    "follow up on someone who looked and then went quiet - which needs a very " +
    "different message from someone who never opened it at all.",
  icon: "IconEye",
  category: "trigger",
  subcategory: "trigger.quote",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["quote.viewed"],
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
