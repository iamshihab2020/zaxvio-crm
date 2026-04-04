import type { Metadata } from "next";
import { getInvoices, getInvoiceStats } from "@/actions/invoices";
import { getTenant } from "@/actions/tenants";
import { InvoicesPageClient } from "./invoices-page-client";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage invoices and track payments",
};

export default async function InvoicesPage() {
  const [invoicesResult, tenantResult, statsResult] = await Promise.all([
    getInvoices({ page: 1, limit: 15 }),
    getTenant(),
    getInvoiceStats(),
  ]);

  return (
    <InvoicesPageClient
      initialInvoices={(invoicesResult.data ?? []) as never[]}
      initialPagination={invoicesResult.pagination as never}
      defaultTaxRate={tenantResult.data?.defaultTaxRate ?? "0"}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
