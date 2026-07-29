import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
  },
  logo: {
    width: 60,
    height: 60,
    marginRight: 12,
    objectFit: "contain",
  },
  businessName: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#E8652D",
    marginBottom: 4,
  },
  businessDetail: {
    fontSize: 9,
    color: "#666",
    marginBottom: 2,
  },
  invoiceTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textAlign: "right",
  },
  invoiceNumber: {
    fontSize: 10,
    color: "#666",
    textAlign: "right",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  metaSection: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 10,
    marginBottom: 2,
  },
  // Table
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  colDescription: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  headerText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
  },
  // Summary
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  summaryLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 12,
    color: "#666",
  },
  summaryValue: {
    width: 80,
    textAlign: "right",
  },
  summaryTotalLabel: {
    width: 120,
    textAlign: "right",
    paddingRight: 12,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  summaryTotalValue: {
    width: 80,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  balanceDue: {
    width: 80,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    color: "#E8652D",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    marginVertical: 8,
  },
  notes: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#fafafa",
    borderRadius: 4,
  },
  notesLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: "#444",
  },
  infoSection: {
    marginTop: 16,
  },
  infoSectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoSectionText: {
    fontSize: 9,
    color: "#444",
    lineHeight: 1.5,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 9,
    color: "#999",
  },
  footerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginBottom: 8,
  },
  // INV-25 — a void invoice must not read as payable.
  voidWatermark: {
    position: "absolute",
    top: 300,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  voidWatermarkText: {
    fontSize: 110,
    fontFamily: "Helvetica-Bold",
    color: "#d4d4d4",
    opacity: 0.45,
    transform: "rotate(-30deg)",
  },
  voidLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#b91c1c",
    textAlign: "right",
    marginTop: 4,
  },
});

/**
 * `$1234.50` on a customer-facing document (INV-39). `toLocaleString` gives the
 * thousands separator and keeps the two decimals a money figure needs.
 */
