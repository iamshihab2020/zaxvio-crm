import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
  Hr,
  Preview,
  Font,
} from "@react-email/components";
import * as React from "react";

// ── Brand tokens ──
const BRAND_ORANGE = "#E8652D";
const MIDNIGHT_NAVY = "#1A1F3C";
const SURFACE_GRAY = "#F5F5F5";
const MUTED_TEXT = "#6B7280";
const BORDER_LIGHT = "#E5E7EB";

const FONT_STACK =
  "'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface EmailLayoutProps {
  previewText: string;
  businessName: string;
  logoUrl?: string | null;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  /**
   * One-click unsubscribe, for **non-transactional** mail only.
   *
   * It lives on the shared layout rather than in each template because that is
   * the difference between "every marketing email has an unsubscribe link" and
   * "fourteen templates each remembered to add one". DF-NOT-01 is the record of
   * how that goes: fifteen templates, zero unsubscribe links.
   *
   * Omitted for transactional mail on purpose. An invoice is not something a
   * recipient can decline, and offering to unsubscribe from one invites them to
   * try and then be surprised when the next one arrives anyway.
   */
  unsubscribeUrl?: string | null;
  children: React.ReactNode;
}

export function EmailLayout({
  previewText,
  businessName,
  logoUrl,
  businessAddress,
  businessPhone,
  businessEmail,
  unsubscribeUrl,
  children,
}: EmailLayoutProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* ── Header ── */}
          <Section style={headerStyle}>
            {logoUrl ? (
              <Img
                src={logoUrl}
                alt={businessName}
                width={48}
                height={48}
                style={logoStyle}
              />
            ) : (
              <div style={logoPlaceholderStyle}>
                <Text style={logoLetterStyle}>
                  {businessName.charAt(0).toUpperCase()}
                </Text>
              </div>
            )}
            <Text style={businessNameStyle}>{businessName}</Text>
          </Section>

          {/* ── Orange accent bar ── */}
          <div style={accentBarStyle} />

          {/* ── Main content card ── */}
          <Section style={cardStyle}>{children}</Section>

          {/* ── Footer ── */}
          <Section style={footerStyle}>
            <Text style={footerBusinessStyle}>{businessName}</Text>
            {businessAddress && (
              <Text style={footerTextStyle}>{businessAddress}</Text>
            )}
            {(businessPhone || businessEmail) && (
              <Text style={footerTextStyle}>
                {[businessPhone, businessEmail].filter(Boolean).join(" · ")}
              </Text>
            )}
            <Hr style={footerDividerStyle} />
            {unsubscribeUrl && (
              <Text style={unsubscribeStyle}>
                {/* Deliberately says what stays, not just what stops. A reader
                    who thinks unsubscribing cancels their invoices will not
                    click, and a reader who thinks it did will be surprised. */}
                Don&rsquo;t want these emails?{" "}
                <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
                  Unsubscribe
                </Link>
                . You&rsquo;ll still get estimates, invoices and receipts.
              </Text>
            )}
            <Text style={poweredByStyle}>
              Powered by{" "}
              <Link href="https://zaxvio.com" style={zaxvioLinkStyle}>
                Zaxvio
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ── Styles ──

const bodyStyle: React.CSSProperties = {
  backgroundColor: SURFACE_GRAY,
  fontFamily: FONT_STACK,
  margin: 0,
  padding: 0,
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  padding: "40px 20px",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center" as const,
  paddingBottom: "24px",
};

const logoStyle: React.CSSProperties = {
  margin: "0 auto 12px",
  borderRadius: "8px",
};

const logoPlaceholderStyle: React.CSSProperties = {
  width: "48px",
  height: "48px",
  borderRadius: "8px",
  backgroundColor: BRAND_ORANGE,
  margin: "0 auto 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const logoLetterStyle: React.CSSProperties = {
  color: "#FFFFFF",
  fontSize: "22px",
  fontWeight: 700,
  lineHeight: "48px",
  textAlign: "center" as const,
  margin: 0,
  width: "48px",
};

const businessNameStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontSize: "18px",
  fontWeight: 700,
  margin: "0",
  letterSpacing: "-0.01em",
};

const accentBarStyle: React.CSSProperties = {
  height: "3px",
  backgroundColor: BRAND_ORANGE,
  borderRadius: "3px 3px 0 0",
  margin: "0",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  padding: "32px",
  borderRadius: "0 0 8px 8px",
  border: `1px solid ${BORDER_LIGHT}`,
  borderTop: "none",
};

const footerStyle: React.CSSProperties = {
  textAlign: "center" as const,
  padding: "24px 0 0",
};

const footerBusinessStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontSize: "13px",
  fontWeight: 600,
  margin: "0 0 4px",
};

const footerTextStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 2px",
};

const footerDividerStyle: React.CSSProperties = {
  borderColor: BORDER_LIGHT,
  margin: "16px 0",
};

const unsubscribeStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "11px",
  lineHeight: "1.6",
  margin: "0 0 8px",
};

const unsubscribeLinkStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  textDecoration: "underline",
};

const poweredByStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "11px",
  margin: "0",
};

const zaxvioLinkStyle: React.CSSProperties = {
  color: BRAND_ORANGE,
  textDecoration: "none",
  fontWeight: 600,
};
