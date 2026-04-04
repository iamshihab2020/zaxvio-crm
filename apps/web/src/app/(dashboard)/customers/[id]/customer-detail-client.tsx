"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Customer } from "@hvac-saas/types";
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
  const [customer, setCustomer] = useState(initialCustomer);
  const [activityKey, setActivityKey] = useState(0);

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

  const handleCustomerUpdate = useCallback((updated: Customer) => {
    setCustomer(updated);
    setActivityKey((k) => k + 1);
  }, []);

  // Fetch tenant tax rate when opening any dialog
  async function ensureTaxRate() {
    if (defaultTaxRate !== undefined) return;
    const res = await getTenant();
    if (res.data) {
      setDefaultTaxRate(
        (res.data as { defaultTaxRate?: string }).defaultTaxRate ?? "0",
      );
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

  async function handleCreateJob(data: JobFormData) {
    setSaving(true);
    const res = await createJob(data);
    if (res.data) {
      setJobDialogOpen(false);
      setActivityKey((k) => k + 1);
      router.push(`/jobs/${res.data.id}`);
    }
    setSaving(false);
  }

  async function handleCreateInvoice(data: { customerId: string; taxRate: string; discountAmount: string; notes: string }) {
    setSaving(true);
    const res = await createInvoice(data);
    if (res.data) {
      setInvoiceDialogOpen(false);
      router.push(`/invoices/${res.data.id}`);
    }
    setSaving(false);
  }

  async function handleCreateQuote(data: QuoteFormData) {
    setSaving(true);
    const res = await createQuote(data);
    if (res.data) {
      setQuoteDialogOpen(false);
      router.push(`/quotes/${res.data.id}`);
    }
    setSaving(false);
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      <CustomerDetailHeader
        customer={customer}
        onUpdate={handleCustomerUpdate}
        onNewJob={handleOpenJobDialog}
        onNewQuote={handleOpenQuoteDialog}
        onNewInvoice={handleOpenInvoiceDialog}
      />
      <div className="flex-1 p-4 sm:p-6">
        <div className="rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
          <CustomerTabsPanel customerId={customer.id} activityKey={activityKey} />
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
