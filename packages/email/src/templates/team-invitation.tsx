import { render } from "@react-email/render";
import { Text, Section } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

export interface TeamInvitationEmailProps {
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}

export function TeamInvitationEmail({
  inviterName,
  organizationName,
  role,
  inviteUrl,
}: TeamInvitationEmailProps) {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <EmailLayout
      previewText={`${inviterName} invited you to join ${organizationName}`}
      businessName={organizationName}
    >
      <Heading as="h1">You&apos;re invited!</Heading>

      <Text style={textStyle}>
        <strong>{inviterName}</strong> has invited you to join{" "}
        <strong>{organizationName}</strong> as a <strong>{roleLabel}</strong>.
      </Text>

      <Section style={ctaStyle}>
        <BrandButton href={inviteUrl}>Accept Invitation</BrandButton>
      </Section>

      <Text style={mutedStyle}>
        This invitation expires in 7 days. If you didn&apos;t expect this email,
        you can safely ignore it.
      </Text>
    </EmailLayout>
  );
}

export default function TeamInvitationPreview() {
  return (
    <TeamInvitationEmail
      inviterName="Mike Rodriguez"
      organizationName="Cool Breeze HVAC"
      role="member"
      inviteUrl="https://app.zaxvio.com/invite/abc123"
    />
  );
}

export async function renderTeamInvitationEmail(
  props: TeamInvitationEmailProps
): Promise<string> {
  return render(<TeamInvitationEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 24px",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const mutedStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "13px",
  margin: "24px 0 0",
};
