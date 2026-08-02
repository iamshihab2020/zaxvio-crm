"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Pagination } from "@/components/reusable/pagination";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { QuoteStatusBadge } from "@/components/dashboard/quotes/quote-status-badge";
import { getQuotes } from "@/actions/quotes";
// ARC-12: issuedDate/expiryDate are `date` columns; `new Date(col)` is UTC
// midnight and rendered the previous day west of UTC.
import { formatDateOnly as formatDate } from "@/lib/format";

interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  issuedDate: string;
  expiryDate: string | null;
  totalAmount: string;
}

interface CustomerQuotesTabProps {
  customerId: string;
}

function formatCurrency(val: string) {
  return `$${parseFloat(val).toFixed(2)}`;
}


const PAGE_SIZE = 20;

export function CustomerQuotesTab({ customerId }: CustomerQuotesTabProps) {
  const [page, setPage] = useState(1);
  const router = useRouter();

  // Was a hard `limit: 50` with no pagination and no sign that anything had
  // been cut off (CUST-15), fetched through a raw useEffect (CUST-22).
  const quotesQuery = useQuery({
    queryKey: queryKeys.customers.related(customerId, "quotes", { page }),
    queryFn: () => getQuotes({ customerId, page, limit: PAGE_SIZE }),
    enabled: !!customerId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const quotes: QuoteRow[] = (quotesQuery.data?.data as QuoteRow[]) ?? [];
  const pagination = quotesQuery.data?.pagination;
  const loading = quotesQuery.isLoading;
  const loadFailed = quotesQuery.isError || !!quotesQuery.data?.error;

  if (loadFailed && !loading) {
    return (
      <LoadErrorState
        title="Could not load quotes"
        message={quotesQuery.data?.error}
        onRetry={() => quotesQuery.refetch()}
        isRetrying={quotesQuery.isFetching}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (quotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
          <IconFileText className="h-5 w-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground font-body">
          No quotes yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Quotes for this customer will appear here
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Quote #
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Status
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Date
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Expiry
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr
              key={q.id}
              className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer"
              onClick={() => router.push(`/quotes/${q.id}`)}
            >
              <td className="px-3 py-2 font-medium font-body">
                {q.quoteNumber}
              </td>
              <td className="px-3 py-2">
                <QuoteStatusBadge status={q.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground font-body">
                {formatDate(q.issuedDate)}
              </td>
              <td className="px-3 py-2 text-muted-foreground font-body">
                {formatDate(q.expiryDate)}
              </td>
              <td className="px-3 py-2 text-right font-medium font-body">
                {formatCurrency(q.totalAmount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          entityName="quote"
        />
      )}
    </>
  );
}
