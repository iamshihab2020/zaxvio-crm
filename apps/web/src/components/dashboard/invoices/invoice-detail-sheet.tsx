"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { IconDots, IconTrash } from "@tabler/icons-react";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceDetailTab } from "./invoice-detail-tab";
import { InvoiceLineItemsTab } from "./invoice-line-items-tab";
import { InvoicePaymentsTab } from "./invoice-payments-tab";
import {
  getInvoice,
  sendInvoice,
  getInvoicePdfUrl,
  voidInvoice,
} from "@/actions/invoices";
import { EntityDetailShell } from "@/components/dashboard/reusable/entity-detail-shell";

export interface InvoiceDetail {
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
  pdfStoragePath: string | null;
  customerId: string;
  jobId: string | null;
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
  payments: Array<{
    id: string;
    amount: string;
    paymentMethod: string | null;
    paymentDate: string;
    referenceNumber: string | null;
    notes: string | null;
    createdAt: string;
  }>;
}

interface InvoiceDetailSheetProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (invoice: InvoiceDetail) => void;
  onDataChange: () => void;
}

export function InvoiceDetailSheet({
  invoiceId,
  open,
  onOpenChange,
  onDelete,
  onDataChange,
}: InvoiceDetailSheetProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId || !open) {
      setInvoice(null);
      return;
    }
    setLoading(true);
    getInvoice(invoiceId).then((res) => {
      if (res.data) setInvoice(res.data as InvoiceDetail);
      setLoading(false);
    });
  }, [invoiceId, open]);

  async function refreshDetail() {
    if (!invoiceId) return;
    const res = await getInvoice(invoiceId);
    if (res.data) setInvoice(res.data as InvoiceDetail);
  }

  async function handleSend() {
    if (!invoice) return;
    setSendLoading(true);
    const result = await sendInvoice(invoice.id);
    setSendLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice sent successfully");
      refreshDetail();
      onDataChange();
    }
  }

  async function handleDownloadPdf() {
    if (!invoice) return;
    const url = await getInvoicePdfUrl(invoice.id);
    window.open(url, "_blank");
  }

  async function handleVoid() {
    if (!invoice) return;
    const result = await voidInvoice(invoice.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice voided");
      refreshDetail();
      onDataChange();
    }
  }

  const tabs = useMemo(
    () =>
      invoice
        ? [
            {
              value: "details",
              label: "Details",
              content: (
                <InvoiceDetailTab
                  invoice={invoice}
                  onSend={handleSend}
                  onDownloadPdf={handleDownloadPdf}
                  onVoid={handleVoid}
                  sendLoading={sendLoading}
                />
              ),
            },
            {
              value: "line-items",
              label: "Line Items",
              count: invoice.lineItems.length,
              content: (
                <InvoiceLineItemsTab
                  invoiceId={invoice.id}
                  lineItems={invoice.lineItems}
                  isDraft={invoice.status === "draft"}
                  onUpdate={() => {
                    refreshDetail();
                    onDataChange();
                  }}
                />
              ),
            },
            {
              value: "payments",
              label: "Payments",
              count: invoice.payments.length,
              content: (
                <InvoicePaymentsTab
                  invoiceId={invoice.id}
                  payments={invoice.payments}
                  balanceDue={invoice.balanceDue}
                  isVoid={invoice.status === "void"}
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
    [invoice, sendLoading],
  );

  return (
    <EntityDetailShell
      entityType="invoices"
      entityRoute="/invoices"
      entityLabel="Invoice"
      entityId={invoiceId}
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      hasData={!!invoice}
      renderTitle={() => (
        <>
          <span className="font-heading text-xl tracking-tight">
            {invoice!.invoiceNumber}
          </span>
          <div className="flex items-center gap-1.5 mt-1.5">
            <InvoiceStatusBadge status={invoice!.status} />
          </div>
        </>
      )}
      renderDescription={() => (
        <span>
          {invoice!.customerFirstName} {invoice!.customerLastName}
          {invoice!.jobId && " \u00B7 From Job"}
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
              onClick={() => invoice && onDelete(invoice)}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <IconTrash className="mr-2 h-4 w-4" />
              Delete Invoice
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      tabs={tabs}
    />
  );
}
