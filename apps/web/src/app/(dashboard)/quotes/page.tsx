import type { Metadata } from "next";
import { getQuotes, getQuoteStats } from "@/actions/quotes";
import { getTenant } from "@/actions/tenants";
import { QuotesPageClient } from "./quotes-page-client";

export const metadata: Metadata = {
  title: "Quotes",
  description: "Manage quotes and estimates",
};

export default async function QuotesPage() {
  const [quotesResult, tenantResult, statsResult] = await Promise.all([
    getQuotes({ page: 1, limit: 15 }),
    getTenant(),
    getQuoteStats(),
  ]);

  return (
    <QuotesPageClient
      initialQuotes={(quotesResult.data ?? []) as never[]}
      initialPagination={quotesResult.pagination as never}
      defaultTaxRate={tenantResult.data?.defaultTaxRate ?? "0"}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
