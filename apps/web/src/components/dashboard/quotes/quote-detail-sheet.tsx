"use client";

import { useMemo } from "react";
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
import { downloadQuotePdf } from "@/actions/quotes";
import { openPdfPayload } from "@/lib/open-pdf";
import {
  useQuote,
  useSendQuote,
  useAcceptQuote,
  useDeclineQuote,
  useConvertQuoteToJob,
} from "@/hooks/queries";
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

  // QUO-15: this held its own `useState` copy fetched with a bare server
  // action, so opening the same quote five times was five fetches and every
  // mutation left the list, the stats and the dashboard stale. `useQuote`
  // existed the whole time with zero callers.
  const quoteQuery = useQuote(quoteId ?? "");
  const quote = (quoteQuery.data?.data ?? null) as QuoteDetail | null;
  const loading = Boolean(quoteId) && open && quoteQuery.isPending;
  // QUO-06: the fetch used to be `.then(res => { if (res.data) … })` with no
  // catch and `res.error` discarded, so a 500 opened a blank sheet.
  const loadError = quoteQuery.isError
    ? "Something went wrong loading this quote."
    : (quoteQuery.data?.error ?? null);

  const sendMutation = useSendQuote();
  const acceptMutation = useAcceptQuote();
  const declineMutation = useDeclineQuote();
  const convertMutation = useConvertQuoteToJob();

  const sendLoading = sendMutation.isPending;
  const convertLoading = convertMutation.isPending;

  function handleSend() {
    if (!quote) return;
    sendMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onDataChange();
      },
    });
  }

  async function handleDownloadPdf() {
    if (!quote) return;
    // QUO-13: was `window.open(rawApiUrl)`, which the browser requests
    // cross-origin without the session cookie — a 401 body in a new tab.
    const res = await downloadQuotePdf(quote.id);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't open the PDF");
      return;
    }
    openPdfPayload(res.data);
  }

  function handleAccept() {
    if (!quote) return;
    acceptMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onDataChange();
      },
    });
  }

  function handleDecline() {
    if (!quote) return;
    declineMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onDataChange();
      },
    });
  }

  function handleConvert(pipelineStageId: string) {
    if (!quote) return;
    convertMutation.mutate(
      { id: quote.id, pipelineStageId },
      {
        onSuccess: (res) => {
          if (!res.error) router.push(`/jobs/${res.data.id}`);
        },
      },
    );
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
                    quoteQuery.refetch();
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
      loadError={loadError}
      onRetry={() => quoteQuery.refetch()}
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
