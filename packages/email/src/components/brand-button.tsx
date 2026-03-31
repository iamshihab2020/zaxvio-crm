import { Link } from "@react-email/components";
import * as React from "react";

const BRAND_ORANGE = "#E8652D";
const BRAND_ORANGE_DARK = "#D15824";

export interface BrandButtonProps {
  href: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}

/**
 * Orange CTA button — email-client safe with inline styles.
 * Uses <a> tag with padding/background for broad compatibility.
 */
export function BrandButton({
  href,
  children,
  fullWidth = false,
}: BrandButtonProps) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      role="presentation"
      style={fullWidth ? { width: "100%" } : undefined}
    >
      <tbody>
        <tr>
          <td align="center" style={tdStyle}>
            <Link href={href} style={buttonStyle}>
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const tdStyle: React.CSSProperties = {
  borderRadius: "6px",
  backgroundColor: BRAND_ORANGE,
};

const buttonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: BRAND_ORANGE,
  color: "#FFFFFF",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  padding: "12px 32px",
  borderRadius: "6px",
  border: `2px solid ${BRAND_ORANGE_DARK}`,
  lineHeight: "1.3",
};
