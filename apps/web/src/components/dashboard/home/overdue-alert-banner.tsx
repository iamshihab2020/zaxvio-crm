"use client";

import Link from "next/link";
import { useState } from "react";
import type { DashboardOverdueInvoices } from "@hvac-saas/types";
import { AnimatedNumber } from "@/components/reusable/animated-number";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatCurrencyPrecise } from "@/lib/format";
import { cn } from "@/lib/utils";

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
 *
 * On a phone the button drops under the text at full width: beside the amount
 * it squeezed the figure into a wrap, and a 32px button is under a thumb target.
 *
 * It drops in from under the toolbar only when it appears after the page is up,
 * which is a refetch finding the first late invoice. A banner that is there
 * when the page arrives rises with the rest of the stack instead, and two
 * arrivals on one element would fight over the same transform.
 */
export function OverdueAlertBanner({ overdueInvoices }: OverdueAlertBannerProps) {
  const { count, totalAmount } = overdueInvoices;

  // Set during render, which React allows for a component's own state, so the
  // Card below mounts carrying the class in the same commit that shows it.
  const [wasEmpty, setWasEmpty] = useState(count === 0);
  if (count === 0 && !wasEmpty) setWasEmpty(true);

  if (count === 0) return null;

  return (
    <Card
      role="status"
      data-widget="overdueAlert"
      className={cn(
        "flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap sm:gap-5 sm:px-5",
        wasEmpty && "motion-drop-in",
      )}
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
            <AnimatedNumber value={totalAmount} format={formatCurrencyPrecise} />
          </span>
          <span className="text-sm font-body text-muted-foreground">
            across {count} {count === 1 ? "invoice" : "invoices"}
          </span>
        </p>
      </div>

      <Button
        asChild
        variant="outline"
        size="sm"
        className="min-h-10 w-full shrink-0 sm:min-h-0 sm:w-auto"
      >
        <Link href="/invoices?status=overdue">View overdue</Link>
      </Button>
    </Card>
  );
}
