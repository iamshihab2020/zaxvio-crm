import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

/**
 * E-15 — the generic notification email.
 *
 * Two jobs.
 *
 * **One:** it closes a real bug. `apps/api/src/lib/notifications.ts` did
 * `if ("sendNotificationAlertEmail" in email) { … } else { console.log(…) }` —
 * feature-detecting a function in our own module. It was exported from nowhere,
 * so the `default` branch of that switch, meaning every notification type
 * except `booking_received`, logged to the server and returned, while step 9
 * recorded a `notification_deliveries` row with `status: 'sent'`. The audit
 * trail said the email went out. Nobody ever received one.
 *
 * **Two:** it is the surface every automation email node renders into. That is
 * why the props are fields rather than HTML — the automation supplies a
 * subject, a body and optionally one call to action, and the design lives here.
 * A rich-text body would hand a tenant an HTML injection surface aimed at their
 * own customers, for the benefit of letting them pick a font.
 *
 * `audience` is what makes one template serve both cases honestly. An internal
 * alert to the team should not carry an unsubscribe link — that link is a legal
 * obligation for marketing-adjacent mail to a customer, and a confusing footgun
 * on a message telling the owner their invoice was paid.
 */
export interface NotificationEmailProps {
  /** Who is reading. Drives the greeting and the footer. */
  audience: "team" | "customer";
  recipientName: string;

  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;

  /** The headline. Usually the notification title, or the automation's subject. */
  title: string;
  /**
   * Body copy. Plain text — newlines become paragraphs. Never HTML: this
   * renders values that came from a customer record, and interpolation
   * html-encodes them precisely so they cannot become markup here.
   */
  body: string;

  ctaLabel?: string | null;
  ctaUrl?: string | null;

  /**
   * The automation that sent this, if any.
   *
   * Printed in the footer — "Sent automatically by «Quote follow-up»". When a
   * customer replies "why did I get this?", the contractor needs to answer
   * without opening a support ticket, and an unattributed automated email is
   * the reason that question gets asked at all.
   */
  sentByAutomation?: string | null;

  /** Required for customer-facing automation mail. */
  unsubscribeUrl?: string | null;
}

export function NotificationEmail({
  audience,
  recipientName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  title,
  body,
  ctaLabel,
  ctaUrl,
  sentByAutomation,
  unsubscribeUrl,
}: NotificationEmailProps) {
  const firstName = recipientName.trim().split(" ")[0] || "there";
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <EmailLayout
      previewText={title}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
      // The link moved to the shared layout, so all fifteen templates get it
      // from one declaration instead of this one being the only template that
      // had one. Still gated on `audience`: a team member is not a subscriber
      // and has no consent to withdraw — their control is Settings →
      // Notifications, which is a different thing and a different link.
      unsubscribeUrl={audience === "customer" ? unsubscribeUrl : null}
    >
      <Heading as="h1">{title}</Heading>

      <Text style={textStyle}>Hi {firstName},</Text>

      {paragraphs.map((paragraph, i) => (
        <Text key={i} style={textStyle}>
          {/* Single newlines inside a paragraph stay as line breaks. */}
          {paragraph.split("\n").map((line, j, all) => (
            <React.Fragment key={j}>
              {line}
              {j < all.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </Text>
      ))}

      {ctaLabel && ctaUrl ? (
        <Section style={ctaStyle}>
          <BrandButton href={ctaUrl}>{ctaLabel}</BrandButton>
        </Section>
      ) : null}

      {/* Attribution only. The unsubscribe line is the layout's job now — this
          template rendering its own was the start of fifteen divergent copies,
          and it is the exact shape of the four phone formatters and the three
          "overdue" definitions this codebase has already had to collapse. */}
      {sentByAutomation ? (
        <>
          <Hr style={dividerStyle} />
          <Text style={metaStyle}>
            Sent automatically by &ldquo;{sentByAutomation}&rdquo;.
          </Text>
        </>
      ) : null}
    </EmailLayout>
  );
}

export default function NotificationPreview() {
  return (
    <NotificationEmail
      audience="customer"
      recipientName="Dana Rivera"
      businessName="Shihab Housing"
      businessPhone="(312) 555-0148"
      title="Your maintenance visit is tomorrow"
      body={
        "Just confirming we'll be at 1420 W 18th St tomorrow at 9:00 AM CDT.\n\n" +
        "Your technician is Marcus Webb. If you need to move it, use the link below."
      }
      ctaLabel="Reschedule"
      ctaUrl="https://example.com/book/shihab-housing"
      sentByAutomation="Job reminder"
      unsubscribeUrl="https://example.com/unsubscribe/abc"
    />
  );
}

export async function renderNotificationEmail(
  props: NotificationEmailProps,
): Promise<string> {
  return render(<NotificationEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "8px 0 24px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const metaStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 4px",
};
