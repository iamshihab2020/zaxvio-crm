"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { InvoiceDetail } from "@/components/dashboard/invoices/invoice-detail-sheet";
import { useInvoice } from "@/hooks/queries";
import { queryKeys } from "@/lib/query-keys";
import { InvoiceDetailHeader } from "@/components/dashboard/invoices/invoice-detail-header";
import { InvoiceInfoPanel } from "@/components/dashboard/invoices/invoice-info-panel";
import { InvoiceTabsPanel } from "@/components/dashboard/invoices/invoice-tabs-panel";
import { InvoiceSidebarPanel } from "@/components/dashboard/invoices/invoice-sidebar-panel";
import { useViewPreference } from "@/hooks/use-view-preference";
import { ViewModeToggle } from "@/components/reusable/view-mode-toggle";

interface InvoiceDetailClientProps {
  invoice: InvoiceDetail;
}

/**
 * INV-17: this kept its invoice in `useState` and refetched by hand, so the
 * TanStack Query migration never reached it and a mutation made from here could
 * not invalidate the invoices list. It reads through `useInvoice` now, seeded by
 * the server render. Same fix as JOB-40.
 */
export function InvoiceDetailClient({
  invoice: initialInvoice,
}: InvoiceDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mode: viewMode, setMode: setViewMode, mounted: viewMounted } = useViewPreference("invoices");

  const invoiceQuery = useInvoice(initialInvoice.id);
  // The server already rendered this invoice; fall back to it until the query
  // resolves so there is never a blank frame on first paint.
  const invoice = (invoiceQuery.data?.data as InvoiceDetail | undefined) ?? initialInvoice;

  // INV-18: these were two effects racing on the same value. On mount with a
  // stored preference of "sidebar", the first set it to "page" while the second
  // read the still-stale "sidebar" and pushed straight back to /invoices — so
  // any deep link into an invoice bounced to the list. Landing on this route
  // *is* the preference; only a later, deliberate change should navigate.
  const adoptedPageMode = useRef(false);
  useEffect(() => {
    if (!viewMounted || adoptedPageMode.current) return;
    adoptedPageMode.current = true;
    if (viewMode !== "page") setViewMode("page");
  }, [viewMounted]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewMounted || !adoptedPageMode.current) return;
    if (viewMode === "page") return;
    router.push(`/invoices?invoiceId=${invoice.id}`);
  }, [viewMode, viewMounted, router, invoice.id]);

  const refreshInvoice = useCallback(async () => {
    const res = await invoiceQuery.refetch();
    const result = res.data;
    if (result?.data) {
      // Keep the list and the stat cards in step with an edit made here.
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      return;
    }
    // Was `if (res.data) setInvoice(...)` with no else, so a failed refresh
    // after a save left the old values on screen looking saved.
    if (result?.status === 404) {
      toast.error("This invoice no longer exists.");
      router.push("/invoices");
      return;
    }
    toast.error(result?.error ?? "Couldn't refresh this invoice");
  }, [invoiceQuery, queryClient, router]);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <InvoiceDetailHeader invoice={invoice} onUpdate={refreshInvoice}>
        {viewMounted && (
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        )}
      </InvoiceDetailHeader>
      <div className="flex-1 p-4 sm:p-6">
        {/* One column on a phone; the 320px info panel beside the tabs from `lg`;
            the 288px sidebar as a third column from `xl`. Between those the
            sidebar is not dropped but runs under both as a full-width card —
            it holds the customer's phone and address, the linked job and the
            notes, and nothing else on this page shows them. */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
          {/* Left Panel */}
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <InvoiceInfoPanel invoice={invoice} />
          </div>
          {/* Center Panel */}
          <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
            <InvoiceTabsPanel invoice={invoice} onUpdate={refreshInvoice} />
          </div>
          {/* Right Sidebar */}
          <div className="rounded-lg border border-border bg-card shadow-sm lg:col-span-2 xl:col-span-1">
            <InvoiceSidebarPanel invoice={invoice} />
          </div>
        </div>
      </div>
    </div>
  );
}
