"use client";

import { IconFileInvoice } from "@tabler/icons-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardAgingBucket } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";

interface InvoiceAgingProps {
  data: DashboardAgingBucket[];
}

const BUCKET_CONFIG: Record<
  string,
  { label: string; bar: string; text: string; dot: string }
> = {
  current: {
    label: "Current",
    bar: "bg-green-500 dark:bg-green-400",
    text: "text-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  "30": {
    label: "1-30 days",
    bar: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  "60": {
    label: "31-60 days",
    bar: "bg-orange-500 dark:bg-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  "90plus": {
    label: "60+ days",
    bar: "bg-red-500 dark:bg-red-400",
    text: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
};

const BUCKET_ORDER = ["current", "30", "60", "90plus"] as const;

export function InvoiceAging({ data }: InvoiceAgingProps) {
  const totalAmount = data.reduce((sum, b) => sum + b.amount, 0);
  const totalCount = data.reduce((sum, b) => sum + b.count, 0);

  // Build a map for quick lookup
  const bucketMap = new Map(data.map((b) => [b.bucket, b]));

  // Build ordered rows with all buckets (show 0 for missing)
  const rows = BUCKET_ORDER.map((key) => ({
    key,
    config: BUCKET_CONFIG[key],
    count: bucketMap.get(key)?.count ?? 0,
    amount: bucketMap.get(key)?.amount ?? 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="font-heading text-base font-semibold">
          Invoice Aging
        </CardTitle>
        {totalCount > 0 && (
          <p className="text-xs text-muted-foreground font-body">
            {totalCount} invoices &middot; {formatCurrency(totalAmount)} outstanding
          </p>
        )}
      </CardHeader>
      <CardContent>
        {totalCount === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <div className="text-center">
              <IconFileInvoice className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-1.5 text-xs text-muted-foreground font-body">
                No outstanding invoices
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {rows.map(
                (row) =>
                  row.amount > 0 && (
                    <div
                      key={row.key}
                      className={cn("h-full transition-all", row.config.bar)}
                      style={{
                        width: `${(row.amount / totalAmount) * 100}%`,
                      }}
                    />
                  ),
              )}
            </div>

            {/* Legend rows */}
            <div className="space-y-1.5">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between text-xs font-body"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        row.config.dot,
                      )}
                    />
                    <span className="text-muted-foreground">
                      {row.config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{row.count}</span>
                    <span className="font-medium text-foreground w-16 text-right">
                      {formatCurrency(row.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
