/**
 * `VARIABLES` — every templatable value in the product, declared once.
 *
 * See `./types.ts` for why this is one array rather than a path list plus a
 * resolver map. Everything downstream is derived: `VARIABLE_MAP` for the
 * resolver, `variablesForSubject()` for the picker, `suggestVariables()` for
 * "did you mean", and a registry test that walks the whole table.
 *
 * ## Two rules the entries follow
 *
 * **Money is a decimal string, never a number.** Drizzle returns `numeric` as a
 * string and it is passed through untouched; `format: "money"` renders it. A
 * `Number()` here would be a float, and the costing work established that a
 * margin is a *difference of two sums*, so float error there is doubled.
 *
 * **Null is null, not `""`.** A variable that has no value resolves to null and
 * the interpolator renders an empty string, having first logged a diagnostic.
 * Coercing here would make "this customer has no phone number" indistinguishable
 * from "this variable does not exist", which is the difference between a blank
 * email and a support ticket.
 */

import type { SubjectType } from "../node-definition.js";
import type { VariableDef } from "./types.js";
import type { ExecutionContext } from "../execution-context.js";

/**
 * Stamp `providedBy` onto a whole namespace.
 *
 * Written as a typed helper rather than a `.map(…) as VariableDef[]`: the cast
 * would compile even if a member of the array were missing `resolve`, and
 * [[strict-rules]] §4 exists because casts hide exactly that. `Omit` gives the
 * compiler the same job with none of the blindness.
 */
function scoped(
  subject: SubjectType,
  defs: Omit<VariableDef, "providedBy">[],
): VariableDef[] {
  return defs.map((def) => ({ ...def, providedBy: [subject] }));
}

/** Reads a field off an optional namespace without repeating the guard. */
function from<T, K extends keyof T>(
  pick: (ctx: ExecutionContext) => T | null | undefined,
  key: K,
) {
  return (ctx: ExecutionContext): unknown => {
    const source = pick(ctx);
    return source ? (source[key] ?? null) : null;
  };
}

const customer = (ctx: ExecutionContext) => ctx.customer;
const job = (ctx: ExecutionContext) => ctx.job;
const invoice = (ctx: ExecutionContext) => ctx.invoice;
const quote = (ctx: ExecutionContext) => ctx.quote;
const booking = (ctx: ExecutionContext) => ctx.booking;
const equipment = (ctx: ExecutionContext) => ctx.equipment;
const contract = (ctx: ExecutionContext) => ctx.contract;
const tenant = (ctx: ExecutionContext) => ctx.tenant;
const assignee = (ctx: ExecutionContext) => ctx.assignee;

/**
 * Every subject type resolves a customer, which is what makes the whole
 * namespace unconditional (wf-00 D-02) — `{{customer.email}}` works on a
 * job-, invoice- or booking-triggered run without the author thinking about it.
 */
