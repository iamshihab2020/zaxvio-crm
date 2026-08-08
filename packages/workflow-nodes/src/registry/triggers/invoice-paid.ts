import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `invoice.paid`, emitted from `recalculateInvoice()` — the one place
 * the *derived* status is written.
 *
 * That is the whole reason this trigger can be trusted. Status used to be
 * assignable, so an invoice could read **Paid** with money still outstanding
 * (INV-01/02/03); an automation on that would have thanked a customer who had
 * not paid, and stopped chasing one who still owed.
 */
export default {
  node: "trigger.invoice.paid",
  version: 1,
  displayName: "Invoice Paid in Full",
  description: "Runs when an invoice is settled — nothing left owing.",
  howItWorks:
    "Fires when the payments on an invoice add up to the full amount. It does " +
    "not fire for a part payment; use Payment Recorded for that. Editing a paid " +
    "invoice upward and settling it again fires it again, because it became paid again.",
  icon: "IconCoin",
  category: "trigger",
  subcategory: "trigger.invoice",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["invoice.paid"],
  requiresSubject: ["invoice"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only invoices of at least",
      name: "minTotal",
      type: "moneyInput",
      description: "Leave empty for any amount.",
      filter: { path: "totalAmount", operator: "greaterThanOrEqual" },
    },
    {
      displayName: "Only jobs settled within",
      name: "maxDaysToPayment",
      type: "number",
      description:
        "Days from issue to payment. Leave empty for any. Useful for rewarding prompt payers.",
      typeOptions: { minValue: 0, maxValue: 365 },
      filter: { path: "daysToPayment", operator: "lessThanOrEqual" },
    },
  ],
} satisfies NodeDefinition;
