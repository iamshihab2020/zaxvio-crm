"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

function formatCurrency(val: string | null) {
  return `$${parseFloat(val ?? "0").toFixed(2)}`;
}

function formatDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InvoiceTable({ invoices, onRowClick }: InvoiceTableProps) {
  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
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
            >
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
                      ? "text-amber-600 font-medium"
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