const CUSTOMER_VARIABLES: VariableDef[] = [
  {
    path: "customer.id",
    label: "Customer ID",
    description: "Internal identifier. Useful in a webhook, rarely in an email.",
    type: "string",
    sample: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    resolve: from(customer, "id"),
  },
  {
    path: "customer.firstName",
    label: "First name",
    description: "The customer's first name.",
    type: "string",
    encoding: "html",
    sample: "Dana",
    resolve: from(customer, "firstName"),
  },
  {
    path: "customer.lastName",
    label: "Last name",
    description: "The customer's last name.",
    type: "string",
    encoding: "html",
    sample: "Whitfield",
    resolve: from(customer, "lastName"),
  },
  {
    path: "customer.fullName",
    label: "Full name",
    description: "First and last name together.",
    type: "string",
    encoding: "html",
    sample: "Dana Whitfield",
    resolve: from(customer, "fullName"),
  },
  {
    path: "customer.email",
    label: "Email address",
    description: "Blank if you have never recorded one.",
    type: "string",
    encoding: "html",
    sample: "dana@example.com",
    resolve: from(customer, "email"),
  },
  {
    path: "customer.phone",
    label: "Phone number",
    description: "Formatted for reading, not for dialling.",
    type: "string",
    format: "phone",
    encoding: "html",
    sample: "(312) 555-0148",
    resolve: from(customer, "phone"),
  },
  {
    path: "customer.address",
    label: "Street address",
    description: "Street line only — see Full address for everything.",
    type: "string",
    encoding: "html",
    sample: "1420 W 18th St",
    resolve: from(customer, "address"),
  },
  {
    path: "customer.city",
    label: "City",
    description: "The customer's city.",
    type: "string",
    encoding: "html",
    sample: "Chicago",
    resolve: from(customer, "city"),
  },
  {
    path: "customer.state",
    label: "State",
    description: "The customer's state or region.",
    type: "string",
    encoding: "html",
    sample: "IL",
    resolve: from(customer, "state"),
  },
  {
    path: "customer.zipCode",
    label: "ZIP / postcode",
    description: "The customer's postal code.",
    type: "string",
    encoding: "html",
    sample: "60608",
    resolve: from(customer, "zipCode"),
  },
  {
    path: "customer.fullAddress",
    label: "Full address",
    description: "Street, city, state and postcode on one line.",
    type: "string",
    encoding: "html",
    sample: "1420 W 18th St, Chicago, IL 60608",
    resolve: from(customer, "fullAddress"),
  },
  {
    path: "customer.notes",
    label: "Customer notes",
    description:
      "The notes field on the customer record. Internal — think before putting it in an email.",
    type: "string",
    encoding: "html",
    sample: "Gate code 4417. Dog in the yard.",
    resolve: from(customer, "notes"),
  },
  {
    path: "customer.isOptedOut",
    label: "Unsubscribed",
    description:
      "True if they have asked to stop receiving marketing email. The Send Email node checks this itself; this is for conditions.",
    type: "boolean",
    sample: "false",
    resolve: from(customer, "isOptedOut"),
  },
];

