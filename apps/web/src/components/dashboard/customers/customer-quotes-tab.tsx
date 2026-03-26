"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { IconFileText } from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteStatusBadge } from "@/components/dashboard/quotes/quote-status-badge";
import { getQuotes } from "@/actions/quotes";

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

function formatDate(val: string | null) {
  if (!val) return "\u2014";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CustomerQuotesTab({ customerId }: CustomerQuotesTabProps) {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    getQuotes({ customerId, limit: 50 }).then((res) => {
      if (res.data) {
        setQuotes(res.data as QuoteRow[]);
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
  );
}
