import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { Heading } from "../components/heading.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface PaymentReceiptEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  invoiceNumber: string;
  paymentAmount: number;
  paymentDate: string;
  paymentMethod?: string | null;
  remainingBalance: number;
}

export function PaymentReceiptEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  invoiceNumber,
  paymentAmount,
  paymentDate,
  paymentMethod,
  remainingBalance,
}: PaymentReceiptEmailProps) {
  const firstName = customerName.split(" ")[0];
  const isPaidInFull = remainingBalance <= 0;

  return (
    <EmailLayout
      previewText={`Payment of $${paymentAmount.toFixed(2)} received for ${invoiceNumber}`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={paidBadgeWrapStyle}>
        <Text style={paidBadgeStyle}>
          &#10003; {isPaidInFull ? "PAID IN FULL" : "PAYMENT RECEIVED"}
        </Text>
      </Section>

      <Heading as="h1">Thank you, {firstName}!</Heading>

      <Text style={textStyle}>
        We&apos;ve received your payment
        {isPaidInFull
          ? `. Invoice ${invoiceNumber} is now paid in full.`
          : ` of $${paymentAmount.toFixed(2)} toward invoice ${invoiceNumber}.`}
      </Text>

      {/* Payment summary */}
      <Section style={receiptBoxStyle}>
        <Text style={receiptAmountStyle}>
          ${paymentAmount.toFixed(2)}
        </Text>
        <Text style={receiptLabelStyle}>Payment received</Text>
      </Section>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Invoice #" value={invoiceNumber} />
          <InfoRow label="Payment Date" value={paymentDate} />
          <InfoRow label="Amount Paid" value={`$${paymentAmount.toFixed(2)}`} />
          {paymentMethod && (
            <InfoRow label="Method" value={paymentMethod} />
          )}
          <InfoRow
            label="Remaining"
            value={
              isPaidInFull
                ? "$0.00 — Paid in full"
                : `$${remainingBalance.toFixed(2)}`
            }
          />
        </InfoRowGroup>
      </Section>

      <Hr style={dividerStyle} />

      <Text style={footerStyle}>
        {isPaidInFull
          ? `Thanks for your business! We appreciate you choosing ${businessName}.`
          : `A remaining balance of $${remainingBalance.toFixed(2)} is still due. Please let us know if you have any questions.`}
      </Text>
    </EmailLayout>
  );
}

export default function PaymentReceiptPreview() {
  return (
    <PaymentReceiptEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      invoiceNumber="INV-2026-0042"
      paymentAmount={1275.44}
      paymentDate="Apr 14, 2026"
      paymentMethod="Zelle"
      remainingBalance={0}
    />
  );
}

export async function renderPaymentReceiptEmail(
  props: PaymentReceiptEmailProps
): Promise<string> {
  return render(<PaymentReceiptEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 20px",
};

const paidBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const paidBadgeStyle: React.CSSProperties = {
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

const receiptBoxStyle: React.CSSProperties = {
  backgroundColor: "#ECFDF5",
  borderRadius: "8px",
  padding: "24px",
  margin: "0 0 20px",
  textAlign: "center" as const,
  border: "1px solid #6EE7B7",
};

const receiptAmountStyle: React.CSSProperties = {
  color: "#059669",
  fontSize: "32px",
  fontWeight: 700,
  margin: "0 0 4px",
  lineHeight: "1.2",
};

const receiptLabelStyle: React.CSSProperties = {
  color: "#6B7280",
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

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "20px 0",
};

const footerStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
  textAlign: "center" as const,
};