const JOB_VARIABLES: VariableDef[] = scoped("job", [
  { path: "job.id", label: "Job ID", description: "Internal identifier.", type: "string", sample: "9c1d…", resolve: from(job, "id") },
  { path: "job.number", label: "Job number", description: "The number you and the customer both see.", type: "string", encoding: "html", sample: "JOB-1042", resolve: from(job, "number") },
  { path: "job.title", label: "Job title", description: "What the job is called.", type: "string", encoding: "html", sample: "Annual furnace service", resolve: from(job, "title") },
  { path: "job.description", label: "Description", description: "The longer description on the job.", type: "string", encoding: "html", sample: "Replace filter, check burner, test CO.", resolve: from(job, "description") },
  {
    path: "job.serviceType",
    label: "Service type",
    description: "Maintenance, Repair, Installation and so on.",
    type: "string",
    // Without this the raw enum reaches the inbox: "Your maintenance visit" is
    // a sentence, "Your maintenance_contract visit" is a leaked column.
    format: "titleCase",
    encoding: "html",
    sample: "Maintenance",
    resolve: from(job, "serviceType"),
  },
  { path: "job.priority", label: "Priority", description: "Standard, Urgent or Emergency.", type: "string", format: "titleCase", encoding: "html", sample: "Standard", resolve: from(job, "priority") },
  { path: "job.status", label: "Status", description: "The stage name as it appears on your board.", type: "string", encoding: "html", sample: "In Progress", resolve: from(job, "status") },
  { path: "job.stageName", label: "Stage", description: "The column the job is in.", type: "string", encoding: "html", sample: "Awaiting Parts", resolve: from(job, "stageName") },
  {
    path: "job.stageLifecycle",
    label: "Stage type",
    description:
      "Which of the four real states the stage means: scheduled, in progress, completed or cancelled. Filter on this, not on the stage name — a tenant can call a stage anything.",
    type: "string",
    sample: "in_progress",
    resolve: from(job, "stageLifecycle"),
  },
  { path: "job.pipelineName", label: "Pipeline", description: "Which board the job is on.", type: "string", encoding: "html", sample: "Residential", resolve: from(job, "pipelineName") },
  { path: "job.scheduledDate", label: "Scheduled date", description: "The day the job is booked for.", type: "date", format: "date", sample: "Aug 8, 2026", resolve: from(job, "scheduledDate") },
  { path: "job.scheduledStart", label: "Start time", description: "Start time, in your business's timezone.", type: "time", format: "time", sample: "9:00 AM CDT", resolve: from(job, "scheduledStart") },
  { path: "job.scheduledEnd", label: "End time", description: "End time, in your business's timezone.", type: "time", format: "time", sample: "11:00 AM CDT", resolve: from(job, "scheduledEnd") },
  { path: "job.address", label: "Service address", description: "Where the work is. Falls back to the customer's address if the job has none.", type: "string", encoding: "html", sample: "1420 W 18th St, Chicago, IL 60608", resolve: from(job, "address") },
  { path: "job.subtotal", label: "Subtotal", description: "Before tax.", type: "money", format: "money", sample: "$420.00", resolve: from(job, "subtotal") },
  { path: "job.taxAmount", label: "Tax", description: "Tax on this job.", type: "money", format: "money", sample: "$34.65", resolve: from(job, "taxAmount") },
  { path: "job.total", label: "Total", description: "What the job comes to.", type: "money", format: "money", sample: "$454.65", resolve: from(job, "total") },
  { path: "job.assigneeName", label: "Assigned to", description: "The technician on the job. Blank if nobody is assigned.", type: "string", encoding: "html", sample: "Marcus Webb", resolve: from(job, "assigneeName") },
  { path: "job.assigneeEmail", label: "Assignee email", description: "Their email address.", type: "string", encoding: "html", sample: "marcus@example.com", resolve: from(job, "assigneeEmail") },
  { path: "job.completedAt", label: "Completed at", description: "When the job was marked complete.", type: "datetime", format: "datetime", sample: "Aug 8, 2026 3:30 PM CDT", resolve: from(job, "completedAt") },
  { path: "job.actualHours", label: "Hours worked", description: "Hours recorded against the job. Blank if nobody entered any.", type: "number", sample: "2.5", resolve: from(job, "actualHours") },
  {
    path: "job.marginPercent",
    label: "Margin %",
    description:
      "Profit margin. **Blank when the job is not fully costed** — an unknown cost makes the figure incomplete, not zero.",
    type: "number",
    format: "percent",
    sample: "38%",
    resolve: (ctx) => {
      const m = ctx.job?.marginPercent;
      // Divided by 100 because `format: "percent"` multiplies back up — margins
      // are stored as a percentage and tax rates as a fraction, and one
      // formatter serves both.
      return m === null || m === undefined ? null : m / 100;
    },
  },
  {
    path: "job.costCoverage",
    label: "Cost coverage",
    description:
      "Whether the cost side is complete, partial or missing. Gate a margin automation on this — a half-costed job reads as pure profit.",
    type: "string",
    sample: "complete",
    resolve: from(job, "costCoverage"),
  },
]);

