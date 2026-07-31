"use client";

import Link from "next/link";
import type { DashboardOverdueInvoices } from "@hvac-saas/types";
import { Button } from "@/components/ui/button";
import { formatCurrencyPrecise } from "@/lib/format";

interface OverdueAlertBannerProps {
  overdueInvoices: DashboardOverdueInvoices;
}

/**
 * Money that is late, presented as a figure rather than as a sentence.
 *
 * The previous version was the generic alert pattern: a full-width amber wash,
 * a warning triangle, "You have N overdue invoices totaling $X", and a
 * "View All →". Three things were wrong with it beyond the cliché.
 *
 * The amber fought the brand — this dashboard is orange-accented, so a warm
 * yellow alert reads as a slightly-wrong orange rather than as a distinct
 * signal. The number that actually matters was buried mid-sentence at body
 * size, when it is the single most scannable thing on the page. And "View All"
 * names no object; the reader is going to the overdue invoices, so the control
 * should say so.
 *
 * Now: card surface with one destructive accent rule, the amount leading in
 * tabular figures, and the count as supporting detail.
 */
export function OverdueAlertBanner({ overdueInvoices }: OverdueAlertBannerProps) {
  if (overdueInvoices.count === 0) return null;

  const { count, totalAmount } = overdueInvoices;

  return (
    <div
      role="status"
      className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:gap-5 sm:px-5"
    >
      <span
        aria-hidden
        className="h-10 w-1 shrink-0 rounded-full bg-destructive"
      />

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-destructive">
          Overdue
        </p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className="tnum font-heading text-xl font-semibold text-foreground sm:text-2xl">
            {formatCurrencyPrecise(totalAmount)}
          </span>
          <span className="text-sm font-body text-muted-foreground">
            across {count} {count === 1 ? "invoice" : "invoices"}
          </span>
        </p>
      </div>

      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link href="/invoices?status=overdue">View overdue</Link>
      </Button>
    </div>
  );
}
