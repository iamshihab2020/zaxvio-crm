import type { WorkflowTemplate } from "./types.js";

/**
 * The starter templates.
 *
 * The target user is a solo contractor with one to three people. A blank canvas
 * and sixteen node types is not a feature for them — it is a project. These are
 * the automations they would have built if they had an afternoon, written so
 * that "use this" is one click and the result is publishable as delivered.
 *
 * Three rules every template here follows:
 *
 *  1. **No tenant-scoped ids.** A template cannot know a pipeline id, a stage id
 *     or a teammate's id, so no template uses a node that needs one. Baking a
 *     placeholder would produce an automation that refuses to publish for a
 *     reason the tenant did not cause.
 *  2. **Complete on arrival**, or honest about what is missing — and the two
 *     kinds of missing are kept apart. `needsSetup` is a step the tenant must
 *     finish before this can publish, and a test asserts it matches the graph's
 *     actual missing required fields. `dependsOn` is a tenant *setting* the
 *     automation leans on: `{{tenant.googleReviewUrl}}` is on no step, publishes
 *     fine without it, and sends a button that goes nowhere. Conflating them is
 *     what would make the assertable one unassertable.
 *  3. **The copy is the product.** Every email body here is one a contractor
 *     could send unedited. A template whose message reads like a placeholder
 *     gets edited into a blank page and abandoned.
 *
 * Variable paths are real — every `{{…}}` below is a declared variable, checked
 * by a test. A typo resolves to nothing and mails a customer a sentence with a
 * hole in it, which is exactly the failure the interpolator's diagnostics exist
 * to catch and exactly what a template must not ship.
 */

/**
 * Chasing money, which is the reason a contractor tries automation at all.
 *
 * Every email here is `purpose: "transactional"`, and that is not a convenience:
 * an invoice the customer owes is the exact case `lib/email-consent.ts` names as
 * exempt from an unsubscribe. Left on the default, this whole template would
 * silently skip anyone who had ever opted out of marketing — the most valuable
 * automation in the product, quietly not chasing the people most likely to need
 * chasing.
 *
 * Three triggers rather than one automation branching on a date: the overdue
 * trigger filters `daysOverdue` with `equals`, so this is what a chase sequence
 * looks like by design. Each has its own tone, escalating — the third names a
 * consequence, because a reminder that never changes is one that gets ignored.
 */
const chaseOverdueInvoices: WorkflowTemplate = {
  id: "chase-overdue-invoices",
  name: "Chase overdue invoices",
  summary: "Three reminders — gentle at 1 day, firmer at 7, direct at 14.",
  detail:
    "The day an invoice goes past due, your customer gets a short nudge with a " +
    "payment link. A week later, a firmer one. At two weeks, a direct message " +
    "asking them to get in touch. Anyone who pays stops hearing from it.",
  category: "getting-paid",
  icon: "IconCoin",
  nodes: [
    {
      key: "day1",
      nodeType: "trigger.invoice.overdue",
      label: "1 day past due",
      parameters: { daysOverdue: 1 },
    },
    {
      key: "email1",
      nodeType: "email.send",
      label: "Gentle nudge",
      parameters: {
        recipient: "customer",
        purpose: "transactional",
        subject: "Invoice {{invoice.number}} from {{tenant.businessName}}",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Just a quick note that invoice {{invoice.number}} for " +
          "{{invoice.balanceDue}} was due yesterday. If you have already sent " +
          "payment, thank you — please ignore this.\n\n" +
          "You can view and pay it using the button below.\n\n" +
          "Thanks,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
        ctaLabel: "View invoice",
        ctaUrl: "{{invoice.publicUrl}}",
      },
    },
    {
      key: "day7",
      nodeType: "trigger.invoice.overdue",
      label: "7 days past due",
      parameters: { daysOverdue: 7 },
    },
    {
      key: "email7",
      nodeType: "email.send",
      label: "Firmer reminder",
      parameters: {
        recipient: "customer",
        purpose: "transactional",
        subject: "Reminder: invoice {{invoice.number}} is a week overdue",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Invoice {{invoice.number}} for {{invoice.balanceDue}} is now a week " +
          "past its due date of {{invoice.dueDate}}.\n\n" +
          "If there is a problem with the invoice, or you need more time, reply " +
          "to this email and we will sort it out. Otherwise you can settle it " +
          "using the button below.\n\n" +
          "Thanks,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
        ctaLabel: "Pay invoice",
        ctaUrl: "{{invoice.publicUrl}}",
      },
    },
    {
      key: "day14",
      nodeType: "trigger.invoice.overdue",
      label: "14 days past due",
      parameters: { daysOverdue: 14 },
    },
    {
      key: "email14",
      nodeType: "email.send",
      label: "Final notice",
      parameters: {
        recipient: "customer",
        purpose: "transactional",
        subject: "Invoice {{invoice.number}} — please get in touch",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Invoice {{invoice.number}} for {{invoice.balanceDue}} is now two " +
          "weeks overdue and we have not heard from you.\n\n" +
          "Please either settle it using the button below or reply to this " +
          "email today so we can agree a plan. We would much rather hear from " +
          "you than chase you.\n\n" +
          "Thanks,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
        ctaLabel: "Pay invoice",
        ctaUrl: "{{invoice.publicUrl}}",
      },
    },
    {
      key: "notify14",
      nodeType: "notification.internal",
      label: "Tell me about it",
      parameters: {
        title: "{{customer.fullName}} is 14 days overdue",
        description:
          "Invoice {{invoice.number}} — {{invoice.balanceDue}} still owed. " +
          "Final notice sent; worth a phone call.",
      },
    },
  ],
  edges: [
    { from: "day1", to: "email1" },
    { from: "day7", to: "email7" },
    { from: "day14", to: "email14" },
    // The one branch that is not customer-facing: by two weeks this stops being
    // something to automate and starts being something to do.
    { from: "email14", to: "notify14" },
  ],
};