const INVOICE_VARIABLES: VariableDef[] = scoped("invoice", [
  { path: "invoice.id", label: "Invoice ID", description: "Internal identifier.", type: "string", sample: "5a7b…", resolve: from(invoice, "id") },
  { path: "invoice.number", label: "Invoice number", description: "The number on the document.", type: "string", encoding: "html", sample: "INV-2048", resolve: from(invoice, "number") },
  { path: "invoice.status", label: "Status", description: "Draft, Sent, Partially Paid, Paid, Overdue or Void.", type: "string", format: "titleCase", encoding: "html", sample: "Overdue", resolve: from(invoice, "status") },
  { path: "invoice.issueDate", label: "Issue date", description: "When it was raised.", type: "date", format: "date", sample: "Jul 9, 2026", resolve: from(invoice, "issueDate") },
  { path: "invoice.dueDate", label: "Due date", description: "When payment is due.", type: "date", format: "date", sample: "Aug 8, 2026", resolve: from(invoice, "dueDate") },
  { path: "invoice.subtotal", label: "Subtotal", description: "Before tax.", type: "money", format: "money", sample: "$1,150.00", resolve: from(invoice, "subtotal") },
  { path: "invoice.taxAmount", label: "Tax", description: "Tax on this invoice.", type: "money", format: "money", sample: "$94.88", resolve: from(invoice, "taxAmount") },
  { path: "invoice.total", label: "Total", description: "The full amount.", type: "money", format: "money", sample: "$1,244.88", resolve: from(invoice, "total") },
  { path: "invoice.amountPaid", label: "Amount paid", description: "How much has been received.", type: "money", format: "money", sample: "$500.00", resolve: from(invoice, "amountPaid") },
  { path: "invoice.balanceDue", label: "Balance due", description: "What is still owed. This is the number a chaser email should use.", type: "money", format: "money", sample: "$744.88", resolve: from(invoice, "balanceDue") },
  { path: "invoice.daysOverdue", label: "Days overdue", description: "Days past the due date. Blank if it is not overdue.", type: "number", sample: "12", resolve: from(invoice, "daysOverdue") },
  { path: "invoice.paymentTerms", label: "Payment terms", description: "Net 30 and so on.", type: "string", encoding: "html", sample: "Net 30", resolve: from(invoice, "paymentTerms") },
  { path: "invoice.publicUrl", label: "Invoice link", description: "A link the customer can open without logging in.", type: "string", encoding: "url", sample: "https://app.zaxvio.com/i/…", resolve: from(invoice, "publicUrl") },
]);

const QUOTE_VARIABLES: VariableDef[] = scoped("quote", [
  { path: "quote.id", label: "Estimate ID", description: "Internal identifier.", type: "string", sample: "7d3e…", resolve: from(quote, "id") },
  { path: "quote.number", label: "Estimate number", description: "The number on the document.", type: "string", encoding: "html", sample: "QT-0311", resolve: from(quote, "number") },
  { path: "quote.status", label: "Status", description: "Draft, Sent, Accepted, Declined or Expired.", type: "string", format: "titleCase", encoding: "html", sample: "Sent", resolve: from(quote, "status") },
  { path: "quote.issueDate", label: "Issue date", description: "When it was raised.", type: "date", format: "date", sample: "Aug 1, 2026", resolve: from(quote, "issueDate") },
  { path: "quote.expiryDate", label: "Expiry date", description: "When it stops being valid.", type: "date", format: "date", sample: "Aug 31, 2026", resolve: from(quote, "expiryDate") },
  { path: "quote.subtotal", label: "Subtotal", description: "Before tax.", type: "money", format: "money", sample: "$2,400.00", resolve: from(quote, "subtotal") },
  { path: "quote.taxAmount", label: "Tax", description: "Tax on this estimate.", type: "money", format: "money", sample: "$198.00", resolve: from(quote, "taxAmount") },
  { path: "quote.total", label: "Total", description: "What the estimate comes to.", type: "money", format: "money", sample: "$2,598.00", resolve: from(quote, "total") },
  { path: "quote.publicUrl", label: "Estimate link", description: "The customer's copy, no login needed.", type: "string", encoding: "url", sample: "https://app.zaxvio.com/quote/…", resolve: from(quote, "publicUrl") },
  {
    path: "quote.acceptUrl",
    label: "Accept link",
    description:
      "Takes the customer straight to accepting. Blank when online acceptance is turned off — send the estimate link instead.",
    type: "string",
    encoding: "url",
    sample: "https://app.zaxvio.com/quote/…#accept",
    resolve: from(quote, "acceptUrl"),
  },
]);

