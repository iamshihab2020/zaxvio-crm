import { Resend } from "resend";
import { env } from "./env.js";
import type {
  WelcomeEmailProps,
  BookingConfirmationEmailProps,
  NewBookingNotificationEmailProps,
  BookingConfirmedEmailProps,
  JobCompletionEmailProps,
  InvoiceEmailProps,
  InvoiceOverdueEmailProps,
  PaymentReceiptEmailProps,
  ContractRenewalEmailProps,
  TrialExpiringEmailProps,
  WelcomePaidEmailProps,
  ReviewRequestEmailProps,
  QuoteEmailProps,
  TeamInvitationEmailProps,
  BookingCancelledEmailProps,
  NotificationEmailProps,
} from "@hvac-saas/email";

/** Strip CRLF/tab from email subject to prevent header injection */
export function sanitizeSubject(s: string): string {
  return s.replace(/[\r\n\t]/g, " ").slice(0, 200);
}

// ── Resend client (lazy init) ──

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

// ── Generic send helper ──

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
  /** Tag for dev-mode logging */
  tag: string;
  /**
   * The one-click unsubscribe URL for this recipient, when the message is
   * non-transactional.
   *
   * Passing it writes both `List-Unsubscribe` and `List-Unsubscribe-Post`.
   * Gmail and Yahoo require the pair of bulk senders, and this deployment sends
   * every tenant's mail from **one shared domain**, so a missing header is a
   * deliverability problem for every tenant rather than for the one whose email
   * it was — complaints score against the domain, not the sender.
   *
   * Transactional mail deliberately omits it: a receipt is not something a
   * recipient can decline, and offering to unsubscribe from one invites them to
   * try and then be surprised when the next invoice arrives anyway.
   */
  unsubscribeUrl?: string | null;
}

/**
 * What actually happened. Existing callers ignore it — adding a return value is
 * backward compatible — but anything that *records* a delivery must not report
 * `sent` when this returned `skipped` or `failed`.
 *
 * `skipped` is a configuration state (no API key, no verified sender), not a
 * failure: it is the normal state in development and it should not fill an
 * error log or a deliveries table with red.
 */
export type EmailOutcome =
  | { status: "sent" }
  | { status: "skipped"; reason: string }
  | { status: "failed"; reason: string };

export async function sendEmail(options: SendEmailOptions): Promise<EmailOutcome> {
  const client = getResend();
  if (!client) {
    console.warn(
      `[email:${options.tag}] RESEND_API_KEY not configured — skipping email to ${options.to}`
    );
    return { status: "skipped", reason: "Email sending is not configured" };
  }

  // env.ts guarantees a sender whenever RESEND_API_KEY is set; this narrows the type.
  const from = env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn(
      `[email:${options.tag}] RESEND_FROM_EMAIL not configured — skipping email to ${options.to}`
    );
    return { status: "skipped", reason: "No sender address is configured" };
  }

  try {
    const result = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
      // Resend passes custom headers straight through to the message.
      //
      // `List-Unsubscribe-Post` is what turns the header from "mailto or a link
      // somewhere" into the one-click control Gmail renders beside the sender
      // name — RFC 8058. Both must be present; a `List-Unsubscribe` on its own
      // does not satisfy the bulk-sender requirement.
      ...(options.unsubscribeUrl
        ? {
            headers: {
              "List-Unsubscribe": `<${options.unsubscribeUrl}/one-click>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }
        : {}),
    });

    // Resend reports a rejected send in the response body rather than by
    // throwing — an unverified sending domain comes back as a 403 *payload*, so
    // a bare try/catch would call that a success. This is the single most likely
    // failure in this deployment: the account has no verified domain yet.
    if (result.error) {
      console.error(
        `[email:${options.tag}] Resend refused the send to ${options.to}:`,
        result.error,
      );
      return { status: "failed", reason: result.error.message };
    }

    return { status: "sent" };
  } catch (error) {
    console.error(`[email:${options.tag}] Failed to send to ${options.to}:`, error);
    return {
      status: "failed",
      reason: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}

// ── Render helpers (lazy imports to avoid top-level await) ──

async function renderTemplate<P>(
  renderFn: () => Promise<{ default: (props: P) => Promise<string> }>,
  props: P
): Promise<string> {
  const mod = await renderFn();
  return mod.default(props);
}

// ── E-01: Welcome ──

export async function sendWelcomeEmail(data: {
  to: string;
  props: WelcomeEmailProps;
}): Promise<void> {
  const { renderWelcomeEmail } = await import("@hvac-saas/email");
  const html = await renderWelcomeEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Welcome to Zaxvio, ${data.props.businessName}!`),
    html,
    tag: "E-01:welcome",
  });
}

// ── E-02: Booking Confirmation (to customer) ──

