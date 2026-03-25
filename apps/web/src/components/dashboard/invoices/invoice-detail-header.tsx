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
import {
  IconChevronRight,
  IconSend,
  IconDownload,
  IconBan,
  IconDots,
  IconTrash,
} from "@tabler/icons-react";
import {
  sendInvoice,
  getInvoicePdfUrl,
  voidInvoice,
  deleteInvoice,
} from "@/actions/invoices";
import type { InvoiceDetail } from "./invoice-detail-sheet";

interface InvoiceDetailHeaderProps {
  invoice: InvoiceDetail;
  onUpdate: () => void;
}

export function InvoiceDetailHeader({
  invoice,
  onUpdate,
}: InvoiceDetailHeaderProps) {
  const router = useRouter();
  const [sendLoading, setSendLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canSend = invoice.status === "draft";
  const canVoid = invoice.status === "draft" || invoice.status === "sent";
  const customerName =
    `${invoice.customerFirstName ?? ""} ${invoice.customerLastName ?? ""}`.trim() ||
    "Unknown Customer";

  async function handleSend() {
    setSendLoading(true);
    const result = await sendInvoice(invoice.id);
    setSendLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice sent successfully");
      onUpdate();
    }
  }

  async function handleDownloadPdf() {
    const url = await getInvoicePdfUrl(invoice.id);
    window.open(url, "_blank");
  }

  async function handleVoid() {
    const result = await voidInvoice(invoice.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice voided");
      onUpdate();
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    const result = await deleteInvoice(invoice.id);
    setDeleteLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice deleted");
      setDeleteOpen(false);
      router.push("/invoices");
    }
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
          {canVoid && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleVoid}
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
        loading={deleteLoading}
        description="All line items and payment records will also be deleted."
      />
    </>
  );
}