const BOOKING_VARIABLES: VariableDef[] = scoped("booking", [
  { path: "booking.id", label: "Booking ID", description: "Internal identifier.", type: "string", sample: "b41c…", resolve: from(booking, "id") },
  { path: "booking.date", label: "Booking date", description: "The day requested.", type: "date", format: "date", sample: "Aug 12, 2026", resolve: from(booking, "date") },
  { path: "booking.startTime", label: "Start time", description: "The time requested, in your timezone.", type: "time", format: "time", sample: "9:00 AM CDT", resolve: from(booking, "startTime") },
  { path: "booking.endTime", label: "End time", description: "When the slot ends.", type: "time", format: "time", sample: "10:00 AM CDT", resolve: from(booking, "endTime") },
  { path: "booking.serviceType", label: "Service type", description: "What they asked for.", type: "string", format: "titleCase", encoding: "html", sample: "Repair", resolve: from(booking, "serviceType") },
  { path: "booking.status", label: "Status", description: "Pending, Confirmed, Cancelled or Completed.", type: "string", format: "titleCase", encoding: "html", sample: "Pending", resolve: from(booking, "status") },
  { path: "booking.source", label: "Source", description: "Where it came from — your booking page, an embed, the API.", type: "string", encoding: "html", sample: "portal", resolve: from(booking, "source") },
  { path: "booking.notes", label: "Customer's message", description: "What the customer typed when booking.", type: "string", encoding: "html", sample: "AC making a buzzing noise upstairs.", resolve: from(booking, "notes") },
]);

const EQUIPMENT_VARIABLES: VariableDef[] = scoped("equipment", [
  { path: "equipment.id", label: "Asset ID", description: "Internal identifier.", type: "string", sample: "e77a…", resolve: from(equipment, "id") },
  { path: "equipment.name", label: "Asset name", description: "What the asset is called.", type: "string", encoding: "html", sample: "Upstairs furnace", resolve: from(equipment, "name") },
  { path: "equipment.type", label: "Asset type", description: "The kind of equipment.", type: "string", format: "titleCase", encoding: "html", sample: "Furnace", resolve: from(equipment, "type") },
  { path: "equipment.make", label: "Make", description: "Manufacturer.", type: "string", encoding: "html", sample: "Carrier", resolve: from(equipment, "make") },
  { path: "equipment.model", label: "Model", description: "Model number.", type: "string", encoding: "html", sample: "59TP6B", resolve: from(equipment, "model") },
  { path: "equipment.serialNumber", label: "Serial number", description: "Serial number.", type: "string", encoding: "html", sample: "4218H31742", resolve: from(equipment, "serialNumber") },
  { path: "equipment.installDate", label: "Installed", description: "When it went in.", type: "date", format: "date", sample: "Mar 4, 2019", resolve: from(equipment, "installDate") },
  { path: "equipment.warrantyExpiresAt", label: "Warranty ends", description: "When the warranty runs out.", type: "date", format: "date", sample: "Mar 4, 2029", resolve: from(equipment, "warrantyExpiresAt") },
  { path: "equipment.location", label: "Location", description: "Where on the property it is.", type: "string", encoding: "html", sample: "Attic", resolve: from(equipment, "location") },
]);

const CONTRACT_VARIABLES: VariableDef[] = scoped("maintenance_contract", [
  { path: "contract.id", label: "Agreement ID", description: "Internal identifier.", type: "string", sample: "c902…", resolve: from(contract, "id") },
  { path: "contract.name", label: "Agreement name", description: "What the plan is called.", type: "string", encoding: "html", sample: "Annual Maintenance Plan", resolve: from(contract, "name") },
  { path: "contract.startDate", label: "Starts", description: "When cover begins.", type: "date", format: "date", sample: "Sep 1, 2025", resolve: from(contract, "startDate") },
  { path: "contract.endDate", label: "Ends", description: "When cover runs out.", type: "date", format: "date", sample: "Aug 31, 2026", resolve: from(contract, "endDate") },
  { path: "contract.annualPrice", label: "Annual price", description: "What it costs per year.", type: "money", format: "money", sample: "$349.00", resolve: from(contract, "annualPrice") },
  { path: "contract.visitsPerYear", label: "Visits per year", description: "How many visits are included.", type: "number", sample: "2", resolve: from(contract, "visitsPerYear") },
  { path: "contract.frequency", label: "Frequency", description: "How often visits are due.", type: "string", format: "titleCase", encoding: "html", sample: "Semi Annual", resolve: from(contract, "frequency") },
  { path: "contract.nextVisitDue", label: "Next visit due", description: "When the next visit should happen.", type: "date", format: "date", sample: "Sep 15, 2026", resolve: from(contract, "nextVisitDue") },
]);

