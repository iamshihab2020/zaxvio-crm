// ── Templates ──
export {
  renderWelcomeEmail,
  WelcomeEmail,
  type WelcomeEmailProps,
} from "./templates/e01-welcome.js";

export {
  renderBookingConfirmationEmail,
  BookingConfirmationEmail,
  type BookingConfirmationEmailProps,
} from "./templates/e02-booking-confirmation.js";

export {
  renderNewBookingNotificationEmail,
  NewBookingNotificationEmail,
  type NewBookingNotificationEmailProps,
} from "./templates/e03-new-booking-notification.js";

export {
  renderBookingConfirmedEmail,
  BookingConfirmedEmail,
  type BookingConfirmedEmailProps,
} from "./templates/e04-booking-confirmed.js";

export {
  renderJobCompletionEmail,
  JobCompletionEmail,
  type JobCompletionEmailProps,
} from "./templates/e05-job-completion.js";

export {
  renderInvoiceEmail,
  InvoiceEmail,
  type InvoiceEmailProps,
} from "./templates/e06-invoice.js";

export {
  renderInvoiceOverdueEmail,
  InvoiceOverdueEmail,
  type InvoiceOverdueEmailProps,
} from "./templates/e07-invoice-overdue.js";

export {
  renderPaymentReceiptEmail,
  PaymentReceiptEmail,
  type PaymentReceiptEmailProps,
} from "./templates/e08-payment-receipt.js";

export {
  renderContractRenewalEmail,
  ContractRenewalEmail,
  type ContractRenewalEmailProps,
} from "./templates/e09-contract-renewal.js";

export {
  renderTrialExpiringEmail,
  TrialExpiringEmail,
  type TrialExpiringEmailProps,
} from "./templates/e10-trial-expiring.js";

export {
  renderWelcomePaidEmail,
  WelcomePaidEmail,
  type WelcomePaidEmailProps,
} from "./templates/e11-welcome-paid.js";

export {
  renderReviewRequestEmail,
  ReviewRequestEmail,
  type ReviewRequestEmailProps,
} from "./templates/e12-review-request.js";

export {
  renderQuoteEmail,
  QuoteEmail,
  type QuoteEmailProps,
} from "./templates/e13-quote.js";

export {
  renderBookingCancelledEmail,
  BookingCancelledEmail,
  type BookingCancelledEmailProps,
} from "./templates/e14-booking-cancelled.js";

export {
  renderNotificationEmail,
  NotificationEmail,
  type NotificationEmailProps,
} from "./templates/e15-notification.js";

export {
  renderTeamInvitationEmail,
  TeamInvitationEmail,
  type TeamInvitationEmailProps,
} from "./templates/team-invitation.js";

// ── Shared Components (for custom compositions) ──
export { EmailLayout, type EmailLayoutProps } from "./components/email-layout.js";
export { BrandButton, type BrandButtonProps } from "./components/brand-button.js";
export { DataTable, type DataTableProps, type LineItem } from "./components/data-table.js";
export { InfoRow, InfoRowGroup, type InfoRowProps } from "./components/info-row.js";
export { Heading, type HeadingProps } from "./components/heading.js";
