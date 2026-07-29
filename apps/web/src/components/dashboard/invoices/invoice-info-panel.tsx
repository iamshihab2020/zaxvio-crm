"use client";

import { IconCalendar, IconReceipt } from "@tabler/icons-react";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import type { InvoiceDetail } from "./invoice-detail-sheet";
import { formatMoney, formatDateOnly } from "@/lib/format";

interface InvoiceInfoPanelProps {
  invoice: InvoiceDetail;
}

// The third hand-rolled copy of these two (INV-19/39) \u2014 no thousands
// separator, and `new Date("2026-07-29")` shifting the day west of UTC.
const formatCurrency = formatMoney;
const formatDate = formatDateOnly;

export function InvoiceInfoPanel({ invoice }: InvoiceInfoPanelProps) {
  const taxPercent = parseFloat(invoice.taxRate ?? "0") * 100;
  const balanceIsZero = parseFloat(invoice.balanceDue) <= 0;

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Warm header */}
      <div className="flex flex-col items-center gap-2 rounded-lg bg-brand-light/50 py-5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 rounded-b-none px-4 sm:px-5">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          {invoice.invoiceNumber}
        </h2>
        <InvoiceStatusBadge status={invoice.status} />
      </div>

      {/* Dates */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading">
          Details
        </h3>
        <div className="rounded-md bg-muted/50 p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-body">Issued</p>
              <p className="text-sm text-foreground font-body">
                {formatDate(invoice.issuedDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconCalendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-body">Due</p>
              <p className="text-sm text-foreground font-body">
                {formatDate(invoice.dueDate)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
          <IconReceipt className="h-3.5 w-3.5" />
          Summary
        </h3>
        <div className="rounded-md border border-border divide-y divide-border">
          <div className="flex justify-between px-3 py-2">
            <span className="text-sm text-muted-foreground font-body">
              Subtotal
            </span>
            <span className="text-sm font-body">
              {formatCurrency(invoice.subtotal)}
            </span>
          </div>
          {taxPercent > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Tax ({Number(taxPercent.toFixed(4))}%)
              </span>
              <span className="text-sm font-body">
                {formatCurrency(invoice.taxAmount)}
              </span>
            </div>
          )}
          {parseFloat(invoice.discountAmount ?? "0") > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Discount
              </span>
              <span className="text-sm font-body">
                -{formatCurrency(invoice.discountAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-3 py-2 bg-muted/30">
            <span className="text-sm font-medium font-body">Total</span>
            <span className="text-sm font-semibold font-body">
              {formatCurrency(invoice.totalAmount)}
            </span>
          </div>
          {parseFloat(invoice.amountPaid) > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Paid
              </span>
              <span className="text-sm text-green-600 dark:text-green-400 font-body">
                -{formatCurrency(invoice.amountPaid)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-3 py-2 bg-muted/30">
            <span className="text-sm font-semibold font-body">Balance Due</span>
            <span
              className={`text-sm font-bold font-body ${
                balanceIsZero
                  ? "text-green-600 dark:text-green-400"
                  : "text-brand"
              }`}
            >
              {formatCurrency(invoice.balanceDue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
