import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { Heading } from "../components/heading.js";
import { BrandButton } from "../components/brand-button.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

/**
 * E-14: Booking cancelled (to customer).
 *
 * The customer received a confirmation when they booked and, until this
 * template existed, nothing at all when it was cancelled — only the team got a
 * notification. For a service business that is the single most important
 * message in the flow: someone is expecting a van to arrive.
 */
export interface BookingCancelledEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  serviceType: string;
  bookingDate: string;
  preferredTime?: string | null;
  /** Link back to the booking portal so they can pick a new slot. */
  rebookUrl?: string | null;
}

export function BookingCancelledEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  serviceType,
  bookingDate,
  preferredTime,
  rebookUrl,
}: BookingCancelledEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Your ${serviceType} appointment with ${businessName} on ${bookingDate} has been cancelled`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={badgeWrapStyle}>
        <Text style={badgeStyle}>CANCELLED</Text>
      </Section>

      <Heading as="h1">Your appointment has been cancelled</Heading>

      <Text style={textStyle}>
        Hi {firstName} — we&apos;re sorry, but the following appointment has been
        cancelled. You will not be charged, and no one will be arriving.
      </Text>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Service" value={serviceType} />
          <InfoRow label="Date" value={bookingDate} />
          {preferredTime && <InfoRow label="Time" value={preferredTime} />}
        </InfoRowGroup>
      </Section>

      {rebookUrl && (
        <>
          <Text style={textStyle}>
            Still need the work done? You can pick a new time here:
          </Text>
          <Section style={ctaStyle}>
            <BrandButton href={rebookUrl}>Book a new appointment</BrandButton>
          </Section>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={contactStyle}>
        {businessPhone
          ? `If this was a mistake, call us at ${businessPhone} and we'll get it back on the calendar.`
          : "If this was a mistake, reply to this email and we'll get it back on the calendar."}
      </Text>
    </EmailLayout>
  );
}

export default function BookingCancelledPreview() {
  return (
    <BookingCancelledEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      serviceType="AC Repair"
      bookingDate="Monday, April 14, 2026"
      preferredTime="09:00"
      rebookUrl="https://app.zaxvio.com/book/cool-breeze"
    />
  );
}

export async function renderBookingCancelledEmail(
  props: BookingCancelledEmailProps
): Promise<string> {
  return render(<BookingCancelledEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const badgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#FEF2F2",
  color: "#B91C1C",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #FCA5A5",
  margin: "0",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 20px",
  border: "1px solid #E5E7EB",
};

const ctaStyle: React.CSSProperties = {
  margin: "0 0 8px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const contactStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
};
