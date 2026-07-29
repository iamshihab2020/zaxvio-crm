"use client";

import { useState, useMemo } from "react";
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
import { InvoicePhotosTab } from "./invoice-photos-tab";
import { downloadInvoicePdf } from "@/actions/invoices";
import { openPdfPayload } from "@/lib/open-pdf";
import {
  useInvoice,
  useSendInvoice,
  useVoidInvoice,
  useRemindInvoice,
} from "@/hooks/queries";
import { EntityDetailShell } from "@/components/dashboard/reusable/entity-detail-shell";
import { ConfirmActionDialog } from "@/components/reusable/confirm-action-dialog";

/** Statuses that may take a payment — mirrors `PAYABLE_STATUSES` on the server. */
const PAYABLE = ["sent", "partially_paid", "overdue"];

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
  creditAmount: string | null;
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
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);

  // INV-17: this kept the invoice in `useState` and refetched by hand, so
  // `useInvoice` existed with **0 callers**, the hover prefetch filled a cache
  // nothing read (INV-16), and a mutation made from the sheet could not
  // invalidate anything. Same fix JOB-40 applied to the jobs detail page.
  const query = useInvoice(open ? invoiceId : null);
  const invoice = (query.data?.data as InvoiceDetail | undefined) ?? null;
  const loadError = query.data?.error ?? (query.error ? "Network error" : null);

  const sendMutation = useSendInvoice();
  const voidMutation = useVoidInvoice();
  const remindMutation = useRemindInvoice();

  function handleSend() {
    if (!invoice) return;
    sendMutation.mutate(invoice.id, {
      onSuccess: (res) => {
        if (!res.error) onDataChange();
      },
    });
  }

  function handleRemind() {
    if (!invoice) return;
    remindMutation.mutate(invoice.id);
  }

  async function handleDownloadPdf() {
    if (!invoice) return;
    const res = await downloadInvoicePdf(invoice.id);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Couldn't open the PDF");
      return;
    }
    openPdfPayload(res.data);
  }

  function confirmVoid() {
    if (!invoice) return;
    voidMutation.mutate(invoice.id, {
      onSuccess: (res) => {
        if (res.error) return;
        setVoidDialogOpen(false);
        onDataChange();
      },
    });
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
                  onRemind={handleRemind}
                  onDownloadPdf={handleDownloadPdf}
                  onVoid={() => setVoidDialogOpen(true)}
                  sendLoading={sendMutation.isPending}
                  remindLoading={remindMutation.isPending}
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
                  onUpdate={onDataChange}
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
                  creditAmount={invoice.creditAmount}
                  canTakePayment={PAYABLE.includes(invoice.status)}
                  isVoid={invoice.status === "void"}
                  onUpdate={onDataChange}
                />
              ),
            },
            ...(invoice.jobId
              ? [
                  {
                    value: "photos",
                    label: "Photos",
                    content: <InvoicePhotosTab jobId={invoice.jobId} />,
                  },
                ]
              : []),
          ]
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoice, sendMutation.isPending, remindMutation.isPending],
  );

  return (
    <>
      <EntityDetailShell
        entityType="invoices"
        entityRoute="/invoices"
        entityLabel="Invoice"
        entityId={invoiceId}
        open={open}
        onOpenChange={onOpenChange}
        loading={query.isPending && !!invoiceId}
        hasData={!!invoice}
        // INV-12: the sheet discarded the error and passed only loading/hasData,
        // so a 500 opened a completely blank sheet — the exact case
        // `EntityDetailShell` gained `loadError`/`onRetry` for in July.
        loadError={loadError}
        onRetry={() => query.refetch()}
        renderTitle={() => (
          <>
            <span className="font-heading text-xl tracking-tight">
              {invoice!.invoiceNumber}
            </span>
            <div className="mt-1.5 flex items-center gap-1.5">
              <InvoiceStatusBadge status={invoice!.status} />
            </div>
          </>
        )}
        renderDescription={() => (
          <span>
            {invoice!.customerFirstName} {invoice!.customerLastName}
            {invoice!.jobId && " · From Job"}
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

      <ConfirmActionDialog
        title="Void Invoice"
        description={`Are you sure you want to void invoice ${invoice?.invoiceNumber ?? ""}? This action cannot be undone.`}
        open={voidDialogOpen}
        onOpenChange={setVoidDialogOpen}
        onConfirm={confirmVoid}
        confirmLabel="Void Invoice"
        loading={voidMutation.isPending}
      />
    </>
  );
}
