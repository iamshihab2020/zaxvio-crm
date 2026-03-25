"use client";

import { Button } from "@/components/ui/button";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import {
  IconSend,
  IconDownload,
  IconBan,
  IconUser,
  IconReceipt,
  IconNote,
} from "@tabler/icons-react";

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

function formatPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const match = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  return phone;
}

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
    notes: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    jobId: string | null;
  };
  onSend: () => void;
  onDownloadPdf: () => void;
  onVoid: () => void;
  sendLoading: boolean;
}

export function InvoiceDetailTab({
  invoice,
  onSend,
  onDownloadPdf,
  onVoid,
  sendLoading,
}: InvoiceDetailTabProps) {
  const taxPercent = parseFloat(invoice.taxRate ?? "0") * 100;
  const canSend = invoice.status === "draft";
  const canVoid = invoice.status === "draft" || invoice.status === "sent";
  const balanceIsZero = parseFloat(invoice.balanceDue) <= 0;

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
              {formatPhone(invoice.customerPhone)}
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
                Tax ({taxPercent.toFixed(1)}%)
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
