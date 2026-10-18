"use client";

import Link from "next/link";
import { IconFileInvoice } from "@tabler/icons-react";
import { Card } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { cn } from "@/lib/utils";
import type { DashboardAgingBucket } from "@hvac-saas/types";
import { formatCurrency } from "@/lib/format";
import { staggerDelay } from "@/lib/motion";
import { OVERDUE_COLORS, STATUS_COLORS } from "@/lib/constants/chart-palette";
import { enterDelay } from "./chart-motion";
import { WidgetHeader } from "./widget-header";
import { WidgetWindowBadge } from "./widget-window-badge";

interface InvoiceAgingProps {
  data: DashboardAgingBucket[];
}

type BucketKey = DashboardAgingBucket["bucket"];

/**
 * Standard AR aging. `"90"` is 61-90 days and `"90plus"` is over 90 — the backend
 * previously had no 61-90 bucket, so a 61-day-old invoice was reported under a key
 * called `90plus`.
 *
 * Colour is an ordinal scale, not five unrelated hues. Current is good; every
 * overdue bucket is the same red, darker the older the debt, so the order reads
 * from the colour alone. The old scale ran green → amber → brand orange → orange
 * → red, which spent the brand on "31–60 days overdue" and made 31–60 and 61–90
 * near-identical oranges.
 */
const BUCKET_CONFIG: Record<BucketKey, { label: string; color: string }> = {
  current: { label: "Current", color: STATUS_COLORS.good },
  "30": { label: "1–30 days", color: OVERDUE_COLORS[0] },
  "60": { label: "31–60 days", color: OVERDUE_COLORS[1] },
  "90": { label: "61–90 days", color: OVERDUE_COLORS[2] },
  "90plus": { label: "90+ days", color: OVERDUE_COLORS[3] },
};

const BUCKET_ORDER: BucketKey[] = ["current", "30", "60", "90", "90plus"];

/** The share bars draw in one after another, once the card has landed. */
const BAR_DELAY_BASE = 160;
const BAR_STEP = 50;

export function InvoiceAging({ data }: InvoiceAgingProps) {
  const totalAmount = data.reduce((sum, b) => sum + b.amount, 0);
  const totalCount = data.reduce((sum, b) => sum + b.count, 0);

  const bucketMap = new Map(data.map((b) => [b.bucket, b]));
  const rows = BUCKET_ORDER.map((key) => ({
    key,
    config: BUCKET_CONFIG[key],
    count: bucketMap.get(key)?.count ?? 0,
    amount: bucketMap.get(key)?.amount ?? 0,
  }));

  return (
    <Card data-widget="invoiceAging" className="flex h-full flex-col p-4 sm:p-6">
      <WidgetHeader
        title="Invoice Aging"
        badge={<WidgetWindowBadge label="All open" />}
        action={
          totalCount > 0 && (
            <span className="whitespace-nowrap text-xs font-body text-muted-foreground">
              <AnimatedNumber
                value={totalCount}
                format={String}
                className="font-mono"
              />{" "}
              invoices ·{" "}
              <AnimatedNumber
                value={totalAmount}
                format={formatCurrency}
                className="font-mono"
              />
            </span>
          )
        }
      />

      {totalCount === 0 ? (
        <div className="motion-appear mt-4 flex-1 rounded-md border border-dashed border-border bg-muted/10 p-4 text-center sm:p-6">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <IconFileInvoice className="h-5 w-5 text-brand" aria-hidden />
          </div>
          <p className="mt-3 font-heading text-sm font-semibold text-foreground">
            No outstanding invoices
          </p>
          <p className="mt-1 text-xs font-body text-muted-foreground">
            All paid up. Fresh invoices will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex min-h-0 flex-1 flex-col gap-4">
          {/* Stacked bar — decorative; the rows below are the accessible version.
              The track stays put and the segments inside it draw out of the left
              edge as one, so the split reads as a bar being laid down. Widths
              are not tweened when the data changes: animating `width` would
              re-lay-out the row on every frame. */}
          <div
            aria-hidden
            className={cn(
              "h-2 w-full overflow-hidden rounded-full bg-muted/50 ring-1 ring-border/50",
            )}
          >
            <div
              className="motion-grow-x flex h-full w-full gap-0.5"
              style={enterDelay(BAR_DELAY_BASE)}
            >
              {rows.map(
                (row) =>
                  row.amount > 0 && (
                    <div
                      key={row.key}
                      className="h-full first:rounded-l-full last:rounded-r-full"
                      style={{
                        width: `${(row.amount / totalAmount) * 100}%`,
                        backgroundColor: row.config.color,
                      }}
                      title={`${row.config.label}: ${formatCurrency(row.amount)}`}
                    />
                  ),
              )}
            </div>
          </div>

          {/*
            Rows, not a 2-column tile grid. There are five buckets and always
            will be, so a two-wide grid orphans the fifth tile on its own row
            every single time — the layout could never come out even. Rows also
            let each bucket carry its own share bar, so the shape of the debt is
            readable down the column instead of only in the stacked bar above.
          */}
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {rows.map((row, index) => {
              const share = totalAmount > 0 ? row.amount / totalAmount : 0;
              return (
                <li key={row.key}>
                  <Link
                    href={
                      row.key === "current"
                        ? "/invoices?status=sent"
                        : "/invoices?status=overdue"
                    }
                    aria-label={`${row.config.label}: ${formatCurrency(row.amount)} across ${row.count} ${row.count === 1 ? "invoice" : "invoices"}`}
                    className={cn(
                      "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-md px-2 py-2 transition-colors hover:bg-brand/5",
                      row.amount === 0 && "opacity-50",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.config.color }}
                      />
                      <span className="truncate text-sm font-body text-muted-foreground">
                        {row.config.label}
                      </span>
                    </span>

                    <span className="flex shrink-0 items-baseline gap-2">
                      <span className="tnum font-mono text-sm font-medium text-foreground">
                        {formatCurrency(row.amount)}
                      </span>
                      <span className="tnum w-16 text-right font-mono text-[10px] text-muted-foreground">
                        {row.count === 0
                          ? "—"
                          : `${row.count} ${row.count === 1 ? "inv" : "invs"}`}
                      </span>
                    </span>

                    {/* Share of the outstanding total, spanning both columns. The
                        fill is full width and scaled to the share, so it draws in
                        and re-sizes on `transform` alone. */}
                    <span
                      aria-hidden
                      className="col-span-2 h-1 overflow-hidden rounded-full bg-muted/60"
                    >
                      <span
                        className="motion-grow-x block h-full w-full rounded-full motion-safe:transition-transform motion-safe:duration-[var(--dur-focal)] motion-safe:ease-[var(--ease-out)]"
                        style={{
                          ...enterDelay(
                            BAR_DELAY_BASE + staggerDelay(index, BAR_STEP, BUCKET_ORDER.length),
                          ),
                          transform: `scaleX(${share})`,
                          backgroundColor: row.config.color,
                        }}
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
