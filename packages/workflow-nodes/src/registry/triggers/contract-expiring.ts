import type { NodeDefinition } from "../../node-definition.js";

/**
 * A service agreement is coming up for renewal.
 *
 * The highest-value scheduled trigger in the catalogue for a service business:
 * an agreement that lapses unnoticed is recurring revenue that stops without
 * anyone deciding it should.
 *
 * Once per contract per renewal, keyed on the contract id and its end date — so
 * a contract renewed for another year fires again next year, and a contract
 * whose end date is edited fires again for the new one. Keying on the id alone
 * would make an edited date permanently un-chaseable.
 */
export default {
  node: "trigger.contract.expiring",
  version: 1,
  displayName: "Agreement Expiring",
  description: "Runs when a service agreement is approaching its end date.",
  howItWorks:
    "Checks daily and fires once per agreement. If you extend the agreement, " +
    "it will fire again ahead of the new end date.",
  icon: "IconFileCertificate",
  category: "trigger",
  subcategory: "trigger.asset",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["contract.expiring"],
  requiresSubject: ["maintenance_contract"],
  sideEffect: "none",

  properties: [
    {
      displayName: "How far ahead",
      name: "leadDays",
      type: "number",
      required: true,
      default: 30,
      typeOptions: { minValue: 1, maxValue: 365, step: 1 },
      description: "Days before the agreement ends.",
    },
  ],
} satisfies NodeDefinition;