function formatCurrency(val: string | number | null | undefined): string {
  const num = parseFloat(String(val ?? "0"));
  const safe = Number.isFinite(num) ? num : 0;
  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * A `date` column arrives as `YYYY-MM-DD`. `new Date("2026-07-29")` is UTC
 * midnight, and `toLocaleDateString` then renders it in the *server's* zone \u2014
 * so anywhere west of UTC the customer's invoice printed the previous day
 * (INV-19). Anchoring at noon UTC and formatting in UTC removes both shifts.
 */
function formatDate(val: string | null | undefined): string {
  if (!val) return "\u2014";
  const d = new Date(`${val}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * "Tax (8.3%)" beside a correctly-computed 8.25% amount \u2014 the document
 * contradicted itself (INV-21). Show what was actually applied: up to four
 * decimal places (the column's precision), with trailing zeros trimmed.
 */
function formatTaxPercent(rate: string | null | undefined): string {
  const percent = parseFloat(rate ?? "0") * 100;
  if (!Number.isFinite(percent)) return "0";
  return String(Number(percent.toFixed(4)));
}

interface InvoicePdfProps {
  invoice: {
    invoiceNumber: string;
    status?: string | null;
    issuedDate: string;
    dueDate: string | null;
    subtotal: string;
    taxRate: string | null;
    taxAmount: string | null;
    discountAmount: string | null;
    totalAmount: string;
    amountPaid: string;
    balanceDue: string;
    creditAmount?: string | null;
    notes: string | null;
  };
  lineItems: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    total: string | null;
    itemType: string;
  }>;
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  tenant: {
    businessName: string;
    ownerName: string;
    email: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    logoUrl: string | null;
    licenseNumber: string | null;
    invoicePaymentTerms: string | null;
    invoicePaymentInstructions: string | null;
    invoiceTermsConditions: string | null;
    invoiceFooterMessage: string | null;
  } | null;
}

export function InvoicePdf({
  invoice,
  lineItems,
  customer,
  tenant,
}: InvoicePdfProps) {
  const taxPercent = parseFloat(invoice.taxRate ?? "0") * 100;
  const hasPaymentInstructions = !!tenant?.invoicePaymentInstructions;
  const hasTermsConditions = !!tenant?.invoiceTermsConditions;
  const footerMessage =
    tenant?.invoiceFooterMessage || "Thank you for your business!";
  const isVoid = invoice.status === "void";
  const credit = parseFloat(invoice.creditAmount ?? "0");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/*
          INV-25: a voided invoice's PDF was byte-identical to a live one —
          `status` was never rendered — so a customer holding the link still had
          a document that read as payable.
        */}
        {isVoid && (
          <View style={styles.voidWatermark} fixed>
            <Text style={styles.voidWatermarkText}>VOID</Text>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {tenant?.logoUrl && (
              <Image src={tenant.logoUrl} style={styles.logo} />
            )}
            <View>
              <Text style={styles.businessName}>
                {tenant?.businessName ?? "Business"}
              </Text>
              {tenant?.ownerName && (
                <Text style={styles.businessDetail}>{tenant.ownerName}</Text>
              )}
              {tenant?.phone && (
                <Text style={styles.businessDetail}>{tenant.phone}</Text>
              )}
              {tenant?.email && (
                <Text style={styles.businessDetail}>{tenant.email}</Text>
              )}
              {tenant?.address && (
                <Text style={styles.businessDetail}>{tenant.address}</Text>
              )}
              {(tenant?.city || tenant?.state || tenant?.zipCode) && (
                <Text style={styles.businessDetail}>
                  {[tenant.city, tenant.state, tenant.zipCode]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              )}
              {tenant?.licenseNumber && (
                <Text style={styles.businessDetail}>
                  License: {tenant.licenseNumber}
                </Text>
              )}
            </View>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
            {isVoid && <Text style={styles.voidLabel}>VOID — NOT PAYABLE</Text>}
          </View>
        </View>

        {/* Meta: Bill To + Invoice Details */}
        <View style={styles.metaRow}>
          <View style={styles.metaSection}>
            <Text style={styles.sectionLabel}>Bill To</Text>
            <Text style={styles.metaText}>
              {customer
                ? `${customer.firstName} ${customer.lastName}`
                : "\u2014"}
            </Text>
            {customer?.email && (
              <Text style={styles.metaText}>{customer.email}</Text>
            )}
            {customer?.phone && (
              <Text style={styles.metaText}>{customer.phone}</Text>
            )}
            {customer?.address && (
              <Text style={styles.metaText}>{customer.address}</Text>
            )}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.sectionLabel}>Invoice Details</Text>
            <Text style={styles.metaText}>
              Issued: {formatDate(invoice.issuedDate)}
            </Text>
            {invoice.dueDate && (
              <Text style={styles.metaText}>
                Due: {formatDate(invoice.dueDate)}
              </Text>
            )}
            {tenant?.invoicePaymentTerms && (
              <Text style={styles.metaText}>
                Terms: {tenant.invoicePaymentTerms}
              </Text>
            )}
          </View>
        </View>

        {/* Line Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.headerText, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.headerText, styles.colQty]}>Qty</Text>
            <Text style={[styles.headerText, styles.colPrice]}>Price</Text>
            <Text style={[styles.headerText, styles.colTotal]}>Total</Text>
          </View>
          {lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>
                {formatCurrency(item.unitPrice)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCurrency(
                  item.total ??
                    String(
                      parseFloat(item.quantity) * parseFloat(item.unitPrice),
                    ),
                )}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>
            {formatCurrency(invoice.subtotal)}
          </Text>
        </View>
        {taxPercent > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Tax ({formatTaxPercent(invoice.taxRate)}%)
            </Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(invoice.taxAmount)}
            </Text>
          </View>
        )}
        {parseFloat(invoice.discountAmount ?? "0") > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryValue}>
              -{formatCurrency(invoice.discountAmount)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>
            {formatCurrency(invoice.totalAmount)}
          </Text>
        </View>
        {parseFloat(invoice.amountPaid) > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Paid</Text>
            <Text style={styles.summaryValue}>
              -{formatCurrency(invoice.amountPaid)}
            </Text>
          </View>
        )}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Balance Due</Text>
          <Text style={styles.balanceDue}>
            {formatCurrency(invoice.balanceDue)}
          </Text>
        </View>
        {/* Overpayment used to be clamped away silently (INV-02). */}
        {credit > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Credit on account</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(invoice.creditAmount)}
            </Text>
          </View>
        )}

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Payment Instructions */}
        {hasPaymentInstructions && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionLabel}>Payment Instructions</Text>
            <Text style={styles.infoSectionText}>
              {tenant.invoicePaymentInstructions}
            </Text>
          </View>
        )}

        {/* Terms & Conditions */}
        {hasTermsConditions && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionLabel}>Terms & Conditions</Text>
            <Text style={styles.infoSectionText}>
              {tenant.invoiceTermsConditions}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />
          <Text>{footerMessage}</Text>
        </View>
      </Page>
    </Document>
  );
}
