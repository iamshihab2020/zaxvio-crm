import type { NodeDefinition } from "../../node-definition.js";

/**
 * Send an email.
 *
 * **The recipient is a role, never an address** (D-14). A free-text address
 * field on an automation is an open relay with a nice UI — anyone who can edit
 * a workflow could mail anyone from the tenant's verified sending domain, and
 * complaints score against a domain every tenant shares.
 *
 * The body is a textarea with variable pills, not a rich-text editor. Zaxvio's
 * email nodes fill fields in a designed React Email template rather than
 * authoring HTML, so there is nothing for a rich editor to produce that the
 * template would not immediately override.
 */
export default {
  node: "email.send",
  version: 1,
  displayName: "Send Email",
  description: "Send an email to the customer, the assigned technician, or a teammate.",
  howItWorks:
    "Uses your branded email template, so you only write the subject and the " +
    "message. Emails to customers are checked against their unsubscribe setting " +
    "first — if they have opted out, this step is skipped and the rest of the " +
    "automation carries on.",
  icon: "IconMail",
  category: "communication",
  subcategory: "communication.email",

  inputs: [{ id: "main" }],
  outputs: [{ id: "main", label: "Then" }],

  // Running it twice is visible to a customer, so the engine refuses to
  // re-enter it after a crash rather than sending a second time (D-22).
  sideEffect: "at-most-once",

  properties: [
    {
      displayName: "Send to",
      name: "recipient",
      type: "options",
      required: true,
      default: "customer",
      description: "Who receives it. You cannot type an address — pick a role.",
      options: [
        { name: "The customer", value: "customer", description: "Checked against their unsubscribe setting" },
        { name: "The assigned technician", value: "assignee", description: "Skipped if nobody is assigned" },
        { name: "A specific teammate", value: "member" },
      ],
    },
    {
      displayName: "Teammate",
      name: "memberId",
      type: "memberSelect",
      required: true,
      description:
        "Anyone in your workspace. If they leave the team later, this automation stops and tells you which step to fix — it does not quietly send to nobody.",
      ownership: "member",
      displayOptions: { show: { recipient: ["member"] } },
    },
    {
      displayName: "Subject",
      name: "subject",
      type: "string",
      required: true,
      placeholder: "Your {{job.serviceType}} visit on {{job.scheduledDate}}",
      // `none`, because `sanitizeSubject()` strips CR/LF/tab on the way out —
      // html-encoding a subject line would print `&amp;` in an inbox.
      encoding: "none",
    },
    {
      displayName: "Message",
      name: "body",
      type: "text",
      required: true,
      typeOptions: { rows: 8 },
      placeholder:
        "Hi {{customer.firstName}},\n\nJust confirming we'll be at {{job.address}} on {{job.scheduledDate}}.",
      description: "Blank lines start a new paragraph. Insert variables with the { } button.",
      // A customer's own last name reaches a React Email template through this
      // field. `O'Brien <script>` unescaped is a stored XSS in an email nobody audits.
      encoding: "html",
    },
    {
      displayName: "Button label",
      name: "ctaLabel",
      type: "string",
      placeholder: "View your estimate",
      description: "Leave empty for no button.",
      encoding: "html",
    },
    {
      displayName: "Button link",
      name: "ctaUrl",
      type: "string",
      placeholder: "{{quote.publicUrl}}",
      displayOptions: { hide: { ctaLabel: [""] } },
      encoding: "url",
    },
    {
      displayName: "About sending",
      name: "notice",
      type: "notice",
      typeOptions: {
        noticeType: "info",
        noticeMessage:
          "Customers can unsubscribe from automated email. Estimates, invoices and receipts are never affected.",
      },
    },
  ],
} satisfies NodeDefinition;
