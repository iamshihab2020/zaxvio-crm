"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getQuote } from "@/lib/client-reads/quotes";
import { Checkbox } from "@/components/ui/checkbox";
// QUO-10: `new Date("2026-08-01")` is UTC midnight, so these printed the
// previous day for every US tenant while the customer portal — which anchors
// at local midnight — printed the right one. `formatDateOnly` is the shared
// fix invoices has used since INV-19.
import { formatMoney as formatCurrency, formatDateOnly as formatDate } from "@/lib/format";
import { QuoteStatusBadge } from "./quote-status-badge";

export interface QuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  issuedDate: string;
  expiryDate: string | null;
  totalAmount: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  convertedToJobId: string | null;
}

interface QuoteTableProps {
  quotes: QuoteRow[];
  onRowClick: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}

export function QuoteTable({
  quotes,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isIndeterminate,
}: QuoteTableProps) {
  const queryClient = useQueryClient();
  const hasSelection = !!selectedIds && !!onToggleSelect;

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {hasSelection && (
              <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                  onCheckedChange={() => onToggleSelectAll?.()}
                />
              </TableHead>
            )}
            {/* On a phone: the quote number (customer and status folded under
                it) and the total. The rest arrive as the screen widens. */}
            <TableHead className="font-body">Quote #</TableHead>
            <TableHead className="hidden font-body md:table-cell">Customer</TableHead>
            <TableHead className="hidden font-body md:table-cell">Status</TableHead>
            <TableHead className="hidden font-body lg:table-cell">Created</TableHead>
            <TableHead className="hidden font-body md:table-cell">Expiry</TableHead>
            <TableHead className="font-body text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow
              key={q.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(q.id)}
              onMouseEnter={() => {
                queryClient.prefetchQuery({
                  queryKey: queryKeys.quotes.detail(q.id),
                  queryFn: () => getQuote(q.id),
                  staleTime: 30_000,
                });
              }}
            >
              {hasSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(q.id)}
                    onCheckedChange={() => onToggleSelect(q.id)}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium font-body">
                {q.quoteNumber}
                {/* Customer and status fold under the number where their
                    columns are hidden. The name is capped because a nowrap
                    line in an auto-layout cell would widen the column. */}
                <div className="mt-0.5 max-w-[8rem] truncate text-xs font-normal text-muted-foreground md:hidden">
                  {q.customerFirstName} {q.customerLastName}
                </div>
                <div className="mt-1 md:hidden">
                  <QuoteStatusBadge status={q.status} />
                </div>
              </TableCell>
              <TableCell className="hidden font-body md:table-cell">
                {q.customerFirstName} {q.customerLastName}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <QuoteStatusBadge status={q.status} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground font-body lg:table-cell">
                {formatDate(q.issuedDate)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground font-body md:table-cell">
                {formatDate(q.expiryDate)}
              </TableCell>
              <TableCell className="text-right font-medium font-body">
                {formatCurrency(q.totalAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
