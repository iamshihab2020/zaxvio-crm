import { render } from "@react-email/render";
import { Text, Section, Hr, Link } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

export interface WelcomePaidEmailProps {
  ownerName: string;
  businessName: string;
  planName?: string;
  affiliateReferralUrl?: string | null;
  dashboardUrl: string;
}

export function WelcomePaidEmail({
  ownerName,
  businessName,
  planName = "Pro",
  affiliateReferralUrl,
  dashboardUrl,
}: WelcomePaidEmailProps) {
  const firstName = ownerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Welcome to Zaxvio ${planName} — you're all set, ${firstName}!`}
      businessName="Zaxvio"
    >
      <Heading as="h1">Welcome to Zaxvio {planName}!</Heading>

      <Text style={textStyle}>
        Hey {firstName}, thanks for subscribing! <strong>{businessName}</strong>{" "}
        is now running on the {planName} plan with full access to every feature.
      </Text>

      <Section style={tipsBoxStyle}>
        <Text style={tipsTitleStyle}>Quick tips to get more value:</Text>
        <Text style={tipItemStyle}>
          &#9889; <strong>Set up your booking page</strong> — let customers
          self-schedule instead of calling
        </Text>
        <Text style={tipItemStyle}>
          &#9889; <strong>Create checklist templates</strong> — auto-generate
          line items from completed work
        </Text>
        <Text style={tipItemStyle}>
          &#9889; <strong>Add your Google Review URL</strong> — we&apos;ll
          auto-request reviews after every paid invoice
        </Text>
      </Section>

      <Section style={ctaStyle}>
        <BrandButton href={dashboardUrl}>Go to Dashboard</BrandButton>
      </Section>

      {/* Affiliate section */}
      {affiliateReferralUrl && (
        <>
          <Hr style={dividerStyle} />

          <Section style={affiliateBoxStyle}>
            <Heading as="h2" style={{ textAlign: "center" }}>
              Earn by sharing Zaxvio
            </Heading>
            <Text style={affiliateTextStyle}>
              Know other HVAC contractors who could use this? Share your
              referral link and earn a commission for every contractor who signs
              up through you.
            </Text>
            <Section style={referralLinkBoxStyle}>
              <Text style={referralLinkStyle}>{affiliateReferralUrl}</Text>
            </Section>
            <Text style={affiliateSubStyle}>
              <Link href={affiliateReferralUrl} style={affiliateLinkStyle}>
                Copy your referral link
              </Link>{" "}
              and share it with your network.
            </Text>
          </Section>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={signoffStyle}>
        Questions? Just reply to this email — a real human will get back to you.
      </Text>
    </EmailLayout>
  );
}

export default function WelcomePaidPreview() {
  return (
    <WelcomePaidEmail
      ownerName="Mike Rodriguez"
      businessName="Cool Breeze HVAC"
      planName="Pro"
      affiliateReferralUrl="https://zaxvio.com/ref/coolbreeze123"
      dashboardUrl="https://app.zaxvio.com/dashboard"
    />
  );
}

export async function renderWelcomePaidEmail(
  props: WelcomePaidEmailProps
): Promise<string> {
  return render(<WelcomePaidEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const tipsBoxStyle: React.CSSProperties = {
  backgroundColor: "#FFF7ED",
  borderRadius: "6px",
  padding: "20px 24px",
  margin: "0 0 24px",
  borderLeft: "3px solid #E8652D",
};

const tipsTitleStyle: React.CSSProperties = {
  color: "#1A1F3C",
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 12px",
};

const tipItemStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 8px",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "24px 0",
};

const affiliateBoxStyle: React.CSSProperties = {
  textAlign: "center" as const,
};

const affiliateTextStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const referralLinkBoxStyle: React.CSSProperties = {
  backgroundColor: "#F3F4F6",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 12px",
  border: "1px dashed #D1D5DB",
};

const referralLinkStyle: React.CSSProperties = {
  color: "#E8652D",
  fontSize: "14px",
  fontWeight: 600,
  wordBreak: "break-all",
  margin: "0",
};

const affiliateSubStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  margin: "0",
};

const affiliateLinkStyle: React.CSSProperties = {
  color: "#E8652D",
  textDecoration: "underline",
};

const signoffStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  margin: "0",
  textAlign: "center" as const,
};
