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
import { getQuote } from "@/actions/quotes";
import { Checkbox } from "@/components/ui/checkbox";
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

function formatCurrency(val: string | null) {
  const num = parseFloat(val ?? "0");
  return `$${num.toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "\u2014";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
            <TableHead className="font-body">Quote #</TableHead>
            <TableHead className="font-body">Customer</TableHead>
            <TableHead className="font-body">Status</TableHead>
            <TableHead className="font-body">Created</TableHead>
            <TableHead className="font-body">Expiry</TableHead>
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
              </TableCell>
              <TableCell className="font-body">
                {q.customerFirstName} {q.customerLastName}
              </TableCell>
              <TableCell>
                <QuoteStatusBadge status={q.status} />
              </TableCell>
              <TableCell className="text-muted-foreground font-body">
                {formatDate(q.issuedDate)}
              </TableCell>
              <TableCell className="text-muted-foreground font-body">
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
