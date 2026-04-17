"use client";

import { IconFileInvoice } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { DashboardAgingBucket } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";

interface InvoiceAgingProps {
  data: DashboardAgingBucket[];
}

const BUCKET_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  current: { label: "Current", color: "#22c55e" },
  "30": { label: "1-30 days", color: "#fbbf24" },
  "60": { label: "31-60 days", color: "hsl(var(--brand))" },
  "90plus": { label: "60+ days", color: "#ef4444" },
};

const BUCKET_ORDER = ["current", "30", "60", "90plus"] as const;

export function InvoiceAging({ data }: InvoiceAgingProps) {
  const totalAmount = data.reduce((sum, b) => sum + b.amount, 0);
  const totalCount = data.reduce((sum, b) => sum + b.count, 0);

  const bucketMap = new Map(data.map((b) => [b.bucket, b]));
  const rows = BUCKET_ORDER.map((key) => ({
    key,
    config: BUCKET_CONFIG[key]!,
    count: bucketMap.get(key)?.count ?? 0,
    amount: bucketMap.get(key)?.amount ?? 0,
  }));

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          Invoice Aging
        </h3>
        {totalCount > 0 && (
          <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
            {totalCount} invoices · {formatCurrency(totalAmount)}
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <div className="mt-4 flex-1 rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <IconFileInvoice className="h-5 w-5 text-brand" />
          </div>
          <p className="mt-3 font-heading text-sm font-semibold text-foreground">
            No outstanding invoices
          </p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            All paid up. Fresh invoices will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Stacked bar */}
          <div
            className={cn(
              "flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/50",
            )}
          >
            {rows.map(
              (row) =>
                row.amount > 0 && (
                  <div
                    key={row.key}
                    className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                    style={{
                      width: `${(row.amount / totalAmount) * 100}%`,
                      backgroundColor: row.config.color,
                    }}
                    title={`${row.config.label}: ${formatCurrency(row.amount)}`}
                  />
                ),
            )}
          </div>

          {/* Bucket grid */}
          <ul className="grid grid-cols-2 gap-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="rounded-xl border border-border bg-background/40 p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.config.color }}
                  />
                  <span className="truncate text-[11px] font-body text-muted-foreground">
                    {row.config.label}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="font-heading text-lg font-semibold text-foreground">
                    {formatCurrency(row.amount)}
                  </span>
                  <span className="text-[11px] font-body text-muted-foreground">
                    {row.count} {row.count === 1 ? "invoice" : "invoices"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
