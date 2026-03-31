import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

export interface TrialExpiringEmailProps {
  ownerName: string;
  businessName: string;
  daysRemaining: number;
  upgradeUrl: string;
}

export function TrialExpiringEmail({
  ownerName,
  businessName,
  daysRemaining,
  upgradeUrl,
}: TrialExpiringEmailProps) {
  const firstName = ownerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Your Zaxvio trial expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`}
      businessName="Zaxvio"
    >
      <Heading as="h1">
        {daysRemaining <= 1
          ? `Last day of your trial, ${firstName}`
          : `${daysRemaining} days left on your trial`}
      </Heading>

      <Text style={textStyle}>
        Hey {firstName}, your free trial for <strong>{businessName}</strong> on
        Zaxvio is wrapping up. After your trial ends, you&apos;ll lose access to:
      </Text>

      <Section style={featureListStyle}>
        <Text style={featureItemStyle}>&#10003; Job scheduling & Kanban board</Text>
        <Text style={featureItemStyle}>&#10003; Professional invoicing & PDF generation</Text>
        <Text style={featureItemStyle}>&#10003; Customer booking portal</Text>
        <Text style={featureItemStyle}>&#10003; Quote builder & estimates</Text>
        <Text style={featureItemStyle}>&#10003; Service catalog & checklists</Text>
        <Text style={featureItemStyle}>&#10003; Equipment tracking</Text>
      </Section>

      <Section style={pricingBoxStyle}>
        <Text style={pricingLabelStyle}>Keep everything for</Text>
        <Text style={pricingValueStyle}>$49<span style={pricingPeriodStyle}>/month</span></Text>
        <Text style={pricingSubStyle}>Cancel anytime. No contracts.</Text>
      </Section>

      <Section style={ctaStyle}>
        <BrandButton href={upgradeUrl}>Upgrade Now</BrandButton>
      </Section>

      <Hr style={dividerStyle} />

      <Text style={footerStyle}>
        Your data is safe — even after the trial ends, nothing is deleted. You
        can upgrade anytime to pick up right where you left off.
      </Text>
    </EmailLayout>
  );
}

export default function TrialExpiringPreview() {
  return (
    <TrialExpiringEmail
      ownerName="Mike Rodriguez"
      businessName="Cool Breeze HVAC"
      daysRemaining={3}
      upgradeUrl="https://app.zaxvio.com/settings/billing"
    />
  );
}

export async function renderTrialExpiringEmail(
  props: TrialExpiringEmailProps
): Promise<string> {
  return render(<TrialExpiringEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const featureListStyle: React.CSSProperties = {
  margin: "0 0 24px",
  padding: "0 8px",
};

const featureItemStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.8",
  margin: "0",
};

const pricingBoxStyle: React.CSSProperties = {
  backgroundColor: "#1A1F3C",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const pricingLabelStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "13px",
  margin: "0 0 4px",
};

const pricingValueStyle: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: "36px",
  fontWeight: 700,
  margin: "0 0 4px",
  lineHeight: "1.2",
};

const pricingPeriodStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 400,
  color: "#9CA3AF",
};

const pricingSubStyle: React.CSSProperties = {
  color: "#D1D5DB",
  fontSize: "13px",
  margin: "0",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 24px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const footerStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
  textAlign: "center" as const,
};
