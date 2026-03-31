import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface BookingConfirmedEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  serviceType: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  address?: string | null;
}

export function BookingConfirmedEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  serviceType,
  scheduledDate,
  scheduledTime,
  address,
}: BookingConfirmedEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Your ${serviceType} appointment with ${businessName} is confirmed for ${scheduledDate}`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={confirmBadgeWrapStyle}>
        <Text style={confirmBadgeStyle}>&#10003; CONFIRMED</Text>
      </Section>

      <Heading as="h1">You&apos;re all set, {firstName}!</Heading>

      <Text style={textStyle}>
        Your appointment has been confirmed. Here are the details:
      </Text>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Service" value={serviceType} />
          <InfoRow label="Date" value={scheduledDate} />
          {scheduledTime && <InfoRow label="Time" value={scheduledTime} />}
          {address && <InfoRow label="Location" value={address} />}
        </InfoRowGroup>
      </Section>

      <Section style={whatToExpectStyle}>
        <Text style={whatToExpectTitleStyle}>What to expect:</Text>
        <Text style={whatToExpectItemStyle}>
          &#8226; Our technician will arrive at the scheduled time
        </Text>
        <Text style={whatToExpectItemStyle}>
          &#8226; Please ensure access to the HVAC system
        </Text>
        <Text style={whatToExpectItemStyle}>
          &#8226; We&apos;ll provide a full summary when the job is done
        </Text>
      </Section>

      <Hr style={dividerStyle} />

      <Text style={contactStyle}>
        Need to reschedule?{" "}
        {businessPhone
          ? `Call us at ${businessPhone}`
          : "Reply to this email"}{" "}
        and we&apos;ll get you sorted.
      </Text>
    </EmailLayout>
  );
}

export default function BookingConfirmedPreview() {
  return (
    <BookingConfirmedEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      serviceType="AC Repair"
      scheduledDate="Monday, April 14, 2026"
      scheduledTime="09:00"
      address="4521 Oak Valley Dr, Austin, TX 78745"
    />
  );
}

export async function renderBookingConfirmedEmail(
  props: BookingConfirmedEmailProps
): Promise<string> {
  return render(<BookingConfirmedEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const confirmBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const confirmBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#ECFDF5",
  color: "#059669",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #6EE7B7",
  margin: "0",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 20px",
  border: "1px solid #E5E7EB",
};

const whatToExpectStyle: React.CSSProperties = {
  margin: "0 0 20px",
};

const whatToExpectTitleStyle: React.CSSProperties = {
  color: "#1A1F3C",
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 8px",
};

const whatToExpectItemStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 4px",
  paddingLeft: "4px",
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
