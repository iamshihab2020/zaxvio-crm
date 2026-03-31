import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { Heading } from "../components/heading.js";
import { DataTable, type LineItem } from "../components/data-table.js";
import { InfoRow, InfoRowGroup } from "../components/info-row.js";

export interface JobCompletionEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  jobTitle: string;
  serviceType: string;
  completedDate: string;
  lineItems: LineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string | null;
}

export function JobCompletionEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  jobTitle,
  serviceType,
  completedDate,
  lineItems,
  subtotal,
  taxAmount,
  total,
  notes,
}: JobCompletionEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`${jobTitle} is complete — here's your summary from ${businessName}`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Section style={completeBadgeWrapStyle}>
        <Text style={completeBadgeStyle}>&#10003; JOB COMPLETE</Text>
      </Section>

      <Heading as="h1">All done, {firstName}!</Heading>

      <Text style={textStyle}>
        Here&apos;s a summary of the work we completed:
      </Text>

      <Section style={detailsBoxStyle}>
        <InfoRowGroup>
          <InfoRow label="Job" value={jobTitle} />
          <InfoRow label="Service Type" value={serviceType} />
          <InfoRow label="Completed" value={completedDate} />
        </InfoRowGroup>
      </Section>

      {lineItems.length > 0 && (
        <>
          <Heading as="h2">Work Performed</Heading>
          <DataTable
            items={lineItems}
            subtotal={subtotal}
            taxAmount={taxAmount}
            total={total}
          />
        </>
      )}

      {notes && (
        <>
          <Heading as="h3">Technician Notes</Heading>
          <Text style={notesStyle}>{notes}</Text>
        </>
      )}

      <Hr style={dividerStyle} />

      <Text style={thankYouStyle}>
        Thank you for choosing <strong>{businessName}</strong>! An invoice will
        follow separately if one hasn&apos;t been sent already.
      </Text>
    </EmailLayout>
  );
}

export default function JobCompletionPreview() {
  return (
    <JobCompletionEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      jobTitle="AC Repair - Compressor Replacement"
      serviceType="AC Repair"
      completedDate="Apr 14, 2026"
      lineItems={[
        { description: "Compressor Unit (3-ton)", quantity: 1, unitPrice: 850, total: 850 },
        { description: "Refrigerant R-410A (2 lbs)", quantity: 2, unitPrice: 45, total: 90 },
        { description: "Labor - Installation", quantity: 3, unitPrice: 95, total: 285 },
      ]}
      subtotal={1225}
      taxAmount={100.44}
      total={1325.44}
      notes="Replaced faulty compressor. System tested and running at optimal efficiency. Recommend filter change in 30 days."
    />
  );
}

export async function renderJobCompletionEmail(
  props: JobCompletionEmailProps
): Promise<string> {
  return render(<JobCompletionEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const completeBadgeWrapStyle: React.CSSProperties = {
  margin: "0 0 12px",
};

const completeBadgeStyle: React.CSSProperties = {
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

const notesStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0 0 16px",
  backgroundColor: "#F9FAFB",
  padding: "12px 16px",
  borderRadius: "6px",
  borderLeft: "3px solid #E8652D",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "#E5E7EB",
  margin: "24px 0",
};

const thankYouStyle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: "14px",
  lineHeight: "1.6",
  margin: "0",
  textAlign: "center" as const,
};
