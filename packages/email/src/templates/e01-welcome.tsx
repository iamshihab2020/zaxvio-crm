import { render } from "@react-email/render";
import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

export interface WelcomeEmailProps {
  ownerName: string;
  businessName: string;
  loginUrl: string;
  trialEndsAt?: string;
}

export function WelcomeEmail({
  ownerName,
  businessName,
  loginUrl,
  trialEndsAt,
}: WelcomeEmailProps) {
  const firstName = ownerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Welcome to Zaxvio — let's get ${businessName} set up`}
      businessName="Zaxvio"
    >
      <Heading as="h1">Welcome aboard, {firstName}!</Heading>

      <Text style={textStyle}>
        Your account for <strong>{businessName}</strong> is ready to go.
        Here&apos;s how to hit the ground running:
      </Text>

      <Section style={checklistStyle}>
        <Text style={checkItemStyle}>
          <span style={checkIconStyle}>1</span> Add your services to the{" "}
          <strong>Service Catalog</strong>
        </Text>
        <Text style={checkItemStyle}>
          <span style={checkIconStyle}>2</span> Set up your{" "}
          <strong>Booking Page</strong> for customer self-scheduling
        </Text>
        <Text style={checkItemStyle}>
          <span style={checkIconStyle}>3</span> Create your first{" "}
          <strong>Job</strong> and track it on the Kanban board
        </Text>
        <Text style={checkItemStyle}>
          <span style={checkIconStyle}>4</span> Invite your{" "}
          <strong>Team Members</strong> if you have any
        </Text>
      </Section>

      <Section style={ctaStyle}>
        <BrandButton href={loginUrl}>Go to Dashboard</BrandButton>
      </Section>

      {trialEndsAt && (
        <Text style={trialStyle}>
          Your free trial runs until <strong>{trialEndsAt}</strong>. No credit
          card required during the trial.
        </Text>
      )}

      <Text style={signoffStyle}>
        Questions? Just reply to this email — we read every one.
      </Text>
    </EmailLayout>
  );
}

export default function WelcomeEmailPreview() {
  return (
    <WelcomeEmail
      ownerName="Mike Rodriguez"
      businessName="Cool Breeze HVAC"
      loginUrl="https://app.zaxvio.com/dashboard"
      trialEndsAt="April 30, 2026"
    />
  );
}

export async function renderWelcomeEmail(
  props: WelcomeEmailProps
): Promise<string> {
  return render(<WelcomeEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const checklistStyle: React.CSSProperties = {
  backgroundColor: "#FFF7ED",
  borderRadius: "6px",
  padding: "20px 24px",
  margin: "0 0 24px",
  borderLeft: "3px solid #E8652D",
};

const checkItemStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 10px",
};

const checkIconStyle: React.CSSProperties = {
  display: "inline-block",
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  backgroundColor: "#E8652D",
  color: "#FFFFFF",
  fontSize: "12px",
  fontWeight: 700,
  textAlign: "center" as const,
  lineHeight: "22px",
  marginRight: "10px",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const trialStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "16px 0 0",
  textAlign: "center" as const,
};

const signoffStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  margin: "20px 0 0",
};
