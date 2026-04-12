"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  total: string;
  itemType: string;
}

interface QuoteReviewCardProps {
  business: {
    name: string;
    logoUrl: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
  };
  quote: {
    quoteNumber: string;
    issuedDate: string;
    expiryDate: string | null;
    lineItems: LineItem[];
    subtotal: string;
    taxAmount: string;
    discountAmount: string;
    totalAmount: string;
    notes: string | null;
    termsConditions: string | null;
    customerName: string;
  };
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function QuoteReviewCard({ business, quote }: QuoteReviewCardProps) {
  return (
    <div className="space-y-6">
      {/* Quote Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-body">Estimate</p>
          <p className="text-lg font-semibold font-heading">{quote.quoteNumber}</p>
        </div>
        <div className="text-right text-sm text-muted-foreground font-body">
          <p>Issued: {formatDate(quote.issuedDate)}</p>
          {quote.expiryDate && (
            <p>Valid until: {formatDate(quote.expiryDate)}</p>
          )}
        </div>
      </div>

      {/* Customer */}
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-heading mb-1">
          Prepared for
        </p>
        <p className="text-sm font-medium font-body">{quote.customerName}</p>
      </div>

      {/* Line Items */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-heading text-xs">Description</TableHead>
              <TableHead className="font-heading text-xs text-center w-20">Qty</TableHead>
              <TableHead className="font-heading text-xs text-right w-24">Price</TableHead>
              <TableHead className="font-heading text-xs text-right w-24">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.lineItems.map((item, i) => (
              <TableRow key={i}>
                <TableCell className="font-body text-sm">{item.description}</TableCell>
                <TableCell className="font-body text-sm text-center">
                  {Number(item.quantity)}
                </TableCell>
                <TableCell className="font-body text-sm text-right">
                  {formatCurrency(item.unitPrice)}
                </TableCell>
                <TableCell className="font-body text-sm text-right font-medium">
                  {formatCurrency(item.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="ml-auto w-64 space-y-1 text-sm font-body">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(quote.subtotal)}</span>
        </div>
        {Number(quote.taxAmount) > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(quote.taxAmount)}</span>
          </div>
        )}
        {Number(quote.discountAmount) > 0 && (
          <div className="flex justify-between text-green-600 dark:text-green-400">
            <span>Discount</span>
            <span>-{formatCurrency(quote.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
          <span>Total</span>
          <span className="text-brand">{formatCurrency(quote.totalAmount)}</span>
        </div>
      </div>

      {/* Notes */}
      {quote.notes && (
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-heading mb-1">
            Notes
          </p>
          <p className="text-sm text-foreground font-body whitespace-pre-wrap">
            {quote.notes}
          </p>
        </div>
      )}

      {/* Terms */}
      {quote.termsConditions && (
        <div className="text-xs text-muted-foreground font-body">
          <p className="font-semibold mb-1">Terms & Conditions</p>
          <p className="whitespace-pre-wrap">{quote.termsConditions}</p>
        </div>
      )}
    </div>
  );
}