/** Always available — the business sending the message. */
const TENANT_VARIABLES: VariableDef[] = [
  { path: "tenant.businessName", label: "Business name", description: "Your business name.", type: "string", encoding: "html", sample: "Shihab Housing", resolve: from(tenant, "businessName") },
  { path: "tenant.ownerName", label: "Owner name", description: "Whoever owns the account.", type: "string", encoding: "html", sample: "Shihab Rahman", resolve: from(tenant, "ownerName") },
  { path: "tenant.email", label: "Business email", description: "Your contact address.", type: "string", encoding: "html", sample: "hello@shihabhousing.com", resolve: from(tenant, "email") },
  { path: "tenant.phone", label: "Business phone", description: "Your contact number.", type: "string", format: "phone", encoding: "html", sample: "(312) 555-0148", resolve: from(tenant, "phone") },
  { path: "tenant.address", label: "Business address", description: "Street line only.", type: "string", encoding: "html", sample: "88 N Halsted St", resolve: from(tenant, "address") },
  { path: "tenant.city", label: "City", description: "Your city.", type: "string", encoding: "html", sample: "Chicago", resolve: from(tenant, "city") },
  { path: "tenant.state", label: "State", description: "Your state or region.", type: "string", encoding: "html", sample: "IL", resolve: from(tenant, "state") },
  { path: "tenant.zipCode", label: "ZIP / postcode", description: "Your postal code.", type: "string", encoding: "html", sample: "60661", resolve: from(tenant, "zipCode") },
  { path: "tenant.fullAddress", label: "Full address", description: "Everything on one line.", type: "string", encoding: "html", sample: "88 N Halsted St, Chicago, IL 60661", resolve: from(tenant, "fullAddress") },
  { path: "tenant.logoUrl", label: "Logo URL", description: "Your logo. The email templates already include it.", type: "string", encoding: "url", sample: "https://cdn.zaxvio.com/…/logo.png", resolve: from(tenant, "logoUrl") },
  { path: "tenant.licenseNumber", label: "Licence number", description: "Printed on quotes and invoices where required.", type: "string", encoding: "html", sample: "IL-HVAC-118342", resolve: from(tenant, "licenseNumber") },
  { path: "tenant.bookingUrl", label: "Booking page", description: "Your public booking link.", type: "string", encoding: "url", sample: "https://app.zaxvio.com/book/shihab-housing", resolve: from(tenant, "bookingUrl") },
  { path: "tenant.googleReviewUrl", label: "Review link", description: "Where to send customers to leave a review.", type: "string", encoding: "url", sample: "https://g.page/r/…/review", resolve: from(tenant, "googleReviewUrl") },
  { path: "tenant.timezone", label: "Timezone", description: "The timezone every date and time in this automation is rendered in.", type: "string", sample: "America/Chicago", resolve: from(tenant, "timezone") },
];

const ASSIGNEE_VARIABLES: VariableDef[] = [
  { path: "assignee.id", label: "Assignee ID", description: "Internal identifier.", type: "string", sample: "user_2abcDEF", resolve: from(assignee, "id") },
  { path: "assignee.name", label: "Assignee name", description: "The technician assigned to the job.", type: "string", encoding: "html", sample: "Marcus Webb", resolve: from(assignee, "name") },
  { path: "assignee.email", label: "Assignee email", description: "Their email address.", type: "string", encoding: "html", sample: "marcus@example.com", resolve: from(assignee, "email") },
];

/**
 * `now.*` — computed at interpolation time in the **workflow's** zone.
 *
 * The resolvers return raw values and the formatter renders them, so `now.date`
 * and `job.scheduledDate` print identically. Rendering here would give the
 * workflow two date formats and no way to tell which produced which.
 */
