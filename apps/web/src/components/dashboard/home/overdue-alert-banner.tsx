"use client";

import { IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";
import type { DashboardOverdueInvoices } from "@hvac-saas/types";
import { formatCurrencyPrecise } from "@/lib/format";

interface OverdueAlertBannerProps {
  overdueInvoices: DashboardOverdueInvoices;
}

export function OverdueAlertBanner({ overdueInvoices }: OverdueAlertBannerProps) {
  if (overdueInvoices.count === 0) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
    >
      <div className="flex items-center gap-3">
        <IconAlertTriangle
          aria-hidden
          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <p className="text-sm font-body text-amber-800 dark:text-amber-200">
          You have{" "}
          <span className="font-semibold">
            {overdueInvoices.count} overdue{" "}
            {overdueInvoices.count === 1 ? "invoice" : "invoices"}
          </span>{" "}
          totaling{" "}
          <span className="font-semibold">
            {formatCurrencyPrecise(overdueInvoices.totalAmount)}
          </span>
        </p>
      </div>
      <Link
        href="/invoices?status=overdue"
        className="shrink-0 text-sm font-medium text-amber-700 hover:underline dark:text-amber-300"
      >
        View All &rarr;
      </Link>
    </div>
  );
}
