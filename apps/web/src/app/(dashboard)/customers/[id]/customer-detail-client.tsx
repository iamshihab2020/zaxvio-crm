"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Customer } from "@hvac-saas/types";
import { queryKeys } from "@/lib/query-keys";
import { toCreateQuotePayload } from "@/lib/quote-payload";
import { useCustomer } from "@/hooks/queries";
import { CustomerDetailHeader } from "@/components/dashboard/customers/customer-detail-header";
import { CustomerTabsPanel } from "@/components/dashboard/customers/customer-tabs-panel";
import {
  JobCreateDialog,
  type JobFormData,
} from "@/components/dashboard/jobs/job-create-dialog";
import { InvoiceCreateDialog } from "@/components/dashboard/invoices/invoice-create-dialog";
import {
  QuoteCreateDialog,
  type QuoteFormData,
} from "@/components/dashboard/quotes/quote-create-dialog";
import { createJob } from "@/actions/jobs";
import { createInvoice } from "@/actions/invoices";
import { createQuote } from "@/actions/quotes";
import { getTenant } from "@/actions/tenants";

interface CustomerDetailClientProps {
  customer: Customer;
  defaultTaxRate?: string;
}

export function CustomerDetailClient({
  customer: initialCustomer,
  defaultTaxRate: prefetchedTaxRate,
}: CustomerDetailClientProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Seed the server-rendered customer into the same key the list page's hover
  // prefetch writes to, then read it back through the query. Before this the
  // detail page held the customer in `useState` and never refetched, so an edit
  // made anywhere else left this screen stale — and the prefetch fed a cache key
  // with no reader at all (CUST-14, CUST-22).
  const seeded = useRef(false);
  if (!seeded.current) {
    seeded.current = true;
    queryClient.setQueryData(
      queryKeys.customers.detail(initialCustomer.id),
      { data: initialCustomer, error: null },
      { updatedAt: Date.now() },
    );
  }

  const customerQuery = useCustomer(initialCustomer.id);
  const customer: Customer = (customerQuery.data?.data as Customer) ?? initialCustomer;

  // Dialog state
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState<string | undefined>(prefetchedTaxRate);

  const defaultCustomer = {
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
  };

  /**
   * Refresh everything hanging off this customer.
   *
   * Replaces an `activityKey` counter that was threaded through the tabs panel to
   * force a remount. Invalidating the detail key refreshes the summary, the
   * activity feed and every related list without throwing their state away.
   */
  const refreshCustomer = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.customers.detail(customer.id) });
  }, [queryClient, customer.id]);

  const handleCustomerUpdate = useCallback(
    (updated: Customer) => {
      queryClient.setQueryData(queryKeys.customers.detail(updated.id), {
        data: updated,
        error: null,
      });
      refreshCustomer();
    },
    [queryClient, refreshCustomer],
  );

  async function ensureTaxRate() {
    if (defaultTaxRate !== undefined) return;
    const res = await getTenant();
    if (res.data) {
      setDefaultTaxRate((res.data as { defaultTaxRate?: string }).defaultTaxRate ?? "0");
    }
  }

  async function handleOpenJobDialog() {
    await ensureTaxRate();
    setJobDialogOpen(true);
  }

  async function handleOpenQuoteDialog() {
    await ensureTaxRate();
    setQuoteDialogOpen(true);
  }

  async function handleOpenInvoiceDialog() {
    await ensureTaxRate();
    setInvoiceDialogOpen(true);
  }

  // All three of these used to do nothing at all on failure — the dialog stayed
  // open, the button stopped spinning, and no message was shown (CUST-10).
  async function handleCreateJob(data: JobFormData) {
    setSaving(true);
    const res = await createJob(data);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Could not create the job");
      return;
    }
    setJobDialogOpen(false);
    refreshCustomer();
    router.push(`/jobs/${res.data.id}`);
  }

  async function handleCreateInvoice(data: {
    customerId: string;
    taxRate: string;
    discountAmount: string;
    notes: string;
  }) {
    setSaving(true);
    const res = await createInvoice(data);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Could not create the invoice");
      return;
    }
    setInvoiceDialogOpen(false);
    refreshCustomer();
    router.push(`/invoices/${res.data.id}`);
  }

  async function handleCreateQuote(data: QuoteFormData) {
    setSaving(true);
    const res = await createQuote(toCreateQuotePayload(data));
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error ?? "Could not create the quote");
      return;
    }
    setQuoteDialogOpen(false);
    refreshCustomer();
    router.push(`/quotes/${res.data.id}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      <CustomerDetailHeader
        customer={customer}
        onUpdate={handleCustomerUpdate}
        onNewJob={handleOpenJobDialog}
        onNewQuote={handleOpenQuoteDialog}
        onNewInvoice={handleOpenInvoiceDialog}
      />
      <div className="flex-1 p-4 sm:p-6">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
          <CustomerTabsPanel customerId={customer.id} />
        </div>
      </div>

      {/* Create dialogs — opened from header quick actions */}
      <JobCreateDialog
        open={jobDialogOpen}
        onOpenChange={setJobDialogOpen}
        onSave={handleCreateJob}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
        defaultCustomer={defaultCustomer}
      />
      <InvoiceCreateDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        onSave={handleCreateInvoice}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
        defaultCustomer={defaultCustomer}
      />
      <QuoteCreateDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        onSave={handleCreateQuote}
        loading={saving}
        defaultTaxRate={defaultTaxRate}
        defaultCustomer={defaultCustomer}
      />
    </div>
  );
}