/**
 * Asking for the review, which is the highest-value thing a small contractor
 * never gets round to.
 *
 * The wait is three days, not immediate: a review asked for on the doorstep
 * competes with the customer's day, and one asked for on Monday morning gets
 * answered. `delay.wait` defaults to resuming inside working hours, so this
 * never lands at 2am even when the job was finished at 11pm.
 */
const askForReview: WorkflowTemplate = {
  id: "ask-for-review",
  name: "Ask for a review after the job",
  summary: "Three working days after a job is done, ask the customer to review you.",
  detail:
    "When you mark a job complete, this waits three days — long enough that the " +
    "work has settled, soon enough that they remember it — then emails the " +
    "customer a short thank-you with a link to leave a review.",
  category: "keeping-customers",
  icon: "IconCircleCheck",
  dependsOn: [
    "Your Google review link, in Settings → Business — without it the button has nowhere to go.",
  ],
  nodes: [
    {
      key: "trigger",
      nodeType: "trigger.job.completed",
      label: "Job marked complete",
      parameters: {},
    },
    {
      key: "wait",
      nodeType: "delay.wait",
      label: "Give it three days",
      parameters: {
        mode: "for",
        duration: { amount: 3, unit: "days" },
        resumeDuring: "businessHours",
      },
    },
    {
      key: "email",
      nodeType: "email.send",
      label: "Ask for the review",
      parameters: {
        recipient: "customer",
        subject: "How did we do, {{customer.firstName}}?",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Thanks again for having us out for {{job.title}} — it was good to " +
          "work with you.\n\n" +
          "If you have a spare minute, a short review makes a real difference " +
          "to a small business like ours. It only takes a moment.\n\n" +
          "And if anything was not right, reply to this email instead and we " +
          "will put it straight.\n\n" +
          "Thanks,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
        ctaLabel: "Leave a review",
        ctaUrl: "{{tenant.googleReviewUrl}}",
      },
    },
  ],
  edges: [
    { from: "trigger", to: "wait" },
    { from: "wait", to: "email" },
  ],
};

/**
 * Following up an accepted quote, and the first template with a branch.
 *
 * The condition is on value rather than on anything clever: a large accepted
 * quote is worth a personal call and a small one is not, and that is a judgement
 * a contractor already makes. The threshold is visible and editable, which is
 * the point of putting it in a step rather than in the template's head.
 */
