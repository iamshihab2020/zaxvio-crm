"use client";

import { useState } from "react";
import { formatPhoneDisplay } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { QuoteStatusBadge } from "./quote-status-badge";
import { ConvertToJobDialog } from "@/components/reusable/convert-to-job-dialog";
import Link from "next/link";
import {
  IconSend,
  IconDownload,
  IconCheck,
  IconX,
  IconTransform,
  IconExternalLink,
  IconUser,
  IconReceipt,
  IconNote,
  IconAlertTriangle,
  IconDevices2,
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

interface QuoteDetailTabProps {
  quote: {
    id: string;
    quoteNumber: string;
    status: string;
    issuedDate: string;
    expiryDate: string | null;
    subtotal: string;
    taxRate: string | null;
    taxAmount: string | null;
    discountAmount: string | null;
    totalAmount: string;
    notes: string | null;
    equipmentId: string | null;
    equipmentType: string | null;
    equipmentBrand: string | null;
    equipmentModel: string | null;
    customerFirstName: string | null;
    customerLastName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerAddress: string | null;
    convertedToJobId: string | null;
    declineReason: string | null;
    customerScheduledDate: string | null;
    customerScheduledTime: string | null;
  };
  onSend: () => void;
  onDownloadPdf: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onConvert: (pipelineStageId: string) => void;
  sendLoading: boolean;
  convertLoading: boolean;
}

export function QuoteDetailTab({
  quote,
  onSend,
  onDownloadPdf,
  onAccept,
  onDecline,
  onConvert,
  sendLoading,
  convertLoading,
}: QuoteDetailTabProps) {
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const taxPercent = parseFloat(quote.taxRate ?? "0") * 100;
  const canSend = quote.status === "draft";
  const canAcceptDecline = quote.status === "sent";
  const canConvert =
    (quote.status === "accepted" || quote.status === "sent") &&
    !quote.convertedToJobId;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        {canSend && (
          <Button
            size="sm"
            onClick={onSend}
            disabled={sendLoading}
            className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            <IconSend className="mr-1.5 h-3.5 w-3.5" />
            {sendLoading ? "Sending..." : "Send Quote"}
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
        {canAcceptDecline && (
          <>
            <Button
              size="sm"
              onClick={onAccept}
              className="bg-green-600 text-white hover:bg-green-700 cursor-pointer"
            >
              <IconCheck className="mr-1.5 h-3.5 w-3.5" />
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              <IconX className="mr-1.5 h-3.5 w-3.5" />
              Decline
            </Button>
          </>
        )}
        {canConvert && (
          <Button
            size="sm"
            onClick={() => setConvertDialogOpen(true)}
            disabled={convertLoading}
            className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
          >
            <IconTransform className="mr-1.5 h-3.5 w-3.5" />
            {convertLoading ? "Converting..." : "Convert to Job"}
          </Button>
        )}
        {quote.convertedToJobId && (
          <Button
            size="sm"
            variant="outline"
            asChild
            className="cursor-pointer"
          >
            <Link href={`/jobs/${quote.convertedToJobId}`}>
              <IconExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View Job
            </Link>
          </Button>
        )}
      </div>

      <ConvertToJobDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConfirm={(stageId) => {
          setConvertDialogOpen(false);
          onConvert(stageId);
        }}
        loading={convertLoading}
        description={
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-body">
              A new job will be created with all line items copied from this quote.
            </p>
            {quote.status === "sent" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-2.5">
                <IconAlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  This quote hasn&apos;t been formally accepted. Converting will mark it as accepted.
                </p>
              </div>
            )}
          </div>
        }
      />

      {/* Status & Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Status
          </p>
          <QuoteStatusBadge status={quote.status} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Quote Number
          </p>
          <p className="text-sm font-medium font-body">
            {quote.quoteNumber}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Issued
          </p>
          <p className="text-sm font-body">{formatDate(quote.issuedDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1 font-body">
            Valid Until
          </p>
          <p className="text-sm font-body">{formatDate(quote.expiryDate)}</p>
        </div>
      </div>

      {/* Online Response Info */}
      {(quote.declineReason || quote.customerScheduledDate) && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          {quote.declineReason && (
            <div>
              <p className="text-xs text-muted-foreground font-body mb-0.5">
                Decline Reason (from customer)
              </p>
              <p className="text-sm font-body text-foreground">
                &ldquo;{quote.declineReason}&rdquo;
              </p>
            </div>
          )}
          {quote.customerScheduledDate && (
            <div>
              <p className="text-xs text-muted-foreground font-body mb-0.5">
                Customer&apos;s Preferred Appointment
              </p>
              <p className="text-sm font-body text-foreground">
                {formatDate(quote.customerScheduledDate)}
                {quote.customerScheduledTime &&
                  ` at ${quote.customerScheduledTime}`}
              </p>
            </div>
          )}
        </div>
      )}

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
            {quote.customerFirstName} {quote.customerLastName}
          </p>
          {quote.customerEmail && (
            <p className="text-xs text-muted-foreground font-body">
              {quote.customerEmail}
            </p>
          )}
          {quote.customerPhone && (
            <p className="text-xs text-muted-foreground font-body">
              {formatPhoneDisplay(quote.customerPhone)}
            </p>
          )}
          {quote.customerAddress && (
            <p className="text-xs text-muted-foreground font-body">
              {quote.customerAddress}
            </p>
          )}
        </div>
      </div>

      {/* Equipment */}
      {quote.equipmentId && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <IconDevices2 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider font-medium">
              Equipment
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <Link
              href={`/assets/${quote.equipmentId}`}
              className="text-sm font-medium font-body hover:text-brand transition-colors"
            >
              {[quote.equipmentType, quote.equipmentBrand, quote.equipmentModel]
                .filter(Boolean)
                .join(" — ")}
            </Link>
          </div>
        </div>
      )}

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

      {/* Notes */}
      {quote.notes && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <IconNote className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground font-body uppercase tracking-wider font-medium">
              Notes
            </p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-sm text-foreground font-body whitespace-pre-wrap">
              {quote.notes}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
