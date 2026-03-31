import { Text } from "@react-email/components";
import * as React from "react";

const MIDNIGHT_NAVY = "#1A1F3C";
const BRAND_ORANGE = "#E8652D";
const MUTED_TEXT = "#6B7280";
const BORDER_LIGHT = "#E5E7EB";
const ROW_ALT = "#FAFAFA";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DataTableProps {
  items: LineItem[];
  subtotal: number;
  taxAmount?: number;
  discountAmount?: number;
  total: number;
  currencySymbol?: string;
}

function formatMoney(amount: number, symbol: string) {
  return `${symbol}${amount.toFixed(2)}`;
}

export function DataTable({
  items,
  subtotal,
  taxAmount,
  discountAmount,
  total,
  currencySymbol = "$",
}: DataTableProps) {
  return (
    <table
      cellPadding={0}
      cellSpacing={0}
      border={0}
      role="presentation"
      style={tableStyle}
    >
      {/* Header */}
      <thead>
        <tr>
          <th style={thStyle}>Description</th>
          <th style={{ ...thStyle, textAlign: "center", width: "50px" }}>
            Qty
          </th>
          <th style={{ ...thStyle, textAlign: "right", width: "90px" }}>
            Price
          </th>
          <th style={{ ...thStyle, textAlign: "right", width: "90px" }}>
            Total
          </th>
        </tr>
      </thead>

      {/* Line items */}
      <tbody>
        {items.map((item, i) => (
          <tr key={i} style={i % 2 === 1 ? { backgroundColor: ROW_ALT } : undefined}>
            <td style={tdStyle}>{item.description}</td>
            <td style={{ ...tdStyle, textAlign: "center" }}>{item.quantity}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              {formatMoney(item.unitPrice, currencySymbol)}
            </td>
            <td style={{ ...tdStyle, textAlign: "right" }}>
              {formatMoney(item.total, currencySymbol)}
            </td>
          </tr>
        ))}
      </tbody>

      {/* Summary */}
      <tfoot>
        <tr>
          <td colSpan={3} style={summaryLabelStyle}>
            Subtotal
          </td>
          <td style={summaryValueStyle}>
            {formatMoney(subtotal, currencySymbol)}
          </td>
        </tr>
        {taxAmount !== undefined && taxAmount > 0 && (
          <tr>
            <td colSpan={3} style={summaryLabelStyle}>
              Tax
            </td>
            <td style={summaryValueStyle}>
              {formatMoney(taxAmount, currencySymbol)}
            </td>
          </tr>
        )}
        {discountAmount !== undefined && discountAmount > 0 && (
          <tr>
            <td colSpan={3} style={summaryLabelStyle}>
              Discount
            </td>
            <td style={{ ...summaryValueStyle, color: "#059669" }}>
              -{formatMoney(discountAmount, currencySymbol)}
            </td>
          </tr>
        )}
        <tr>
          <td
            colSpan={3}
            style={{
              ...summaryLabelStyle,
              fontWeight: 700,
              fontSize: "15px",
              color: MIDNIGHT_NAVY,
              borderTop: `2px solid ${MIDNIGHT_NAVY}`,
              paddingTop: "10px",
            }}
          >
            Total
          </td>
          <td
            style={{
              ...summaryValueStyle,
              fontWeight: 700,
              fontSize: "15px",
              color: BRAND_ORANGE,
              borderTop: `2px solid ${MIDNIGHT_NAVY}`,
              paddingTop: "10px",
            }}
          >
            {formatMoney(total, currencySymbol)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── Styles ──

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  marginTop: "16px",
  marginBottom: "16px",
};

const thStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  textAlign: "left" as const,
  padding: "8px 10px",
  borderBottom: `2px solid ${BORDER_LIGHT}`,
};

const tdStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontSize: "13px",
  padding: "10px",
  borderBottom: `1px solid ${BORDER_LIGHT}`,
  lineHeight: "1.4",
};

const summaryLabelStyle: React.CSSProperties = {
  color: MUTED_TEXT,
  fontSize: "13px",
  textAlign: "right" as const,
  padding: "6px 10px",
  fontWeight: 500,
};

const summaryValueStyle: React.CSSProperties = {
  color: MIDNIGHT_NAVY,
  fontSize: "13px",
  textAlign: "right" as const,
  padding: "6px 10px",
  fontWeight: 500,
};
