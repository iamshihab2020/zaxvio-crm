import { Heading as EmailHeading } from "@react-email/components";
import * as React from "react";

const MIDNIGHT_NAVY = "#1A1F3C";

type HeadingLevel = "h1" | "h2" | "h3";

export interface HeadingProps {
  as?: HeadingLevel;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const sizeMap: Record<HeadingLevel, React.CSSProperties> = {
  h1: { fontSize: "24px", margin: "0 0 16px" },
  h2: { fontSize: "18px", margin: "0 0 12px" },
  h3: { fontSize: "15px", margin: "0 0 8px" },
};

export function Heading({ as = "h2", children, style }: HeadingProps) {
  return (
    <EmailHeading
      as={as}
      style={{ ...baseStyle, ...sizeMap[as], ...style }}
    >
      {children}
    </EmailHeading>
  );
}

const baseStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontWeight: 700,
  lineHeight: "1.3",
  letterSpacing: "-0.01em",
};