export async function sendBookingConfirmationEmail(data: {
  to: string;
  props: BookingConfirmationEmailProps;
}): Promise<void> {
  const { renderBookingConfirmationEmail } = await import("@hvac-saas/email");
  const html = await renderBookingConfirmationEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Booking Confirmed — ${data.props.businessName}`),
    html,
    tag: "E-02:booking-confirmation",
  });
}

// ── E-03: New Booking Notification (to owner) ──

export async function sendNewBookingNotificationEmail(data: {
  to: string;
  props: NewBookingNotificationEmailProps;
}): Promise<void> {
  const { renderNewBookingNotificationEmail } = await import(
    "@hvac-saas/email"
  );
  const html = await renderNewBookingNotificationEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`New Booking: ${data.props.serviceType} on ${data.props.bookingDate}`),
    html,
    tag: "E-03:new-booking-notification",
  });
}

// ── E-04: Booking Confirmed by Owner (to customer) ──

export async function sendBookingConfirmedEmail(data: {
  to: string;
  props: BookingConfirmedEmailProps;
}): Promise<void> {
  const { renderBookingConfirmedEmail } = await import("@hvac-saas/email");
  const html = await renderBookingConfirmedEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Appointment Confirmed — ${data.props.businessName}`),
    html,
    tag: "E-04:booking-confirmed",
  });
}

// ── E-14: Booking Cancelled (to customer) ──

export async function sendBookingCancelledEmail(data: {
  to: string;
  props: BookingCancelledEmailProps;
}): Promise<void> {
  const { renderBookingCancelledEmail } = await import("@hvac-saas/email");
  const html = await renderBookingCancelledEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Appointment Cancelled — ${data.props.businessName}`),
    html,
    tag: "E-14:booking-cancelled",
  });
}

// ── E-05: Job Completion (to customer) ──

export async function sendJobCompletionEmail(data: {
  to: string;
  props: JobCompletionEmailProps;
}): Promise<void> {
  const { renderJobCompletionEmail } = await import("@hvac-saas/email");
  const html = await renderJobCompletionEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Service Complete — ${data.props.jobTitle} | ${data.props.businessName}`),
    html,
    tag: "E-05:job-completion",
  });
}

// ── E-06: Invoice (to customer, with PDF attachment) ──

export async function sendInvoiceEmail(data: {
  to: string;
  props: InvoiceEmailProps;
  pdf?: { buffer: Buffer; filename: string };
}): Promise<void> {
  const { renderInvoiceEmail } = await import("@hvac-saas/email");
  const html = await renderInvoiceEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Invoice ${data.props.invoiceNumber} from ${data.props.businessName}`),
    html,
    attachments: data.pdf ? [{ filename: data.pdf.filename, content: data.pdf.buffer }] : undefined,
    tag: "E-06:invoice",
  });
}

// ── E-07: Invoice Overdue Reminder (to customer) ──

export async function sendInvoiceOverdueEmail(data: {
  to: string;
  props: InvoiceOverdueEmailProps;
}): Promise<void> {
  const { renderInvoiceOverdueEmail } = await import("@hvac-saas/email");
  const html = await renderInvoiceOverdueEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Payment Reminder: Invoice ${data.props.invoiceNumber} — ${data.props.daysOverdue} days overdue`),
    html,
    tag: "E-07:invoice-overdue",
  });
}

// ── E-08: Payment Receipt (to customer) ──

export async function sendPaymentReceiptEmail(data: {
  to: string;
  props: PaymentReceiptEmailProps;
}): Promise<void> {
  const { renderPaymentReceiptEmail } = await import("@hvac-saas/email");
  const html = await renderPaymentReceiptEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Payment Received — ${data.props.businessName}`),
    html,
    tag: "E-08:payment-receipt",
  });
}

// ── E-09: Contract Renewal Reminder (to customer) ──

/** E-09 is a sales message about a contract nobody has renewed. Same rule as
 *  E-12: the unsubscribe URL is required, not optional. */
export async function sendContractRenewalEmail(data: {
  to: string;
  /** `unsubscribeUrl` is supplied beside this, not inside it — see below. */
  props: Omit<ContractRenewalEmailProps, "unsubscribeUrl">;
  unsubscribeUrl: string;
}): Promise<EmailOutcome> {
  const { renderContractRenewalEmail } = await import("@hvac-saas/email");
  // Same as E-12: the footer link and the List-Unsubscribe header are the same
  // URL, so it is supplied once and used twice here.
  const html = await renderContractRenewalEmail({
    ...data.props,
    unsubscribeUrl: data.unsubscribeUrl,
  });
  return sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Maintenance Contract Expiring — ${data.props.businessName}`),
    html,
    tag: "E-09:contract-renewal",
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

// ── E-10: Trial Expiring (to tenant owner) ──

