"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconFileInvoice } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { Pagination } from "@/components/reusable/pagination";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { InvoiceStatusBadge } from "@/components/dashboard/invoices/invoice-status-badge";
import { getInvoices } from "@/lib/client-reads/invoices";
import { useStagger } from "@/hooks/use-stagger";
// ARC-12: `new Date("2026-08-01")` is UTC midnight, so every negative-offset
// timezone rendered the previous day. These are all `date` columns.
import { formatDateOnly as formatDate } from "@/lib/format";

interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedDate: string;
  totalAmount: string;
  balanceDue: string;
}

interface CustomerInvoicesTabProps {
  customerId: string;
}

function formatCurrency(val: string) {
  return `$${parseFloat(val).toFixed(2)}`;
}


const PAGE_SIZE = 20;

export function CustomerInvoicesTab({ customerId }: CustomerInvoicesTabProps) {
  const [page, setPage] = useState(1);
  const router = useRouter();

  // Was a hard `limit: 50` with no pagination and no sign that anything had
  // been cut off (CUST-15), fetched through a raw useEffect (CUST-22).
  const invoicesQuery = useQuery({
    queryKey: queryKeys.customers.related(customerId, "invoices", { page }),
    queryFn: () => getInvoices({ customerId, page, limit: PAGE_SIZE }),
    enabled: !!customerId,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const invoices: InvoiceRow[] = (invoicesQuery.data?.data as InvoiceRow[]) ?? [];
  const pagination = invoicesQuery.data?.pagination;
  const loading = invoicesQuery.isLoading;
  const loadFailed = invoicesQuery.isError || !!invoicesQuery.data?.error;

  // `placeholderData` keeps the old page on screen while the next one loads, so
  // the key waits for the real rows; animating the placeholder would replay the
  // rows the reader is already looking at.
  const bodyRef = useRef<HTMLTableSectionElement>(null);
  useStagger(bodyRef, loading || loadFailed || invoicesQuery.isPlaceholderData ? null : page);

  if (loadFailed && !loading) {
    return (
      <LoadErrorState
        title="Could not load invoices"
        message={invoicesQuery.data?.error}
        onRetry={() => invoicesQuery.refetch()}
        isRetrying={invoicesQuery.isFetching}
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

  if (invoices.length === 0) {
    return (
      <div className="motion-appear flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
          <IconFileInvoice className="h-5 w-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground font-body">
          No invoices yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Invoices for this customer will appear here
        </p>
      </div>
    );
  }

  return (
    <>
      {/* The rounded card clips; the table scrolls inside it. `overflow-hidden`
          alone cut the right-hand columns off on a phone with no way to reach
          them. Below `sm` the status folds under the invoice number and the
          total under the balance; the date arrives at `md`. */}
      <div className="rounded-md border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
                  Invoice #
                </th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground font-body sm:table-cell">
                  Status
                </th>
                <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground font-body md:table-cell">
                  Date
                </th>
                <th className="hidden px-3 py-2 text-right font-medium text-muted-foreground font-body sm:table-cell">
                  Total
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody ref={bodyRef}>
              {invoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors duration-200"
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                >
                  <td className="px-3 py-2 font-medium font-body">
                    {inv.invoiceNumber}
                    <div className="mt-1 sm:hidden">
                      <InvoiceStatusBadge status={inv.status} />
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="hidden px-3 py-2 text-muted-foreground font-body md:table-cell">
                    {formatDate(inv.issuedDate)}
                  </td>
                  <td className="hidden px-3 py-2 text-right font-medium font-body sm:table-cell">
                    {formatCurrency(inv.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-body">
                    <span
                      className={
                        parseFloat(inv.balanceDue) > 0
                          ? "text-amber-600 dark:text-amber-400 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {formatCurrency(inv.balanceDue)}
                    </span>
                    {/* A paid invoice reads $0.00; the total says what it was. */}
                    <span className="mt-0.5 block text-xs text-muted-foreground sm:hidden">
                      of {formatCurrency(inv.totalAmount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          entityName="invoice"
        />
      )}
    </>
  );
}
