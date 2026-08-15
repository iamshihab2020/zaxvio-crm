import type { NodeDefinition } from "../../node-definition.js";

/**
 * A maintenance visit under a service agreement is due.
 *
 * Derived from `frequency` and `visitsPerYear` on the agreement rather than
 * from a schedule the author configures — the agreement already says how often
 * somebody is coming out, and a second declaration of that would drift from the
 * one the customer signed.
 *
 * Keyed per contract per period, so a quarterly agreement fires four times a
 * year and not once a day for the quarter.
 */
export default {
  node: "trigger.contract.visitDue",
  version: 1,
  displayName: "Maintenance Visit Due",
  description: "Runs when a visit under a service agreement is due.",
  howItWorks:
    "Works out when the next visit is due from the agreement's own frequency, " +
    "and fires once per visit. Pair it with Create a Job to raise the work.",
  icon: "IconTool",
  category: "trigger",
  subcategory: "trigger.asset",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["contract.visit_due"],
  requiresSubject: ["maintenance_contract"],
  sideEffect: "none",

  properties: [
    {
      displayName: "How far ahead",
      name: "leadDays",
      type: "number",
      required: true,
      default: 14,
      typeOptions: { minValue: 0, maxValue: 120, step: 1 },
      description: "Days before the visit is due, so there is time to book it in.",
    },
  ],
} satisfies NodeDefinition;
