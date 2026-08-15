import type { NodeDefinition } from "../../node-definition.js";

/**
 * An invoice went out.
 *
 * The start of the money clock. `trigger.invoice.overdue` is the chase and
 * `trigger.invoice.paid` is the end; this is the only one that fires at the
 * moment the customer becomes able to pay, which is where a "thanks, here is how
 * to pay" message belongs.
 */
export default {
  node: "trigger.invoice.sent",
  version: 1,
  displayName: "Invoice Sent",
  description: "Runs when an invoice is issued to the customer.",
  howItWorks:
    "Fires when the invoice is sent, not when it is first drafted. Pair it " +
    "with a Wait to nudge before the due date rather than after it.",
  icon: "IconFileInvoice",
  category: "trigger",
  subcategory: "trigger.invoice",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["invoice.sent"],
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
  ],
} satisfies NodeDefinition;
