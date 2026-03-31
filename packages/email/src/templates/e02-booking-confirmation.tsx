import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface BookingConfirmationEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  serviceType: string;
  bookingDate: string;
  preferredTime: string;
  address?: string | null;
  notes?: string | null;
}

export function BookingConfirmationEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  serviceType,
  bookingDate,
  preferredTime,
  address,
  notes,
}: BookingConfirmationEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Your ${serviceType} booking with ${businessName} is confirmed`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Heading as="h1">Booking Received!</Heading>

      <Text style={textStyle}>
        Hey {firstName}, we&apos;ve received your booking request. Here are the
        details:
      </Text>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Service" value={serviceType} />
          <InfoRow label="Date" value={bookingDate} />
          <InfoRow label="Time" value={preferredTime} />
          {address && <InfoRow label="Location" value={address} />}
        </InfoRowGroup>
      </Section>

      {notes && (
        <>
          <Text style={notesLabelStyle}>Your notes:</Text>
          <Text style={notesStyle}>{notes}</Text>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={textStyle}>
        We&apos;ll confirm your appointment shortly. If you need to make any
        changes, give us a call{businessPhone ? ` at ${businessPhone}` : ""}.
      </Text>

      <Text style={signoffStyle}>
        Looking forward to helping you out!
        <br />— The {businessName} team
      </Text>
    </EmailLayout>
  );
}

export default function BookingConfirmationPreview() {
  return (
    <BookingConfirmationEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      serviceType="AC Repair"
      bookingDate="Monday, April 14, 2026"
      preferredTime="09:00"
      address="4521 Oak Valley Dr, Austin, TX 78745"
      notes="Unit is making a loud buzzing noise when running"
    />
  );
}

export async function renderBookingConfirmationEmail(
  props: BookingConfirmationEmailProps
): Promise<string> {
  return render(<BookingConfirmationEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 20px",
  border: "1px solid #E5E7EB",
};

const notesLabelStyle: React.CSSProperties = {
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

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const signoffStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
};
