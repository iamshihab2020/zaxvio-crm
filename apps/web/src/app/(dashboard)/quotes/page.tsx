import type { Metadata } from "next";
import { getQuotes, getQuoteStats } from "@/actions/quotes";
import { getTenant } from "@/actions/tenants";
import { QuotesPageClient } from "./quotes-page-client";
import type { QuoteRow } from "@/components/dashboard/quotes/quote-table";

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

  // These are now seeded into the query cache rather than discarded (QUO-14).
  // Typed against the real row shape instead of `as never[]` / `as never`,
  // which strict-rules §4 forbids (QUO-35).
  return (
    <QuotesPageClient
      initialQuotes={(quotesResult.data ?? []) as QuoteRow[]}
      initialPagination={quotesResult.pagination}
      defaultTaxRate={tenantResult.data?.defaultTaxRate ?? "0"}
      initialStats={statsResult.data ?? undefined}
    />
  );
}
