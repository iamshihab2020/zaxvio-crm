import { render } from "@react-email/render";
import { Text, Section, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/email-layout.js";
import { BrandButton } from "../components/brand-button.js";
import { Heading } from "../components/heading.js";

export interface ReviewRequestEmailProps {
  customerName: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessPhone?: string | null;
  businessAddress?: string | null;
  googleReviewUrl: string;
  serviceType?: string | null;
  jobTitle?: string | null;
}

export function ReviewRequestEmail({
  customerName,
  businessName,
  businessLogoUrl,
  businessPhone,
  businessAddress,
  googleReviewUrl,
  serviceType,
  jobTitle,
}: ReviewRequestEmailProps) {
  const firstName = customerName.split(" ")[0];

  return (
    <EmailLayout
      previewText={`How was your experience with ${businessName}?`}
      businessName={businessName}
      logoUrl={businessLogoUrl}
      businessPhone={businessPhone}
      businessAddress={businessAddress}
    >
      <Heading as="h1">How did we do, {firstName}?</Heading>

      <Text style={textStyle}>
        Thanks for choosing <strong>{businessName}</strong>
        {jobTitle ? ` for your ${jobTitle.toLowerCase()}` : ""}
        {serviceType && !jobTitle ? ` for your ${serviceType.toLowerCase()} service` : ""}.
        We hope everything went smoothly!
      </Text>

      <Text style={textStyle}>
        If you had a great experience, we&apos;d really appreciate a quick Google
        review. It takes less than a minute and helps other homeowners find
        reliable HVAC service.
      </Text>

      {/* Star rating visual */}
      <Section style={starsBoxStyle}>
        <Text style={starsStyle}>&#9733; &#9733; &#9733; &#9733; &#9733;</Text>
        <Text style={starsSubStyle}>Your feedback means a lot to us</Text>
      </Section>

      <Section style={ctaStyle}>
        <BrandButton href={googleReviewUrl}>Leave a Review</BrandButton>
      </Section>

      <Hr style={dividerStyle} />

      <Text style={footerStyle}>
        Had an issue? Reply to this email and let us know — we&apos;d rather hear
        from you directly so we can make it right.
      </Text>
    </EmailLayout>
  );
}

export default function ReviewRequestPreview() {
  return (
    <ReviewRequestEmail
      customerName="Sarah Johnson"
      businessName="Cool Breeze HVAC"
      businessPhone="(512) 555-0199"
      googleReviewUrl="https://g.page/r/coolbreezehvac/review"
      serviceType="AC Repair"
      jobTitle="Compressor Replacement"
    />
  );
}

export async function renderReviewRequestEmail(
  props: ReviewRequestEmailProps
): Promise<string> {
  return render(<ReviewRequestEmail {...props} />);
}

const textStyle: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const starsBoxStyle: React.CSSProperties = {
  textAlign: "center" as const,
  margin: "24px 0",
  padding: "20px",
  backgroundColor: "#FFFBEB",
  borderRadius: "8px",
  border: "1px solid #FDE68A",
};

const starsStyle: React.CSSProperties = {
  color: "#F59E0B",
  fontSize: "32px",
  letterSpacing: "4px",
  margin: "0 0 4px",
};

const starsSubStyle: React.CSSProperties = {
  color: "#6B7280",
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
};
