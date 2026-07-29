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
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import { ConfirmActionDialog } from "@/components/reusable/confirm-action-dialog";
import {
  IconChevronRight,
  IconSend,
  IconDownload,
  IconBan,
  IconDots,
  IconTrash,
  IconCheck,
  IconBellRinging,
} from "@tabler/icons-react";
import { downloadInvoicePdf } from "@/actions/invoices";
import { openPdfPayload } from "@/lib/open-pdf";
import {
  useSendInvoice,
  useVoidInvoice,
  useDeleteInvoice,
  usePayInFull,
  useRemindInvoice,
} from "@/hooks/queries";
import { formatMoney } from "@/lib/format";
import type { InvoiceDetail } from "./invoice-detail-sheet";

/** Mirrors `PAYABLE_STATUSES` / `UNPAID_STATUSES` on the server. */
const PAYABLE = ["sent", "partially_paid", "overdue"];

interface InvoiceDetailHeaderProps {
  invoice: InvoiceDetail;
  onUpdate: () => void;
  children?: React.ReactNode;
}

export function InvoiceDetailHeader({
  invoice,
  onUpdate,
  children,
}: InvoiceDetailHeaderProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  // These called the server actions directly, so an edit made from this header
  // could not invalidate the list or the stat cards (INV-17).
  const sendMutation = useSendInvoice();
  const voidMutation = useVoidInvoice();
  const deleteMutation = useDeleteInvoice();
  const payInFullMutation = usePayInFull();
  const remindMutation = useRemindInvoice();

  const canSend = invoice.status === "draft";
  // Matches the server transition table rather than the old draft/sent guess.
  const canVoid = invoice.status !== "void" && invoice.status !== "paid";
  const canPay = PAYABLE.includes(invoice.status) && parseFloat(invoice.balanceDue) > 0;
  const canRemind = PAYABLE.includes(invoice.status) && !!invoice.dueDate;
  const customerName =
    `${invoice.customerFirstName ?? ""} ${invoice.customerLastName ?? ""}`.trim() ||
    "Unknown Customer";

  function handleSend() {
    sendMutation.mutate(invoice.id, {
      onSuccess: (res) => {
        if (!res.error) onUpdate();
      },
    });
  }

  async function handleDownloadPdf() {
    const res = await downloadInvoicePdf(invoice.id);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't open the PDF");
      return;
    }
    openPdfPayload(res.data);
  }

  function handleVoid() {
    voidMutation.mutate(invoice.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setVoidOpen(false);
        onUpdate();
      },
    });
  }

  function handlePayInFull() {
    payInFullMutation.mutate(
      { id: invoice.id },
      {
        onSuccess: (res) => {
          if (res.error) return;
          setPayOpen(false);
          onUpdate();
        },
      },
    );
  }

  function handleDelete() {
    deleteMutation.mutate(invoice.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setDeleteOpen(false);
        router.push("/invoices");
      },
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 py-3 sm:py-4">
        {/* Left: breadcrumb + invoice info */}
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm font-body">
            <Link
              href="/invoices"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Invoices
            </Link>
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          </nav>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground font-heading text-sm">
                {invoice.invoiceNumber}
              </span>
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="text-xs text-muted-foreground font-body">
              {customerName}
            </p>
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-2">
          {children}
          {canSend && (
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              <IconSend className="mr-1.5 h-3.5 w-3.5" />
              {sendMutation.isPending ? "Sending..." : "Send"}
            </Button>
          )}
          {/* §4.1: "the customer handed me a cheque" was four interactions deep. */}
          {canPay && (
            <Button
              size="sm"
              onClick={() => setPayOpen(true)}
              disabled={payInFullMutation.isPending}
              className="bg-brand text-brand-foreground hover:bg-brand/90 cursor-pointer"
            >
              <IconCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark paid
            </Button>
          )}
          {/* §4.2: dunning was cron-only — there was no way to nudge now. */}
          {canRemind && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => remindMutation.mutate(invoice.id)}
              disabled={remindMutation.isPending}
              className="cursor-pointer"
            >
              <IconBellRinging className="mr-1.5 h-3.5 w-3.5" />
              Remind
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
          {canVoid && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setVoidOpen(true)}
              className="cursor-pointer text-destructive hover:text-destructive"
            >
              <IconBan className="mr-1.5 h-3.5 w-3.5" />
              Void
            </Button>
          )}
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
                Delete Invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DeleteConfirmDialog
        entityName="Invoice"
        itemLabel={invoice.invoiceNumber}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        description="All line items and payment records will also be deleted."
      />

      {/* Voiding is irreversible and used to fire straight off the button. */}
      <ConfirmActionDialog
        title="Void Invoice"
        description={`Void invoice ${invoice.invoiceNumber}? This cannot be undone, and the stored PDF will be replaced with a watermarked copy.`}
        open={voidOpen}
        onOpenChange={setVoidOpen}
        onConfirm={handleVoid}
        confirmLabel="Void Invoice"
        loading={voidMutation.isPending}
      />

      <ConfirmActionDialog
        title="Mark paid in full"
        description={`Record a ${formatMoney(invoice.balanceDue)} payment and close this invoice?`}
        open={payOpen}
        onOpenChange={setPayOpen}
        onConfirm={handlePayInFull}
        confirmLabel="Mark paid"
        loading={payInFullMutation.isPending}
      />
    </>
  );
}
