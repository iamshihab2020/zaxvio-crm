import type { NodeDefinition } from "../../node-definition.js";

/**
 * The one trigger that needs no event pipeline behind it — which makes it the
 * node the engine is first proved against, and the node a user reaches for to
 * try an automation on a real record before switching it on.
 */
export default {
  node: "trigger.manual",
  version: 1,
  displayName: "Run Manually",
  description: "Start this automation by hand, from a record or from the builder.",
  howItWorks:
    "Nothing starts this automation on its own. You pick a record and run it — " +
    "useful for testing, and for one-off jobs you do not want to automate yet.",
  icon: "IconPlayerPlay",
  category: "trigger",
  subcategory: "trigger.system",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["manual.run"],
  sideEffect: "none",

  properties: [
    {
      displayName: "What this runs on",
      name: "subjectType",
      type: "options",
      required: true,
      default: "job",
      description:
        "Which kind of record you will pick when you run this. Later steps can " +
        "only use fields from this kind of record.",
      options: [
        { name: "Job", value: "job" },
        { name: "Customer", value: "customer" },
        { name: "Invoice", value: "invoice" },
        { name: "Quote", value: "quote" },
        { name: "Booking", value: "booking" },
      ],
    },
  ],
} satisfies NodeDefinition;
