import type { NodeDefinition } from "../../node-definition.js";

/**
 * Leave a note on the customer.
 *
 * Writes the note **and** a timeline entry, exactly as the route does. Two rows
 * because they answer different questions: the note is content someone reads on
 * the Notes tab, and the activity is what makes the customer's history mention
 * that anything happened.
 *
 * The note is attributed to the automation by name, not left blank — an
 * unattributed note reads as data loss rather than as attribution, which is why
 * `customer_notes` gained a `created_by_workflow_id` alongside a nullable
 * `created_by`.
 */
export default {
  node: "customer.addNote",
  version: 1,
  displayName: "Add a Note",
  description: "Write a note on the customer's record.",
  howItWorks:
    "The note appears on the customer's Notes tab, signed with this " +
    "automation's name so it is obvious it was not typed by a person.",
  icon: "IconNote",
  category: "crm",
  subcategory: "crm.customer",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  requiresSubject: ["customer", "job", "invoice", "quote", "booking", "equipment", "maintenance_contract"],
  mutates: ["customer"],
  // Running it twice leaves two notes, which is visible.
  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "Note",
      name: "content",
      type: "text",
      required: true,
      typeOptions: { rows: 4 },
      placeholder: "Reminder sent about {{job.number}}.",
      description: "Internal only — the customer never sees this.",
      // Plain text, stored and rendered as text. HTML-encoding would print
      // `&amp;` in a note somebody reads.
      encoding: "none",
    },
  ],
} satisfies NodeDefinition;
