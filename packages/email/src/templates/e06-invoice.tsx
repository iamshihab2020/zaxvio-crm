import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";
import { DataTable, type LineItem } from "../components/data-table.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface InvoiceEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  invoiceNumber: string;
  issuedDate: string;
  dueDate: string;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount?: number;
  totalAmount: number;
  balanceDue: number;
  paymentInstructions?: string | null;
  viewInvoiceUrl?: string | null;
  termsConditions?: string | null;
  footerMessage?: string | null;
  licenseNumber?: string | null;
}

export function InvoiceEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  invoiceNumber,
  issuedDate,
  dueDate,
  lineItems,
  subtotal,
  taxAmount,
  discountAmount,
  totalAmount,
  balanceDue,
  paymentInstructions,
  viewInvoiceUrl,
  termsConditions,
  footerMessage,
  licenseNumber,
}: InvoiceEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`Invoice ${invoiceNumber} — $${balanceDue.toFixed(2)} due by ${dueDate}`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Heading as="h1">Invoice {invoiceNumber}</Heading>

      <Text style={textStyle}>
        Hey {firstName}, here&apos;s your invoice from{" "}
        <strong>{businessName}</strong>.
      </Text>

      {/* Amount due callout */}
      <Section style={amountDueBoxStyle}>
        <Text style={amountDueLabelStyle}>Balance Due</Text>
        <Text style={amountDueValueStyle}>${balanceDue.toFixed(2)}</Text>
        <Text style={amountDueDateStyle}>Due by {dueDate}</Text>
      </Section>

      {/* Invoice details */}
      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Invoice #" value={invoiceNumber} />
          <InfoRow label="Issued" value={issuedDate} />
          <InfoRow label="Due Date" value={dueDate} />
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

      {viewInvoiceUrl && (
        <Section style={ctaStyle}>
          <BrandButton href={viewInvoiceUrl}>View Invoice</BrandButton>
        </Section>
      )}

      {paymentInstructions && (
        <>
          <Hr style={dividerStyle} />
          <Heading as="h3">Payment Instructions</Heading>
          <Text style={paymentInstructionsStyle}>{paymentInstructions}</Text>
        </>
      )}

      {termsConditions && (
        <>
          <Hr style={dividerStyle} />
          <Heading as="h3">Terms & Conditions</Heading>
          <Text style={paymentInstructionsStyle}>{termsConditions}</Text>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={footerNoteStyle}>
        {footerMessage ?? "Thank you for your business!"}
      </Text>
      {licenseNumber && (
        <Text style={footerNoteStyle}>License: {licenseNumber}</Text>
      )}
      <Text style={footerNoteStyle}>
        A PDF copy of this invoice is attached. If you have any questions,{" "}
        {businessPhone
          ? `call us at ${businessPhone}`
          : "reply to this email"}
        .
      </Text>
    </EmailLayout>
  );
}

export default function InvoiceEmailPreview() {
  return (
    <InvoiceEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      businessAddress="1200 Industrial Blvd, Austin, TX 78701"
      invoiceNumber="INV-2026-0042"
      issuedDate="Apr 10, 2026"
      dueDate="Apr 24, 2026"
      lineItems={[
        { description: "Compressor Unit (3-ton)", quantity: 1, unitPrice: 850, total: 850 },
        { description: "Refrigerant R-410A", quantity: 2, unitPrice: 45, total: 90 },
        { description: "Labor - Installation", quantity: 3, unitPrice: 95, total: 285 },
      ]}
      subtotal={1225}
      taxAmount={100.44}
      discountAmount={50}
      totalAmount={1275.44}
      balanceDue={1275.44}
      paymentInstructions="Zelle: payments@coolbreezehvac.com\nCheck payable to: Cool Breeze HVAC LLC"
    />
  );
}

export async function renderInvoiceEmail(
  props: InvoiceEmailProps
): Promise<string> {
  return render(<InvoiceEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const amountDueBoxStyle: React.CSSProperties = {
  backgroundColor: "#1A1F3C",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 24px",
  textAlign: "center" as const,
};

const amountDueLabelStyle: React.CSSProperties = {
  color: "#9CA3AF",
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  margin: "0 0 4px",
};

const amountDueValueStyle: React.CSSProperties = {
  color: "#E8652D",
  fontSize: "32px",
  fontWeight: 700,
  margin: "0 0 4px",
  lineHeight: "1.2",
};

const amountDueDateStyle: React.CSSProperties = {
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

const ctaStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const paymentInstructionsStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 8px",
  whiteSpace: "pre-wrap",
};

const footerNoteStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
};
