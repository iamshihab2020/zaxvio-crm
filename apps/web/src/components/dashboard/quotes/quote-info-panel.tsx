"use client";

import Link from "next/link";
import { IconCalendar, IconReceipt, IconBriefcase } from "@tabler/icons-react";
import { QuoteStatusBadge } from "./quote-status-badge";
import type { QuoteDetail } from "./quote-detail-sheet";

interface QuoteInfoPanelProps {
  quote: QuoteDetail;
}

function formatCurrency(val: string | null) {
  const num = parseFloat(val ?? "0");
  if (num < 0) return `\u2212$${Math.abs(num).toFixed(2)}`;
  return `$${num.toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "\u2014";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function QuoteInfoPanel({ quote }: QuoteInfoPanelProps) {
  const taxPercent = parseFloat(quote.taxRate ?? "0") * 100;

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Warm header */}
      <div className="flex flex-col items-center gap-2 rounded-lg bg-brand-light/50 py-5 -mx-4 sm:-mx-5 -mt-4 sm:-mt-5 rounded-b-none px-4 sm:px-5">
        <h2 className="text-lg font-heading font-semibold text-foreground">
          {quote.quoteNumber}
        </h2>
        <QuoteStatusBadge status={quote.status} />
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
                {formatDate(quote.issuedDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <IconCalendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-body">Valid Until</p>
              <p className="text-sm text-foreground font-body">
                {formatDate(quote.expiryDate)}
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
              {formatCurrency(quote.subtotal)}
            </span>
          </div>
          {taxPercent > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Tax ({taxPercent.toFixed(1)}%)
              </span>
              <span className="text-sm font-body">
                {formatCurrency(quote.taxAmount)}
              </span>
            </div>
          )}
          {parseFloat(quote.discountAmount ?? "0") > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Discount
              </span>
              <span className="text-sm font-body">
                -{formatCurrency(quote.discountAmount)}
              </span>
            </div>
          )}
          <div className="flex justify-between px-3 py-2 bg-muted/30">
            <span className="text-sm font-semibold font-body">Total</span>
            <span className="text-sm font-bold text-brand font-body">
              {formatCurrency(quote.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Converted Job */}
      {quote.convertedToJobId && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-heading flex items-center gap-1.5">
            <IconBriefcase className="h-3.5 w-3.5" />
            Converted Job
          </h3>
          <Link
            href={`/jobs/${quote.convertedToJobId}`}
            className="flex items-center gap-2 rounded-md bg-muted/50 p-3 hover:bg-muted transition-colors group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-light shrink-0">
              <IconBriefcase className="h-4 w-4 text-brand" />
            </div>
            <span className="text-sm font-medium text-foreground group-hover:text-brand transition-colors font-body">
              View created job
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
