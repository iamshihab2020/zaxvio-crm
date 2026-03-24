"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
  const [activeTab, setActiveTab] = useState("details");
  const [sendLoading, setSendLoading] = useState(false);

  useEffect(() => {
    if (!invoiceId || !open) {
      setInvoice(null);
      return;
    }
    setLoading(true);
    setActiveTab("details");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{ maxWidth: 520, width: "100%" }}
      >
        {loading && (
          <>
            <SheetTitle className="sr-only">Invoice details</SheetTitle>
            <SheetDescription className="sr-only">
              Loading invoice information
            </SheetDescription>
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
              <div className="space-y-3 pt-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </>
        )}

        {!loading && invoice && (
          <>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-border">
              <div className="flex items-start justify-between pr-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <SheetTitle className="font-heading text-lg">
                      {invoice.invoiceNumber}
                    </SheetTitle>
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <SheetDescription className="text-sm font-body">
                    {invoice.customerFirstName} {invoice.customerLastName}
                    {invoice.jobId && " · From Job"}
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex-1"
            >
              <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-6 pt-2">
                <TabsTrigger
                  value="details"
                  className="cursor-pointer"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="line-items"
                  className="cursor-pointer"
                >
                  Line Items ({invoice.lineItems.length})
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="cursor-pointer"
                >
                  Payments ({invoice.payments.length})
                </TabsTrigger>
              </TabsList>

              <div className="px-6 py-4">
                <TabsContent value="details" className="mt-0">
                  <InvoiceDetailTab
                    invoice={invoice}
                    onSend={handleSend}
                    onDownloadPdf={handleDownloadPdf}
                    onVoid={handleVoid}
                    sendLoading={sendLoading}
                  />
                </TabsContent>
                <TabsContent value="line-items" className="mt-0">
                  <InvoiceLineItemsTab
                    invoiceId={invoice.id}
                    lineItems={invoice.lineItems}
                    isDraft={invoice.status === "draft"}
                    onUpdate={() => {
                      refreshDetail();
                      onDataChange();
                    }}
                  />
                </TabsContent>
                <TabsContent value="payments" className="mt-0">
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
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
