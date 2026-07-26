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
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const client = getResend();
  if (!client) {
    console.warn(
      `[email:${options.tag}] RESEND_API_KEY not configured — skipping email to ${options.to}`
    );
    return;
  }

  // env.ts guarantees a sender whenever RESEND_API_KEY is set; this narrows the type.
  const from = env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn(
      `[email:${options.tag}] RESEND_FROM_EMAIL not configured — skipping email to ${options.to}`
    );
    return;
  }

  try {
    await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
  } catch (error) {
    console.error(`[email:${options.tag}] Failed to send to ${options.to}:`, error);
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

export async function sendContractRenewalEmail(data: {
  to: string;
  props: ContractRenewalEmailProps;
}): Promise<void> {
  const { renderContractRenewalEmail } = await import("@hvac-saas/email");
  const html = await renderContractRenewalEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`Maintenance Contract Expiring — ${data.props.businessName}`),
    html,
    tag: "E-09:contract-renewal",
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

export async function sendReviewRequestEmail(data: {
  to: string;
  props: ReviewRequestEmailProps;
}): Promise<void> {
  const { renderReviewRequestEmail } = await import("@hvac-saas/email");
  const html = await renderReviewRequestEmail(data.props);
  await sendEmail({
    to: data.to,
    subject: sanitizeSubject(`How did we do? — ${data.props.businessName}`),
    html,
    tag: "E-12:review-request",
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
