import { render } from "@react-email/render";
import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface NewBookingNotificationEmailProps {
  ownerName: string;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  serviceType: string;
  bookingDate: string;
  preferredTime: string;
  address?: string | null;
  description?: string | null;
  dashboardUrl: string;
}

export function NewBookingNotificationEmail({
  ownerName,
  customerName,
  customerEmail,
  customerPhone,
  serviceType,
  bookingDate,
  preferredTime,
  address,
  description,
  dashboardUrl,
}: NewBookingNotificationEmailProps) {
  const firstName = ownerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`New booking: ${serviceType} on ${bookingDate} from ${customerName}`}
      businessName="Zaxvio"
    >
      <Section style={alertBadgeWrapStyle}>
        <Text style={alertBadgeStyle}>NEW BOOKING</Text>
      </Section>

      <Heading as="h1">Hey {firstName}, you&apos;ve got a new one!</Heading>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Customer" value={customerName} />
          {customerPhone && <InfoRow label="Phone" value={customerPhone} />}
          {customerEmail && <InfoRow label="Email" value={customerEmail} />}
          <InfoRow label="Service" value={serviceType} />
          <InfoRow label="Date" value={bookingDate} />
          <InfoRow label="Time" value={preferredTime} />
          {address && <InfoRow label="Address" value={address} />}
        </InfoRowGroup>
      </Section>

      {description && (
        <>
          <Text style={notesLabel}>Customer notes:</Text>
          <Text style={notesStyle}>{description}</Text>
        </>
      )}

      <Section style={ctaStyle}>
        <BrandButton href={dashboardUrl}>Review in Dashboard</BrandButton>
      </Section>
    </EmailLayout>
  );
}

export default function NewBookingNotificationPreview() {
  return (
    <NewBookingNotificationEmail
      ownerName="Mike Rodriguez"
      customerName="Sarah Johnson"
      customerEmail="sarah@example.com"
      customerPhone="(512) 555-0123"
      serviceType="AC Repair"
      bookingDate="Monday, April 14, 2026"
      preferredTime="09:00"
      address="4521 Oak Valley Dr, Austin, TX 78745"
      description="Unit is making a loud buzzing noise when running"
      dashboardUrl="https://app.zaxvio.com/bookings"
    />
  );
}

export async function renderNewBookingNotificationEmail(
  props: NewBookingNotificationEmailProps
): Promise<string> {
  return render(<NewBookingNotificationEmail {...props} />);
}

const alertBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const alertBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#FFF7ED",
  color: "#E8652D",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #FDBA74",
  margin: "0",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 20px",
  border: "1px solid #E5E7EB",
};

const notesLabel: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 4px",
};

const notesStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 16px",
  fontStyle: "italic",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0 0",
};