export async function sendTrialExpiringEmail(data: {
  to: string;
  props: TrialExpiringEmailProps;
}): Promise<void> {
  const { renderTrialExpiringEmail } = await import("@hvac-saas/email");
  const html = await renderTrialExpiringEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Your Zaxvio trial expires in ${data.props.daysRemaining} day${data.props.daysRemaining === 1 ? "" : "s"}`),
    html,
    tag: "E-10:trial-expiring",
  });
}

// ── E-11: Welcome Paid (to tenant owner) ──

export async function sendWelcomePaidEmail(data: {
  to: string;
  props: WelcomePaidEmailProps;
}): Promise<void> {
  const { renderWelcomePaidEmail } = await import("@hvac-saas/email");
  const html = await renderWelcomePaidEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Welcome to Zaxvio Pro, ${data.props.businessName}!`),
    html,
    tag: "E-11:welcome-paid",
  });
}

// ── E-12: Review Request (to customer, 2h after invoice paid) ──

/**
 * E-12 is **not transactional** — nobody asks to be asked for a review — so
 * `unsubscribeUrl` is required rather than optional. A caller who has not
 * decided whether this recipient consented cannot type this call, which is the
 * point: DF-NOT-01 §4 asks for the exemption to be explicit in code, and the
 * mirror of that is that the *non*-exempt sends make the consent visible too.
 */
export async function sendReviewRequestEmail(data: {
  to: string;
  /** `unsubscribeUrl` is supplied beside this, not inside it — see below. */
  props: Omit<ReviewRequestEmailProps, "unsubscribeUrl">;
  unsubscribeUrl: string;
}): Promise<EmailOutcome> {
  const { renderReviewRequestEmail } = await import("@hvac-saas/email");
  // Merged in rather than asked of the caller. The wrapper already has the URL
  // — it hands it to `sendEmail` for the List-Unsubscribe header two lines
  // below — and requiring every call site to pass the same value twice is how
  // one of them ends up passing only one of the two.
  const html = await renderReviewRequestEmail({
    ...data.props,
    unsubscribeUrl: data.unsubscribeUrl,
  });
  return sendEmail({
    to: data.to,
    subject: sanitizeSubject(`How did we do? — ${data.props.businessName}`),
    html,
    tag: "E-12:review-request",
    unsubscribeUrl: data.unsubscribeUrl,
  });
}

// ── E-13: Quote / Estimate (to customer, with PDF attachment) ──

export async function sendQuoteEmail(data: {
  to: string;
  props: QuoteEmailProps;
  pdf?: { buffer: Buffer; filename: string };
}): Promise<void> {
  const { renderQuoteEmail } = await import("@hvac-saas/email");
  const html = await renderQuoteEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Your estimate from ${data.props.businessName} is ready — ${data.props.quoteNumber}`),
    html,
    attachments: data.pdf ? [{ filename: data.pdf.filename, content: data.pdf.buffer }] : undefined,
    tag: "E-13:quote",
  });
}

// ── E-15: Generic notification ──

/**
 * The catch-all transactional email: in-app notifications that the recipient
 * wants by email, and every automation "send email" step.
 *
 * This function existing is the fix for a live bug. `lib/notifications.ts` used
 * to feature-detect it — `if ("sendNotificationAlertEmail" in email)` — against
 * this module, and it was exported from nowhere, so the `default` branch of its
 * switch (every notification type except `booking_received`) fell through to a
 * `console.log` while `notification_deliveries` recorded `status: 'sent'`. The
 * lesson, written down in lessons/features-misc.md: never feature-detect code
 * you own. An import would have failed the build the day it was written.
 *
 * The subject is the title. It is sanitised here rather than at the call site,
 * because a title interpolated from a customer's name is exactly the header
 * injection vector security-rules §6 exists for.
 */
export async function sendNotificationAlertEmail(data: {
  to: string;
  props: NotificationEmailProps;
  /** Overrides the subject when the title alone reads oddly in an inbox. */
  subject?: string;
}): Promise<EmailOutcome> {
  const { renderNotificationEmail } = await import("@hvac-saas/email");
  const html = await renderNotificationEmail(data.props);
  return sendEmail({
    to: data.to,
    subject: sanitizeSubject(data.subject ?? data.props.title),
    html,
    tag: "E-15:notification",
  });
}

// ── Team Invitation (migrated from inline HTML) ──

export async function sendInvitationEmail(data: {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}): Promise<void> {
  const { renderTeamInvitationEmail } = await import("@hvac-saas/email");
  const html = await renderTeamInvitationEmail({
    inviterName: data.inviterName,
    organizationName: data.organizationName,
    role: data.role,
    inviteUrl: data.inviteUrl,
  });
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`You've been invited to join ${data.organizationName}`),
    html,
    tag: "team-invitation",
  });
}
