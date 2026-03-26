import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuotePdf } from "./quote-pdf.js";

export async function generateQuotePdf(
  quote: {
    quoteNumber: string;
    issuedDate: string;
    expiryDate: string | null;
    subtotal: string;
    taxRate: string | null;
    taxAmount: string | null;
    discountAmount: string | null;
    totalAmount: string;
    notes: string | null;
  },
  lineItems: Array<{
    description: string;
    quantity: string;
    unitPrice: string;
    total: string | null;
    itemType: string;
  }>,
  customer: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null | undefined,
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
    invoiceTermsConditions: string | null;
    invoiceFooterMessage: string | null;
  } | null | undefined,
): Promise<Buffer> {
  const element = React.createElement(QuotePdf, {
    quote,
    lineItems,
    customer: customer ?? null,
    tenant: tenant ?? null,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any);
  return Buffer.from(buffer);
}
