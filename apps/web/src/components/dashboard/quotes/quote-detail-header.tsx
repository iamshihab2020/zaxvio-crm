"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuoteStatusBadge } from "./quote-status-badge";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { ConfirmActionDialog } from "@/components/reusable/confirm-action-dialog";
import { ConvertToJobDialog } from "@/components/reusable/convert-to-job-dialog";
import {
  IconAlertTriangle,
  IconChevronRight,
  IconSend,
  IconDownload,
  IconCheck,
  IconX,
  IconTransform,
  IconDots,
  IconTrash,
  IconExternalLink,
} from "@tabler/icons-react";
import { downloadQuotePdf } from "@/actions/quotes";
import {
  useSendQuote,
  useAcceptQuote,
  useDeclineQuote,
  useConvertQuoteToJob,
  useDeleteQuote,
} from "@/hooks/queries";
import { openPdfPayload } from "@/lib/open-pdf";
import type { QuoteDetail } from "./quote-detail-sheet";

interface QuoteDetailHeaderProps {
  quote: QuoteDetail;
  onUpdate: () => void;
  children?: React.ReactNode;
}

export function QuoteDetailHeader({
  quote,
  onUpdate,
  children,
}: QuoteDetailHeaderProps) {
  const router = useRouter();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // QUO-15: these were bare server-action calls, so nothing on this page
  // invalidated the quotes list, the jobs board or the dashboard after a send,
  // an accept or a convert. The hooks that do have existed all along.
  const sendMutation = useSendQuote();
  const acceptMutation = useAcceptQuote();
  const declineMutation = useDeclineQuote();
  const convertMutation = useConvertQuoteToJob();
  const deleteMutation = useDeleteQuote();

  const sendLoading = sendMutation.isPending;
  const convertLoading = convertMutation.isPending;
  const deleteLoading = deleteMutation.isPending;

  const canSend = quote.status === "draft";
  const canAcceptDecline = quote.status === "sent";
  const canConvert =
    (quote.status === "accepted" || quote.status === "sent") &&
    !quote.convertedToJobId;
  const canDelete = quote.status === "draft";
  const customerName =
    `${quote.customerFirstName ?? ""} ${quote.customerLastName ?? ""}`.trim() ||
    "Unknown Customer";

  function handleSend() {
    sendMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onUpdate();
      },
    });
  }

  async function handleDownloadPdf() {
    const res = await downloadQuotePdf(quote.id);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't open the PDF");
      return;
    }
    openPdfPayload(res.data);
  }

  function handleAccept() {
    acceptMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onUpdate();
      },
    });
  }

  function handleDecline() {
    declineMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (!res.error) onUpdate();
      },
    });
  }

  function handleConvert(pipelineStageId: string) {
    convertMutation.mutate(
      { id: quote.id, pipelineStageId },
      {
        onSuccess: (res) => {
          if (!res.error) router.push(`/jobs/${res.data.id}`);
        },
      },
    );
  }

  function handleDelete() {
    deleteMutation.mutate(quote.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setDeleteOpen(false);
        router.push("/quotes");
      },
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: breadcrumb + quote info */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm font-body">
            <Link
              href="/quotes"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Quotes
            </Link>
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          </nav>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground font-heading text-sm">
                {quote.quoteNumber}
              </span>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <p className="text-xs text-muted-foreground font-body">
              {customerName}
            </p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {children}
          {canSend && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendLoading}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              <IconSend className="mr-1.5 h-3.5 w-3.5" />
              {sendLoading ? "Sending..." : "Send"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            className="cursor-pointer"
          >
            <IconDownload className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          {canAcceptDecline && (
            <>
              <Button
                size="sm"
                onClick={handleAccept}
                className="bg-green-600 text-white hover:bg-green-700 cursor-pointer"
              >
                <IconCheck className="mr-1.5 h-3.5 w-3.5" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
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
              onClick={() => router.push(`/jobs/${quote.convertedToJobId}`)}
              className="cursor-pointer"
            >
              <IconExternalLink className="mr-1.5 h-3.5 w-3.5" />
              View Job
            </Button>
          )}
          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                >
                  <IconDots className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete Quote
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <DeleteConfirmDialog
        entityName="Quote"
        itemLabel={quote.quoteNumber}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleteLoading}
        description="All line items will also be deleted."
      />

      <ConvertToJobDialog
        open={convertDialogOpen}
        onOpenChange={setConvertDialogOpen}
        onConfirm={(stageId) => {
          setConvertDialogOpen(false);
          handleConvert(stageId);
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
    </>
  );
}