const followUpAcceptedQuote: WorkflowTemplate = {
  id: "follow-up-accepted-quote",
  name: "Follow up an accepted quote",
  summary: "Thank them straight away, and flag the big ones for a personal call.",
  detail:
    "The moment a customer accepts a quote, they get a confirmation telling them " +
    "what happens next — which is the gap most people leave. Anything over " +
    "$2,000 also raises a notification, so you can ring them the same day.",
  category: "winning-work",
  icon: "IconCircleCheck",
  nodes: [
    {
      key: "trigger",
      nodeType: "trigger.quote.accepted",
      label: "Quote accepted",
      parameters: {},
    },
    {
      key: "email",
      nodeType: "email.send",
      label: "Confirm and set expectations",
      parameters: {
        recipient: "customer",
        purpose: "transactional",
        subject: "Thanks for accepting quote {{quote.number}}",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Thanks for accepting quote {{quote.number}} for {{quote.total}}. " +
          "That is now booked in with us.\n\n" +
          "We will be in touch shortly to agree a date that works for you. If " +
          "there is a time that suits best, just reply and let us know.\n\n" +
          "Thanks,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
      },
    },
    {
      key: "check",
      nodeType: "condition.if",
      label: "Is it a big one?",
      parameters: {
        combinator: "and",
        rules: [
          { variable: "quote.total", operator: "greaterThanOrEqual", value: 2000 },
        ],
      },
    },
    {
      key: "notify",
      nodeType: "notification.internal",
      label: "Worth a phone call",
      parameters: {
        title: "{{customer.fullName}} accepted {{quote.total}}",
        description:
          "Quote {{quote.number}}. Worth a call today to lock in the date and " +
          "make a good first impression.",
      },
    },
    {
      key: "note",
      nodeType: "customer.addNote",
      label: "Log it on the customer",
      // The `false` branch, so a small accepted quote still leaves a trace.
      branchIndex: 1,
      parameters: {
        content:
          "Accepted quote {{quote.number}} for {{quote.total}} on {{now.date}}. " +
          "Confirmation email sent automatically.",
      },
    },
  ],
  edges: [
    { from: "trigger", to: "email" },
    { from: "email", to: "check" },
    { from: "check", fromHandle: "true", to: "notify" },
    { from: "check", fromHandle: "false", to: "note" },
  ],
};

/**
 * Reacting to a booking from the public portal.
 *
 * The portal already emails a confirmation, so this deliberately does not send
 * another — a template whose first act is to duplicate an email the product
 * already sends teaches the tenant that automations are noise. It notifies the
 * owner instead, which is the thing the portal does not do well.
 */
const newBookingHeadsUp: WorkflowTemplate = {
  id: "new-booking-heads-up",
  name: "Know about new bookings straight away",
  summary: "A notification the moment somebody books through your website.",
  detail:
    "When a booking comes in through your public booking page, this raises a " +
    "notification with who it is, what they want and when — and leaves a note on " +
    "the customer's record. It does not email the customer: your booking page " +
    "already confirms it for you.",
  category: "staying-on-top",
  icon: "IconBell",
  nodes: [
    {
      key: "trigger",
      nodeType: "trigger.booking.created",
      label: "Booking received",
      parameters: {},
    },
    {
      key: "notify",
      nodeType: "notification.internal",
      label: "Tell me now",
      parameters: {
        title: "New booking: {{customer.fullName}}",
        description:
          "{{booking.serviceType}} on {{booking.date}} at {{booking.startTime}}. " +
          "{{customer.phone}}",
      },
    },
    {
      key: "note",
      nodeType: "customer.addNote",
      label: "Log it",
      parameters: {
        content:
          "Booked {{booking.serviceType}} for {{booking.date}} at " +
          "{{booking.startTime}} via {{booking.source}}.",
      },
    },
  ],
  edges: [
    { from: "trigger", to: "notify" },
    { from: "notify", to: "note" },
  ],
};

/**
 * Welcoming a new customer.
 *
 * The shortest template on purpose. Somebody trying automation for the first
 * time should be able to read the whole thing in one screen and understand
 * exactly what it will do, and this is the one whose failure costs nothing.
 */
