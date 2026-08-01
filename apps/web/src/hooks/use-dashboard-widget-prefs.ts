"use client";

import { useCallback, useEffect, useState } from "react";

export type WidgetKey =
  | "kpis"
  | "revenue"
  | "weekAhead"
  | "jobsManagement"
  | "retention"
  | "invoiceAging"
  | "quoteFunnel"
  | "revenueByService"
  | "topCustomers"
  | "agenda"
  | "overdueAlert"
  | "activity";

export const ALL_WIDGETS: { key: WidgetKey; label: string }[] = [
  { key: "kpis", label: "KPI Pills" },
  { key: "revenue", label: "Revenue Chart" },
  { key: "weekAhead", label: "Week Ahead" },
  { key: "jobsManagement", label: "Jobs Management" },
  { key: "retention", label: "Retention Rate" },
  { key: "invoiceAging", label: "Invoice Aging" },
  { key: "quoteFunnel", label: "Quote Funnel" },
  { key: "revenueByService", label: "Revenue by Service" },
  { key: "topCustomers", label: "Top Customers" },
  { key: "agenda", label: "Agenda" },
  { key: "overdueAlert", label: "Overdue Alert" },
  { key: "activity", label: "Activity Feed" },
];

const STORAGE_KEY = "dashboard-widget-visibility";

/**
 * Opinionated default: the six widgets a service business opens the dashboard for.
 *
 * All eleven used to be on, producing ~4,000px of scroll where the two things a
 * contractor actually checks each morning — what's on today, and who owes money —
 * sat below three analyst charts. The rest stay one click away in Customize, and
 * anyone who has already customised keeps their saved layout (stored prefs are
 * merged over these defaults).
 */
const DEFAULT_VISIBLE: Record<WidgetKey, boolean> = {
  overdueAlert: true,
  kpis: true,
  agenda: true,
  revenue: true,
  weekAhead: true,
  invoiceAging: true,
  jobsManagement: true,
  // Analyst-grade metrics — valuable, but not daily. Opt in via Customize.
  quoteFunnel: false,
  retention: false,
  revenueByService: false,
  topCustomers: false,
  activity: false,
};

export function useDashboardWidgetPrefs() {
  const [visible, setVisible] = useState<Record<WidgetKey, boolean>>(DEFAULT_VISIBLE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<WidgetKey, boolean>>;
        setVisible({ ...DEFAULT_VISIBLE, ...parsed });
      }
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, []);

  const toggle = useCallback((key: WidgetKey) => {
    setVisible((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setVisible(DEFAULT_VISIBLE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { visible, toggle, reset, hydrated };
}
