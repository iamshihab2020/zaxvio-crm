import type { NodeDefinition } from "../../node-definition.js";

/**
 * A payment landed — **any** payment, including a partial one.
 *
 * Two events rather than one, and the distinction is the reason this node
 * exists: `invoice.paid` fires only when the balance reaches zero. "Log the
 * deposit" wants every payment; "stop chasing them" wants the last one. An
 * automation built on `invoice.paid` never sees a 50% deposit at all.
 *
 * `settlesInvoice` is on the payload so a filter does not have to compare
 * `balanceDue` against a string zero, which is a comparison people get wrong —
 * `"0.00"` is truthy and is not `0`.
 */
export default {
  node: "trigger.invoice.paymentRecorded",
  version: 1,
  displayName: "Payment Received",
  description: "Runs when any payment is recorded, including part payments.",
  howItWorks:
    "Fires for every payment. Use the filter to separate a deposit from the " +
    "one that clears the balance - they usually deserve different messages.",
  icon: "IconCashBanknote",
  category: "trigger",
  subcategory: "trigger.invoice",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["invoice.payment_recorded"],
  requiresSubject: ["invoice"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Which payments",
      name: "settlesInvoice",
      type: "options",
      default: "__any__",
      options: [
        { name: "Every payment", value: "__any__" },
        { name: "Only the one that clears the balance", value: true },
        { name: "Only part payments", value: false },
      ],
      filter: { path: "settlesInvoice", operator: "equals" },
    },
    {
      displayName: "At least",
      name: "minAmount",
      type: "moneyInput",
      description: "Leave empty for any amount.",
      filter: { path: "amount", operator: "greaterThanOrEqual" },
    },
  ],
} satisfies NodeDefinition;
