import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface ContractRenewalEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  contractName: string;
  endDate: string;
  daysUntilExpiry: number;
  annualPrice: number;
  visitsPerYear?: number | null;
}

export function ContractRenewalEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  contractName,
  endDate,
  daysUntilExpiry,
  annualPrice,
  visitsPerYear,
}: ContractRenewalEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Your ${contractName} maintenance contract expires in ${daysUntilExpiry} days`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={renewBadgeWrapStyle}>
        <Text style={renewBadgeStyle}>RENEWAL REMINDER</Text>
      </Section>

      <Heading as="h1">
        Your contract expires {daysUntilExpiry <= 7 ? "soon" : `in ${daysUntilExpiry} days`}
      </Heading>

      <Text style={textStyle}>
        Hey {firstName}, your <strong>{contractName}</strong> maintenance
        contract with <strong>{businessName}</strong> is coming up for renewal.
      </Text>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Contract" value={contractName} />
          <InfoRow label="Expires" value={endDate} />
          <InfoRow label="Annual Price" value={`$${annualPrice.toFixed(2)}`} />
          {visitsPerYear && (
            <InfoRow
              label="Includes"
              value={`${visitsPerYear} service visit${visitsPerYear > 1 ? "s" : ""} per year`}
            />
          )}
        </InfoRowGroup>
      </Section>

      <Section style={benefitsBoxStyle}>
        <Text style={benefitsTitleStyle}>Why renew?</Text>
        <Text style={benefitItemStyle}>
          &#8226; Priority scheduling for service calls
        </Text>
        <Text style={benefitItemStyle}>
          &#8226; Regular maintenance extends equipment life
        </Text>
        <Text style={benefitItemStyle}>
          &#8226; Catch small problems before they become expensive repairs
        </Text>
        <Text style={benefitItemStyle}>
          &#8226; Locked-in pricing — no surprises
        </Text>
      </Section>

      <Section style={ctaStyle}>
        {businessPhone ? (
          <Text style={ctaTextStyle}>
            Ready to renew? Call us at{" "}
            <strong>{businessPhone}</strong> and we&apos;ll get you set up.
          </Text>
        ) : (
          <Text style={ctaTextStyle}>
            Ready to renew? Reply to this email and we&apos;ll get you set up.
          </Text>
        )}
      </Section>

      <Hr style={dividerStyle} />

      <Text style={footerStyle}>
        If you&apos;d prefer not to renew, no worries — this is just a courtesy
        reminder. We&apos;re here if you change your mind.
      </Text>
    </EmailLayout>
  );
}

export default function ContractRenewalPreview() {
  return (
    <ContractRenewalEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      contractName="Annual AC Maintenance Plan"
      endDate="May 15, 2026"
      daysUntilExpiry={22}
      annualPrice={349}
      visitsPerYear={2}
    />
  );
}

export async function renderContractRenewalEmail(
  props: ContractRenewalEmailProps
): Promise<string> {
  return render(<ContractRenewalEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const renewBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const renewBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#FFFBEB",
  color: "#D97706",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #FDE68A",
  margin: "0",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 20px",
  border: "1px solid #E5E7EB",
};

const benefitsBoxStyle: React.CSSProperties = {
  backgroundColor: "#FFF7ED",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 24px",
  borderLeft: "3px solid #E8652D",
};

const benefitsTitleStyle: React.CSSProperties = {
  color: "#1A1F3C",
  fontSize: "14px",
  fontWeight: 600,
  margin: "0 0 8px",
};

const benefitItemStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "13px",
  lineHeight: "1.6",
  margin: "0 0 4px",
  paddingLeft: "4px",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "0 0 20px",
};

const ctaTextStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0",
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
};
