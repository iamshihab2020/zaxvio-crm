import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `customer.created`.
 *
 * The one trigger where the *source* filter earns its place: a customer added
 * by hand at the desk and one who came in through the public booking portal
 * usually want different follow-ups, and the payload already distinguishes them.
 */
export default {
  node: "trigger.customer.created",
  version: 1,
  displayName: "New Customer Added",
  description: "Runs when a customer record is created.",
  howItWorks:
    "Fires once, when the customer first appears in your list — however they got " +
    "there. Use the filter below if you only want this for customers who came in " +
    "through your booking page.",
  icon: "IconNote",
  category: "trigger",
  subcategory: "trigger.customer",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["customer.created"],
  requiresSubject: ["customer"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only customers added from",
      name: "source",
      type: "multiOptions",
      description: "Leave empty for all of them.",
      // Values mirror `customerCreatedPayload.source` exactly. A filter whose
      // options do not match the payload's enum matches nothing, silently.
      options: [
        { name: "The booking page", value: "booking" },
        { name: "Added by hand", value: "manual" },
        { name: "Accepting a quote", value: "quote" },
        { name: "An import", value: "import" },
        { name: "The API", value: "api" },
      ],
      filter: { path: "source", operator: "inList" },
    },
  ],
} satisfies NodeDefinition;
