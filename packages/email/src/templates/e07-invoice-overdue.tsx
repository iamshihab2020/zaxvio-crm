import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface InvoiceOverdueEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  invoiceNumber: string;
  dueDate: string;
  daysOverdue: number;
  balanceDue: number;
  paymentInstructions?: string | null;
  viewInvoiceUrl?: string | null;
}

export function InvoiceOverdueEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  invoiceNumber,
  dueDate,
  daysOverdue,
  balanceDue,
  paymentInstructions,
  viewInvoiceUrl,
}: InvoiceOverdueEmailProps) {
  const firstName = customerName.split(" ")[0];

  // Escalating tone based on days overdue
  const isGentle = daysOverdue <= 7;
  const isFirm = daysOverdue > 7 && daysOverdue <= 21;
  // isUrgent = daysOverdue > 21

  const greeting = isGentle
    ? `Hey ${firstName}, just a friendly reminder`
    : isFirm
      ? `Hi ${firstName}, this is a follow-up`
      : `Hi ${firstName}, this requires your attention`;

  const message = isGentle
    ? `that invoice ${invoiceNumber} was due on ${dueDate}. We know things get busy — just wanted to make sure this doesn't slip through the cracks.`
    : isFirm
      ? `regarding invoice ${invoiceNumber} which is now ${daysOverdue} days past due. We'd appreciate your prompt attention to this.`
      : `— invoice ${invoiceNumber} is now ${daysOverdue} days overdue. Please arrange payment at your earliest convenience to avoid any service interruptions.`;

  return (
    <EmailLayout
      previewText={`Payment reminder: Invoice ${invoiceNumber} is ${daysOverdue} days overdue`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={overdueBadgeWrapStyle}>
        <Text style={overdueBadgeStyle}>PAYMENT REMINDER</Text>
      </Section>

      <Heading as="h1">Invoice {invoiceNumber}</Heading>

      <Text style={textStyle}>
        {greeting} {message}
      </Text>

      {/* Amount due callout */}
      <Section style={amountBoxStyle}>
        <table cellPadding={0} cellSpacing={0} border={0} role="presentation" style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td style={amountLeftStyle}>
                <Text style={amountLabelStyle}>Amount Due</Text>
                <Text style={amountValueStyle}>${balanceDue.toFixed(2)}</Text>
              </td>
              <td style={amountRightStyle}>
                <Text style={amountLabelStyle}>Days Overdue</Text>
                <Text style={daysValueStyle}>{daysOverdue}</Text>
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Invoice #" value={invoiceNumber} />
          <InfoRow label="Original Due" value={dueDate} />
          <InfoRow label="Status" value={`${daysOverdue} days overdue`} />
        </InfoRowGroup>
      </Section>

      {viewInvoiceUrl && (
        <Section style={ctaStyle}>
          <BrandButton href={viewInvoiceUrl}>View & Pay Invoice</BrandButton>
        </Section>
      )}

      {paymentInstructions && (
        <>
          <Hr style={dividerStyle} />
          <Heading as="h3">Payment Instructions</Heading>
          <Text style={paymentStyle}>{paymentInstructions}</Text>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={footerNoteStyle}>
        Already paid? No worries — please disregard this reminder. If you have
        any questions,{" "}
        {businessPhone
          ? `call us at ${businessPhone}`
          : "reply to this email"}
        .
      </Text>
    </EmailLayout>
  );
}

export default function InvoiceOverduePreview() {
  return (
    <InvoiceOverdueEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      invoiceNumber="INV-2026-0042"
      dueDate="Mar 24, 2026"
      daysOverdue={14}
      balanceDue={1275.44}
      paymentInstructions="Zelle: payments@coolbreezehvac.com"
    />
  );
}

export async function renderInvoiceOverdueEmail(
  props: InvoiceOverdueEmailProps
): Promise<string> {
  return render(<InvoiceOverdueEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const overdueBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const overdueBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#FEF2F2",
  color: "#DC2626",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  padding: "4px 10px",
  borderRadius: "4px",
  border: "1px solid #FECACA",
  margin: "0",
};

const amountBoxStyle: React.CSSProperties = {
  backgroundColor: "#FEF2F2",
  borderRadius: "8px",
  padding: "20px",
  margin: "0 0 20px",
  border: "1px solid #FECACA",
};

const amountLeftStyle: React.CSSProperties = {
  verticalAlign: "top",
  width: "50%",
};

const amountRightStyle: React.CSSProperties = {
  verticalAlign: "top",
  width: "50%",
  textAlign: "right" as const,
};

const amountLabelStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  margin: "0 0 4px",
};

const amountValueStyle: React.CSSProperties = {
  color: "#DC2626",
  fontSize: "28px",
  fontWeight: 700,
  margin: "0",
  lineHeight: "1.2",
};

const daysValueStyle: React.CSSProperties = {
  color: "#DC2626",
  fontSize: "28px",
  fontWeight: 700,
  margin: "0",
  lineHeight: "1.2",
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

const paymentStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
  whiteSpace: "pre-wrap",
};

const footerNoteStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: "0",
};
