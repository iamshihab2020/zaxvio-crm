import type { Metadata } from "next";
import { getInvoices, getInvoiceStats } from "@/actions/invoices";
import { getTenant } from "@/actions/tenants";
import { InvoicesPageClient } from "./invoices-page-client";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage invoices and track payments",
};

/** Must match `PAGE_SIZE` in the client, or the seed is for a different key. */
const PAGE_SIZE = 20;

export default async function InvoicesPage() {
  const [invoicesResult, tenantResult, statsResult] = await Promise.all([
    getInvoices({ page: 1, limit: PAGE_SIZE, sortBy: "createdAt", sortOrder: "desc" }),
    getTenant(),
    getInvoiceStats(),
  ]);

  return (
    <InvoicesPageClient
      // INV-15: these three were fetched, passed, destructured — and referenced
      // nowhere, so every load paid for the data twice and still showed a
      // skeleton. The client seeds them into the query cache now, with an
      // honest timestamp so the seed ages. Also drops three `as never` casts.
      initialInvoices={invoicesResult.data ?? []}
      initialPagination={invoicesResult.pagination}
      defaultTaxRate={tenantResult.data?.defaultTaxRate ?? "0"}
      initialStats={statsResult.data ?? undefined}
      initialFetchedAt={Date.now()}
    />
  );
}
