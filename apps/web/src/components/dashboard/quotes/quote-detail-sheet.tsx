"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { QuoteStatusBadge } from "./quote-status-badge";
import { QuoteDetailTab } from "./quote-detail-tab";
import { QuoteLineItemsTab } from "./quote-line-items-tab";
import {
  getQuote,
  sendQuote,
  getQuotePdfUrl,
  acceptQuote,
  declineQuote,
  convertQuoteToJob,
} from "@/actions/quotes";
import { EntityDetailShell } from "@/components/dashboard/reusable/entity-detail-shell";

export interface QuoteDetail {
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
  pdfStoragePath: string | null;
  customerId: string;
  equipmentId: string | null;
  equipmentType: string | null;
  equipmentBrand: string | null;
  equipmentModel: string | null;
  convertedToJobId: string | null;
  declineReason: string | null;
  customerScheduledDate: string | null;
  customerScheduledTime: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: Array<{
    id: string;
    itemType: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string | null;
    catalogItemId: string | null;
    sortOrder: number | null;
  }>;
}

interface QuoteDetailSheetProps {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (quote: QuoteDetail) => void;
  onDataChange: () => void;
}

export function QuoteDetailSheet({
  quoteId,
  open,
  onOpenChange,
  onDelete,
  onDataChange,
}: QuoteDetailSheetProps) {
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);

  useEffect(() => {
    if (!quoteId || !open) {
      setQuote(null);
      return;
    }
    setLoading(true);
    getQuote(quoteId).then((res) => {
      if (res.data) setQuote(res.data as QuoteDetail);
      setLoading(false);
    });
  }, [quoteId, open]);

  async function refreshDetail() {
    if (!quoteId) return;
    const res = await getQuote(quoteId);
    if (res.data) setQuote(res.data as QuoteDetail);
  }

  async function handleSend() {
    if (!quote) return;
    setSendLoading(true);
    const result = await sendQuote(quote.id);
    setSendLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quote sent successfully");
      refreshDetail();
      onDataChange();
    }
  }

  async function handleDownloadPdf() {
    if (!quote) return;
    const url = await getQuotePdfUrl(quote.id);
    window.open(url, "_blank");
  }

  async function handleAccept() {
    if (!quote) return;
    const result = await acceptQuote(quote.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quote accepted");
      refreshDetail();
      onDataChange();
    }
  }

  async function handleDecline() {
    if (!quote) return;
    const result = await declineQuote(quote.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Quote declined");
      refreshDetail();
      onDataChange();
    }
  }

  async function handleConvert(pipelineStageId: string) {
    if (!quote) return;
    setConvertLoading(true);
    const result = await convertQuoteToJob(quote.id, pipelineStageId);
    setConvertLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Job created from quote");
      router.push(`/jobs/${result.data.id}`);
    }
  }

  const tabs = useMemo(
    () =>
      quote
        ? [
            {
              value: "details",
              label: "Details",
              content: (
                <QuoteDetailTab
                  quote={quote}
                  onSend={handleSend}
                  onDownloadPdf={handleDownloadPdf}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                  onConvert={handleConvert}
                  sendLoading={sendLoading}
                  convertLoading={convertLoading}
                />
              ),
            },
            {
              value: "line-items",
              label: "Line Items",
              count: quote.lineItems.length,
              content: (
                <QuoteLineItemsTab
                  quoteId={quote.id}
                  lineItems={quote.lineItems}
                  isDraft={quote.status === "draft"}
                  onUpdate={() => {
                    refreshDetail();
                    onDataChange();
                  }}
                />
              ),
            },
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quote, sendLoading, convertLoading],
  );

  return (
    <EntityDetailShell
      entityType="quotes"
      entityRoute="/quotes"
      entityLabel="Quote"
      entityId={quoteId}
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      hasData={!!quote}
      renderTitle={() => (
        <>
          <span className="font-heading text-xl tracking-tight">
            {quote!.quoteNumber}
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <QuoteStatusBadge status={quote!.status} />
          </div>
        </>
      )}
      renderDescription={() => (
        <span>
          {quote!.customerFirstName} {quote!.customerLastName}
        </span>
      )}
      renderToolbarExtras={() => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 cursor-pointer hover:bg-muted"
            >
              <IconDots className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => quote && onDelete(quote)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Delete Quote
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      tabs={tabs}
    />
  );
}
