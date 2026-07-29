"use client";

import { Button } from "@/components/ui/button";
import { formatPhoneDisplay } from "@/lib/phone";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import {
  IconSend,
  IconDownload,
  IconBan,
  IconUser,
  IconReceipt,
  IconNote,
  IconBellRinging,
} from "@tabler/icons-react";
import { formatMoney, formatDateOnly } from "@/lib/format";

// INV-19/39: this file had its own `$${num.toFixed(2)}` and its own
// `new Date(val)` \u2014 no thousands separator, and a UTC-midnight day shift on
// every date. Both now come from `lib/format.ts`.
const formatCurrency = formatMoney;
const formatDate = formatDateOnly;

/** Statuses an unpaid, already-sent invoice can be reminded about. */
const REMINDABLE = ["sent", "partially_paid", "overdue"];

interface InvoiceDetailTabProps {
  invoice: {
    id: string;
    invoiceNumber: string;
    status: string;
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
    customerFirstName: string | null;
    customerLastName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    jobId: string | null;
  };
  onSend: () => void;
  onRemind: () => void;
  onDownloadPdf: () => void;
  onVoid: () => void;
  sendLoading: boolean;
  remindLoading: boolean;
}

export function InvoiceDetailTab({
  invoice,
  onSend,
  onRemind,
  onDownloadPdf,
  onVoid,
  sendLoading,
  remindLoading,
}: InvoiceDetailTabProps) {
  const taxPercent = parseFloat(invoice.taxRate ?? "0") * 100;
  const canSend = invoice.status === "draft";
  // Mirrors the server transition table: void is legal from anything that is
  // not already paid or void, not just draft/sent.
  const canVoid = invoice.status !== "void" && invoice.status !== "paid";
  const canRemind = REMINDABLE.includes(invoice.status) && !!invoice.dueDate;
  const balanceIsZero = parseFloat(invoice.balanceDue) <= 0;
  const credit = parseFloat(invoice.creditAmount ?? "0");

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-2">
        {canSend && (
          <Button
            size="sm"
            onClick={onSend}
            disabled={sendLoading}
            className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            <IconSend className="mr-1.5 h-3.5 w-3.5" />
            {sendLoading ? "Sending..." : "Send Invoice"}
          </Button>
        )}
        {/* §4.2: dunning was cron-only, so a contractor who wanted to nudge a
            customer now had no button. */}
        {canRemind && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRemind}
            disabled={remindLoading}
            className="cursor-pointer"
          >
            <IconBellRinging className="mr-1.5 h-3.5 w-3.5" />
            {remindLoading ? "Sending..." : "Send reminder"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onDownloadPdf}
          className="cursor-pointer"
        >
          <IconDownload className="mr-1.5 h-3.5 w-3.5" />
          Download PDF
        </Button>
        {canVoid && (
          <Button
            size="sm"
            variant="outline"
            onClick={onVoid}
            className="cursor-pointer text-destructive hover:text-destructive"
          >
            <IconBan className="mr-1.5 h-3.5 w-3.5" />
            Void
          </Button>
        )}
      </div>

      {/* Status & Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Status
          </p>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Invoice Number
          </p>
          <p className="text-sm font-medium font-body">
            {invoice.invoiceNumber}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Issued
          </p>
          <p className="text-sm font-body">{formatDate(invoice.issuedDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">Due</p>
          <p className="text-sm font-body">{formatDate(invoice.dueDate)}</p>
        </div>
      </div>

      {/* Customer */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <IconUser className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-body uppercase tracking-wider font-medium">
            Customer
          </p>
        </div>
        <div className="rounded-md border border-border p-3 space-y-1">
          <p className="text-sm font-medium font-body">
            {invoice.customerFirstName} {invoice.customerLastName}
          </p>
          {invoice.customerEmail && (
            <p className="text-xs text-muted-foreground font-body">
              {invoice.customerEmail}
            </p>
          )}
          {invoice.customerPhone && (
            <p className="text-xs text-muted-foreground font-body">
              {formatPhoneDisplay(invoice.customerPhone)}
            </p>
          )}
          {invoice.customerAddress && (
            <p className="text-xs text-muted-foreground font-body">
              {invoice.customerAddress}
            </p>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs text-muted-foreground font-body uppercase tracking-wider font-medium">
            Summary
          </p>
        </div>
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
            <span className="text-sm font-semibold font-body">
              Balance Due
            </span>
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
          {credit > 0 && (
            <div className="flex justify-between px-3 py-2">
              <span className="text-sm text-muted-foreground font-body">
                Credit on account
              </span>
              <span className="text-sm text-blue-600 dark:text-blue-400 font-body">
                {formatCurrency(invoice.creditAmount ?? "0")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <IconNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider font-medium">
              Notes
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {invoice.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