const welcomeNewCustomer: WorkflowTemplate = {
  id: "welcome-new-customer",
  name: "Welcome a new customer",
  summary: "A short introduction the first time somebody becomes a customer.",
  detail:
    "When a new customer is added, this sends them a brief hello with your " +
    "contact details, so the first email they have from you is not an invoice.",
  category: "keeping-customers",
  icon: "IconUser",
  nodes: [
    {
      key: "trigger",
      nodeType: "trigger.customer.created",
      label: "New customer added",
      parameters: {},
    },
    {
      key: "email",
      nodeType: "email.send",
      label: "Say hello",
      parameters: {
        recipient: "customer",
        subject: "Welcome to {{tenant.businessName}}",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Thanks for choosing {{tenant.businessName}}. It is good to have you " +
          "with us.\n\n" +
          "If you ever need us, you can reach me on {{tenant.phone}} or just " +
          "reply to this email — it comes straight to me.\n\n" +
          "Thanks,\n{{tenant.ownerName}}",
      },
    },
  ],
  edges: [{ from: "trigger", to: "email" }],
};

/**
 * The appointment reminder — the automation every service business asks for
 * first, and the one this product could not express until `delay.wait` learned
 * to anchor on a date the record carries.
 *
 * Neither other wait mode reaches it. A relative wait counts from when the
 * booking was *made*, which is anywhere from ten minutes to three months before
 * the appointment; a typed date is the same day for every customer. The whole
 * category — remind before the visit, chase before the quote expires, warn
 * before the warranty ends — needs the date to come out of the row.
 *
 * `ifPassed: "skip"` is doing real work here. A booking taken for tomorrow
 * afternoon makes "the day before" a moment that is already gone, and carrying
 * on regardless would email "your appointment is tomorrow" to somebody expecting
 * an engineer in the morning. Stopping is the correct answer for a reminder and
 * the run log says so.
 *
 * `purpose: "transactional"`: this is a message about an appointment they booked,
 * not marketing, so it reaches someone who has opted out of the latter — which
 * is the reading `lib/email-consent.ts` requires and the distinction the law
 * draws.
 */
const remindBeforeAppointment: WorkflowTemplate = {
  id: "remind-before-appointment",
  name: "Remind customers before their appointment",
  summary: "A short note the morning before, so fewer people forget you are coming.",
  detail:
    "As soon as a booking is made, this waits until 9am the day before the " +
    "appointment and sends the customer a reminder with the date, the time and " +
    "what they booked. Bookings made less than a day out are left alone, since " +
    "a reminder that arrives after the fact is worse than none.",
  category: "staying-on-top",
  icon: "IconBell",
  nodes: [
    {
      key: "trigger",
      nodeType: "trigger.booking.created",
      label: "A booking is made",
      // No source filter: a booking typed in by phone deserves the reminder just
      // as much as one from the portal, and more — nobody emailed them a
      // confirmation to keep.
      parameters: {},
    },
    {
      key: "wait",
      nodeType: "delay.wait",
      label: "Until the morning before",
      parameters: {
        mode: "untilField",
        dateField: "booking.date",
        offsetDirection: "before",
        offset: { amount: 1, unit: "days" },
        atTime: "09:00",
        ifPassed: "skip",
      },
    },
    {
      key: "email",
      nodeType: "email.send",
      label: "Reminder",
      parameters: {
        recipient: "customer",
        purpose: "transactional",
        subject: "Reminder: we are visiting tomorrow",
        body:
          "Hi {{customer.firstName}},\n\n" +
          "Just a reminder that we are booked in for {{booking.serviceType}} " +
          "tomorrow, {{booking.date}}, at {{booking.startTime}}.\n\n" +
          "If tomorrow no longer works, reply to this email and we will find " +
          "another time.\n\n" +
          "See you then,\n{{tenant.ownerName}}\n{{tenant.businessName}}",
      },
    },
  ],
  edges: [
    { from: "trigger", to: "wait" },
    { from: "wait", to: "email" },
  ],
};

/**
 * Every template, in gallery order.
 *
 * Ordered by how likely a contractor is to want it on day one, not
 * alphabetically and not by category. Getting paid comes first because it is the
 * reason anybody opens this page.
 */
export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  chaseOverdueInvoices,
  remindBeforeAppointment,
  askForReview,
  followUpAcceptedQuote,
  newBookingHeadsUp,
  welcomeNewCustomer,
];

export function getTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((template) => template.id === id);
}
