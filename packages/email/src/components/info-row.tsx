import * as React from "react";

const MIDNIGHT_NAVY = "#1A1F3C";
const MUTED_TEXT = "#6B7280";

export interface InfoRowProps {
  label: string;
  value: string;
}

/**
 * Two-column label:value metadata row for displaying invoice numbers,
 * dates, customer info, etc.
 */
export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      role="presentation"
      style={tableStyle}
    >
      <tbody>
        <tr>
          <td style={labelStyle}>{label}</td>
          <td style={valueStyle}>{value}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * Group of info rows with consistent spacing.
 */
export function InfoRowGroup({ children }: { children: React.ReactNode }) {
  return (
    <div style={groupStyle}>
      {children}
    </div>
  );
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const labelStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "13px",
  fontWeight: 500,
  padding: "5px 0",
  width: "140px",
  verticalAlign: "top",
};

const valueStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontSize: "13px",
  fontWeight: 600,
  padding: "5px 0",
  verticalAlign: "top",
};

const groupStyle: React.CSSProperties = {
  margin: "16px 0",
};
