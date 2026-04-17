"use client";

import { useCallback, useEffect, useState } from "react";

export type WidgetKey =
  | "kpis"
  | "revenue"
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

const DEFAULT_VISIBLE: Record<WidgetKey, boolean> = {
  kpis: true,
  revenue: true,
  jobsManagement: true,
  retention: true,
  invoiceAging: true,
  quoteFunnel: true,
  revenueByService: true,
  topCustomers: true,
  agenda: true,
  overdueAlert: true,
  activity: true,
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
