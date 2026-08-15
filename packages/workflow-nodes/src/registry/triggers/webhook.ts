import type { NodeDefinition } from "../../node-definition.js";

/**
 * Something outside Zaxvio called a URL.
 *
 * The one trigger that lets the CRM be *reached* rather than only watched. A
 * form on the business's own website, a Zapier step, a smart thermostat vendor
 * — anything that can POST.
 *
 * ## It has no filters, and that is deliberate
 *
 * Every other trigger filters on a payload this system built from a row it
 * wrote, so the fields are known and a filter can offer them as options. A
 * webhook body is whatever the sender chose, and a filter control offering
 * guessed field names would be the `customer.created` mistake at scale: a
 * dropdown whose options match nothing, silently. Filter with an Only-if step
 * below it instead, where the author types the path themselves and the
 * validator can tell them it did not resolve.
 *
 * ## No subject
 *
 * A webhook is about whatever the automation decides it is about. Reading a
 * record id out of an untrusted body and trusting it is exactly the
 * tenant-crossing [[wf-10-security|T-4]] forbids — the tenant comes from the
 * URL token and from nothing else.
 */
export default {
  node: "trigger.webhook",
  version: 1,
  displayName: "Webhook",
  description: "Runs when something calls your webhook URL.",
  howItWorks:
    "Gives you a URL to hand to another system. Whatever they send arrives as " +
    "{{webhook.body...}} and you can use it in the steps below. Keep the URL " +
    "and its secret private - anyone with both can start this automation.",
  icon: "IconWebhook",
  category: "trigger",
  subcategory: "trigger.system",

  inputs: [],
  outputs: [{ id: "main", label: "Then" }],

  triggerEvents: ["webhook.received"],
  sideEffect: "none",

  properties: [
    {
      displayName: "Note",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "info",
        noticeMessage:
          "Your URL and secret appear once you publish. The secret is shown in full only that once - copy it then.",
      },
    },
  ],
} satisfies NodeDefinition;
