import type { NodeDefinition } from "../../node-definition.js";

/**
 * Fires off `invoice.overdue`, raised by the hourly sweep rather than by a
 * write — nothing *happens* to make an invoice overdue except time passing.
 *
 * `daysOverdue` is what makes a chase sequence possible: three copies of this
 * trigger at 1, 7 and 14 days, each with its own message, rather than one
 * automation trying to branch on a date it has to compute itself.
 *
 * The definition of overdue is one shared `overdueCondition()` (INV-06). It
 * used to exist in three places, and the cron's copy excluded partially-paid
 * invoices — so a customer who paid half and stopped was shown as overdue
 * everywhere in the UI and never chased.
 */
export default {
  node: "trigger.invoice.overdue",
  version: 1,
  displayName: "Invoice Overdue",
  description: "Runs when an invoice passes its due date without being settled.",
  howItWorks:
    "Checked hourly, so it fires shortly after the due date passes rather than " +
    "exactly at midnight. Set the days below and add one of these for each " +
    "reminder you want to send — 1 day, then 7, then 14.",
  icon: "IconCoin",
  category: "trigger",
  subcategory: "trigger.invoice",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["invoice.overdue"],
  requiresSubject: ["invoice"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Days overdue",
      name: "daysOverdue",
      type: "number",
      description:
        "Fires when the invoice is exactly this many days past due. Leave empty " +
        "to fire on the first day only.",
      typeOptions: { minValue: 0, maxValue: 365 },
      filter: { path: "daysOverdue", operator: "equals" },
    },
    {
      displayName: "Only invoices of at least",
      name: "minTotal",
      type: "moneyInput",
      description: "Leave empty for any amount. Useful for skipping small balances.",
      filter: { path: "totalAmount", operator: "greaterThanOrEqual" },
    },
  ],
} satisfies NodeDefinition;
