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
import { IconArrowUp, IconArrowDown, IconArrowsSort } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatMoney, formatDateOnly } from "@/lib/format";
import { InvoiceStatusBadge } from "./invoice-status-badge";

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedDate: string;
  dueDate: string | null;
  totalAmount: string;
  amountPaid?: string;
  balanceDue: string;
  customerFirstName: string | null;
  customerLastName: string | null;
}

/** The `sortBy` values `invoiceListQuery` accepts. */
export type InvoiceSortKey =
  | "createdAt"
  | "issuedDate"
  | "dueDate"
  | "invoiceNumber"
  | "status"
  | "totalAmount"
  | "balanceDue";

interface InvoiceTableProps {
  invoices: InvoiceRow[];
  onRowClick: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  sortBy?: InvoiceSortKey;
  sortOrder?: "asc" | "desc";
  onSortChange?: (key: InvoiceSortKey) => void;
}

const COLUMNS: Array<{
  key: InvoiceSortKey | null;
  label: string;
  align?: "right";
}> = [
  { key: "invoiceNumber", label: "Invoice #" },
  { key: null, label: "Customer" },
  { key: "status", label: "Status" },
  { key: "issuedDate", label: "Issued" },
  { key: "dueDate", label: "Due" },
  { key: "totalAmount", label: "Total", align: "right" },
  { key: "balanceDue", label: "Balance", align: "right" },
];

export function InvoiceTable({
  invoices,
  onRowClick,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  isIndeterminate,
  sortBy,
  sortOrder = "desc",
  onSortChange,
}: InvoiceTableProps) {
  const queryClient = useQueryClient();
  const hasSelection = !!selectedIds && !!onToggleSelect;
  const sortable = !!onSortChange;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {hasSelection && (
              <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isAllSelected ? true : isIndeterminate ? "indeterminate" : false}
                  onCheckedChange={() => onToggleSelectAll?.()}
                  aria-label="Select all invoices on this page"
                />
              </TableHead>
            )}
            {COLUMNS.map((col) => {
              const isActive = sortable && col.key !== null && sortBy === col.key;
              return (
                <TableHead
                  key={col.label}
                  className={cn("font-body", col.align === "right" && "text-right")}
                  // INV-35: no `aria-sort` anywhere, so a screen reader could not
                  // tell which column ordered the table.
                  aria-sort={
                    isActive
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                >
                  {sortable && col.key !== null ? (
                    // INV-36: the API accepted 7 `sortBy` values and the client
                    // hardcoded createdAt/desc, so none of them were reachable.
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key!)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        col.align === "right" && "flex-row-reverse",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {col.label}
                      {isActive ? (
                        sortOrder === "asc" ? (
                          <IconArrowUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <IconArrowDown className="h-3 w-3" aria-hidden />
                        )
                      ) : (
                        <IconArrowsSort className="h-3 w-3 opacity-40" aria-hidden />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((inv) => {
            const total = parseFloat(inv.totalAmount ?? "0");
            const paid = parseFloat(inv.amountPaid ?? "0");
            const balance = parseFloat(inv.balanceDue ?? "0");
            // §4.6: the Balance column showed a number but nothing conveyed
            // "$400 of $1,200 paid", which is the whole story on a partial.
            const showProgress = paid > 0 && balance > 0 && total > 0;
            const pctPaid = showProgress ? Math.min(100, (paid / total) * 100) : 0;

            return (
              <TableRow
                key={inv.id}
                // INV-35: rows were `onClick`-only — not focusable, no keyboard
                // activation. The customers audit made rows keyboard-reachable
                // and it never propagated here.
                role="button"
                tabIndex={0}
                aria-label={`Invoice ${inv.invoiceNumber}`}
                className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onRowClick(inv.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick(inv.id);
                  }
                }}
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
                      aria-label={`Select invoice ${inv.invoiceNumber}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium font-body">
                  {inv.invoiceNumber}
                </TableCell>
                <TableCell className="font-body">
                  {[inv.customerFirstName, inv.customerLastName]
                    .filter(Boolean)
                    .join(" ") || "—"}
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-muted-foreground font-body">
                  {formatDateOnly(inv.issuedDate)}
                </TableCell>
                <TableCell className="text-muted-foreground font-body">
                  {formatDateOnly(inv.dueDate)}
                </TableCell>
                <TableCell className="text-right font-medium font-body">
                  {formatMoney(inv.totalAmount)}
                </TableCell>
                <TableCell className="text-right font-body">
                  <span
                    className={
                      balance > 0
                        ? "text-amber-600 dark:text-amber-400 font-medium"
                        : "text-muted-foreground"
                    }
                  >
                    {formatMoney(inv.balanceDue)}
                  </span>
                  {showProgress && (
                    <span className="mt-1 block">
                      <span
                        className="ml-auto block h-1 w-20 overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={`${formatMoney(paid)} of ${formatMoney(total)} paid`}
                      >
                        <span
                          className="block h-full rounded-full bg-green-500"
                          style={{ width: `${pctPaid}%` }}
                        />
                      </span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {formatMoney(paid)} paid
                      </span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
