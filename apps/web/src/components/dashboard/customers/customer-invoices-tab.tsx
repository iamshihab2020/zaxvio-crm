"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconFileInvoice } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/dashboard/invoices/invoice-status-badge";
import { getInvoices } from "@/actions/invoices";

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

function formatDate(val: string) {
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CustomerInvoicesTab({ customerId }: CustomerInvoicesTabProps) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    getInvoices({ customerId, limit: 50 }).then((res) => {
      if (res.data) {
        setInvoices(res.data as InvoiceRow[]);
      }
      setLoading(false);
    });
  }, [customerId]);

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
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
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
    <div className="rounded-md border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Invoice #
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Status
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground font-body">
              Date
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body">
              Total
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground font-body">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer"
              onClick={() => router.push(`/invoices?invoiceId=${inv.id}`)}
            >
              <td className="px-3 py-2 font-medium font-body">
                {inv.invoiceNumber}
              </td>
              <td className="px-3 py-2">
                <InvoiceStatusBadge status={inv.status} />
              </td>
              <td className="px-3 py-2 text-muted-foreground font-body">
                {formatDate(inv.issuedDate)}
              </td>
              <td className="px-3 py-2 text-right font-medium font-body">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
