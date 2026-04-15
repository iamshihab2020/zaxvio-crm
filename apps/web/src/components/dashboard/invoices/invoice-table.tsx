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
import { getInvoice } from "@/actions/invoices";
import { Checkbox } from "@/components/ui/checkbox";
import { InvoiceStatusBadge } from "./invoice-status-badge";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedDate: string;
  dueDate: string | null;
  totalAmount: string;
  balanceDue: string;
  customerFirstName: string | null;
  customerLastName: string | null;
}

interface InvoiceTableProps {
  invoices: InvoiceRow[];
  onRowClick: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}

function formatCurrency(val: string | null) {
  const num = parseFloat(val ?? "0");
  if (num < 0) return `\u2212$${Math.abs(num).toFixed(2)}`;
  return `$${num.toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceTable({
  invoices,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isIndeterminate,
}: InvoiceTableProps) {
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
            <TableHead className="font-body">Invoice #</TableHead>
            <TableHead className="font-body">Customer</TableHead>
            <TableHead className="font-body">Status</TableHead>
            <TableHead className="font-body">Issued</TableHead>
            <TableHead className="font-body">Due</TableHead>
            <TableHead className="font-body text-right">Total</TableHead>
            <TableHead className="font-body text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => (
            <TableRow
              key={inv.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onRowClick(inv.id)}
              onMouseEnter={() => {
                queryClient.prefetchQuery({
                  queryKey: queryKeys.invoices.detail(inv.id),
                  queryFn: () => getInvoice(inv.id),
                  staleTime: 30_000,
                });
              }}
            >
              {hasSelection && (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(inv.id)}
                    onCheckedChange={() => onToggleSelect(inv.id)}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium font-body">
                {inv.invoiceNumber}
              </TableCell>
              <TableCell className="font-body">
                {inv.customerFirstName} {inv.customerLastName}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={inv.status} />
              </TableCell>
              <TableCell className="text-muted-foreground font-body">
                {formatDate(inv.issuedDate)}
              </TableCell>
              <TableCell className="text-muted-foreground font-body">
                {formatDate(inv.dueDate)}
              </TableCell>
              <TableCell className="text-right font-medium font-body">
                {formatCurrency(inv.totalAmount)}
              </TableCell>
              <TableCell className="text-right font-body">
                <span
                  className={
                    parseFloat(inv.balanceDue) > 0
                      ? "text-amber-600 dark:text-amber-400 font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {formatCurrency(inv.balanceDue)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
