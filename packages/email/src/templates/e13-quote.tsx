import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";
import { DataTable, type LineItem } from "../components/data-table.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface QuoteEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  quoteNumber: string;
  issuedDate: string;
  expiryDate: string;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  notes?: string | null;
  viewQuoteUrl?: string | null;
}

export function QuoteEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  quoteNumber,
  issuedDate,
  expiryDate,
  lineItems,
  subtotal,
  taxAmount,
  discountAmount,
  totalAmount,
  notes,
  viewQuoteUrl,
}: QuoteEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Estimate ${quoteNumber} from ${businessName} — $${totalAmount.toFixed(2)}`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={estimateBadgeWrapStyle}>
        <Text style={estimateBadgeStyle}>ESTIMATE</Text>
      </Section>

      <Heading as="h1">Estimate {quoteNumber}</Heading>

      <Text style={textStyle}>
        Hey {firstName}, here&apos;s the estimate you requested from{" "}
        <strong>{businessName}</strong>.
      </Text>

      {/* Total callout */}
      <Section style={totalBoxStyle}>
        <Text style={totalLabelStyle}>Estimated Total</Text>
        <Text style={totalValueStyle}>${totalAmount.toFixed(2)}</Text>
        <Text style={validUntilStyle}>Valid until {expiryDate}</Text>
      </Section>

      {/* Quote details */}
      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Estimate #" value={quoteNumber} />
          <InfoRow label="Issued" value={issuedDate} />
          <InfoRow label="Valid Until" value={expiryDate} />
        </InfoRowGroup>
      </Section>

      {/* Line items */}
      {lineItems.length > 0 && (
        <DataTable
          items={lineItems}
          subtotal={subtotal}
          taxAmount={taxAmount}
          discountAmount={discountAmount}
          total={totalAmount}
        />
      )}

      {notes && (
        <>
          <Heading as="h3">Notes</Heading>
          <Text style={notesStyle}>{notes}</Text>
        </>
      )}

      {viewQuoteUrl && (
        <Section style={ctaStyle}>
          <BrandButton href={viewQuoteUrl}>View Estimate</BrandButton>
        </Section>
      )}

      <Hr style={dividerStyle} />

      <Text style={footerNoteStyle}>
        A PDF copy of this estimate is attached. Ready to proceed? Just reply to
        this email or{" "}
        {businessPhone
          ? `call us at ${businessPhone}`
          : "get in touch"}{" "}
        and we&apos;ll get you scheduled.
      </Text>
    </EmailLayout>
  );
}

export default function QuoteEmailPreview() {
  return (
    <QuoteEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      businessAddress="1200 Industrial Blvd, Austin, TX 78701"
      quoteNumber="QT-2026-0015"
      issuedDate="Apr 10, 2026"
      expiryDate="May 10, 2026"
      lineItems={[
        { description: "Carrier 24ACC636 - 3 Ton AC Unit", quantity: 1, unitPrice: 2850, total: 2850 },
        { description: "Installation Labor", quantity: 8, unitPrice: 95, total: 760 },
        { description: "Ductwork Modification", quantity: 1, unitPrice: 450, total: 450 },
      ]}
      subtotal={4060}
      taxAmount={333.32}
      totalAmount={4393.32}
      notes="Price includes full unit removal, new installation, and 1-year labor warranty."
    />
  );
}

export async function renderQuoteEmail(
  props: QuoteEmailProps
): Promise<string> {
  return render(<QuoteEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const estimateBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const estimateBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#EFF6FF",
  color: "#2563EB",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #93C5FD",
  margin: "0",
};

const totalBoxStyle: React.CSSProperties = {
  backgroundColor: "#1A1F3C",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const totalLabelStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0 0 4px",
};

const totalValueStyle: React.CSSProperties = {
  color: "#E8652D",
  fontSize: "32px",
  fontWeight: 700,
  margin: "0 0 4px",
  lineHeight: "1.2",
};

const validUntilStyle: React.CSSProperties = {
  color: "#D1D5DB",
  fontSize: "13px",
  margin: "0",
};

const detailsBoxStyle: React.CSSProperties = {
  backgroundColor: "#F9FAFB",
  borderRadius: "6px",
  padding: "16px 20px",
  margin: "0 0 8px",
  border: "1px solid #E5E7EB",
};

const notesStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px",
  whiteSpace: "pre-wrap",
};

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const footerNoteStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
};
