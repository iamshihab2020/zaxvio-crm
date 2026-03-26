"use client";

import { useState, useCallback } from "react";
import type { InvoiceDetail } from "@/components/dashboard/invoices/invoice-detail-sheet";
import { getInvoice } from "@/actions/invoices";
import { InvoiceDetailHeader } from "@/components/dashboard/invoices/invoice-detail-header";
import { InvoiceInfoPanel } from "@/components/dashboard/invoices/invoice-info-panel";
import { InvoiceTabsPanel } from "@/components/dashboard/invoices/invoice-tabs-panel";
import { InvoiceSidebarPanel } from "@/components/dashboard/invoices/invoice-sidebar-panel";

interface InvoiceDetailClientProps {
  invoice: InvoiceDetail;
}

export function InvoiceDetailClient({
  invoice: initialInvoice,
}: InvoiceDetailClientProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail>(initialInvoice);

  const refreshInvoice = useCallback(async () => {
    const res = await getInvoice(invoice.id);
    if (res.data) setInvoice(res.data as InvoiceDetail);
  }, [invoice.id]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <InvoiceDetailHeader invoice={invoice} onUpdate={refreshInvoice} />
      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 lg:items-start">
          {/* Left Panel */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <InvoiceInfoPanel invoice={invoice} />
          </div>
          {/* Center Panel */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <InvoiceTabsPanel invoice={invoice} onUpdate={refreshInvoice} />
          </div>
          {/* Right Sidebar */}
          <div className="hidden xl:block w-72 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <InvoiceSidebarPanel invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
