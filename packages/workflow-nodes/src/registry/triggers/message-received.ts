import type { NodeDefinition } from "../../node-definition.js";

/**
 * A customer replied.
 *
 * The only **inbound** trigger in the catalogue — everything else fires off
 * something the business did. That makes it the one that can stop a sequence
 * politely: a chase that keeps going after the customer has answered is the
 * single most common way an automation embarrasses the business running it.
 *
 * `body` on the payload is truncated at 2,000 characters and the filter reads
 * that copy. A forwarded thread with signatures and quoted history is not a
 * message store, and the full text is in `conversation_messages` regardless.
 */
export default {
  node: "trigger.message.received",
  version: 1,
  displayName: "Customer Replied",
  description: "Runs when a customer sends you a message.",
  howItWorks:
    "Fires on an inbound message. Because it is the only trigger the customer " +
    "controls, it is also the best thing to hang a Goal on - stop chasing " +
    "once they answer.",
  icon: "IconMessage",
  category: "trigger",
  subcategory: "trigger.customer",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["message.received"],
  requiresSubject: ["customer"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Only when the message mentions",
      name: "bodyContains",
      type: "string",
      placeholder: "cancel",
      description:
        "Leave empty to run on every reply. Matched against the first 2,000 characters.",
      filter: { path: "body", operator: "contains" },
    },
  ],
} satisfies NodeDefinition;