const NOW_VARIABLES: VariableDef[] = [
  {
    path: "now.date",
    label: "Today's date",
    description: "Today, in your business's timezone.",
    type: "date",
    format: "date",
    sample: "Aug 8, 2026",
    resolve: (ctx) => isoDateInZone(new Date(), ctx.timezone),
  },
  {
    path: "now.datetime",
    label: "Right now",
    description: "The current date and time, with the timezone shown.",
    type: "datetime",
    format: "datetime",
    sample: "Aug 8, 2026 3:30 PM CDT",
    resolve: () => new Date().toISOString(),
  },
  {
    path: "now.time",
    label: "Current time",
    description: "The time right now, in your business's timezone.",
    type: "time",
    format: "time",
    sample: "3:30 PM CDT",
    resolve: (ctx) => isoTimeInZone(new Date(), ctx.timezone),
  },
  {
    path: "now.dayOfWeek",
    label: "Day of the week",
    description: "Monday, Tuesday, and so on.",
    type: "string",
    sample: "Saturday",
    resolve: (ctx) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: ctx.timezone,
        weekday: "long",
      }).format(new Date()),
  },
  {
    path: "now.year",
    label: "Year",
    description: "The current year — for a copyright line, say.",
    type: "number",
    sample: "2026",
    resolve: (ctx) =>
      Number(isoDateInZone(new Date(), ctx.timezone).slice(0, 4)),
  },
  {
    path: "now.month",
    label: "Month",
    description: "The current month by name.",
    type: "string",
    sample: "August",
    resolve: (ctx) =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: ctx.timezone,
        month: "long",
      }).format(new Date()),
  },
];

export const VARIABLES: VariableDef[] = [
  ...CUSTOMER_VARIABLES,
  ...JOB_VARIABLES,
  ...INVOICE_VARIABLES,
  ...QUOTE_VARIABLES,
  ...BOOKING_VARIABLES,
  ...EQUIPMENT_VARIABLES,
  ...CONTRACT_VARIABLES,
  ...TENANT_VARIABLES,
  ...ASSIGNEE_VARIABLES,
  ...NOW_VARIABLES,
];

/** Path → definition. The resolver's only lookup, built once. */
export const VARIABLE_MAP: ReadonlyMap<string, VariableDef> = new Map(
  VARIABLES.map((v) => [v.path, v]),
);

/**
 * What the picker offers for a given subject.
 *
 * A booking-triggered automation is not offered `{{invoice.balanceDue}}`. This
 * is cheap because `providedBy` is on the declaration, and it is the difference
 * between a blank email and a support ticket (FE-V2).
 */
export function variablesForSubject(
  subject: SubjectType | null | undefined,
): VariableDef[] {
  // Typed as `SubjectType`, not `string`. A `string` parameter forces an
  // `includes(subject as never)` at the call below, and [[strict-rules]] §4
  // bans that for a good reason — the cast would also silence a genuine typo.
  return VARIABLES.filter(
    (v) => !v.providedBy || (subject != null && v.providedBy.includes(subject)),
  );
}

/** `customer.firstName` → `customer`. */
export function namespaceOf(path: string): string {
  const dot = path.indexOf(".");
  return dot === -1 ? path : path.slice(0, dot);
}

/**
 * "Did you mean?" for an unresolved path.
 *
 * Same namespace first, then edit distance. Free, because the table exists — and
 * without it a typo produces a blank email and nothing else, which is the least
 * debuggable failure this feature can have.
 */
export function suggestVariables(path: string, limit = 3): string[] {
  const namespace = namespaceOf(path);
  const target = path.toLowerCase();

  return VARIABLES.map((v) => ({
    path: v.path,
    // A same-namespace candidate wins ties: someone who typed `customer.emial`
    // meant something in `customer.`, and offering `tenant.email` is noise.
    score:
      editDistance(v.path.toLowerCase(), target) -
      (namespaceOf(v.path) === namespace ? 2 : 0),
  }))
    .sort((a, b) => a.score - b.score)
    .filter((c) => c.score <= 5)
    .slice(0, limit)
    .map((c) => c.path);
}

/** Levenshtein, two rows. Small inputs; clarity over cleverness. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** `YYYY-MM-DD` for an instant in a zone. `en-CA` renders ISO order natively. */
function isoDateInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** `HH:MM:SS` for an instant in a zone, so `format: "time"` can render it. */
function isoTimeInZone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export * from "./types.js";
