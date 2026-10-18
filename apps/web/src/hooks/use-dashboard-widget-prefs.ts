"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_WIDGET_ORDER,
  isDefaultWidgetOrder,
  moveWidget as moveInOrder,
  sanitizeWidgetOrder,
  type ArrangeableWidget,
} from "@/lib/dashboard-layout";

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

// Keys are persisted in localStorage, so a rename changes the label only: the
// "Up next" widget is still stored under `agenda`.
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
  { key: "agenda", label: "Up next" },
  { key: "overdueAlert", label: "Overdue Alert" },
  { key: "activity", label: "Activity Feed" },
];

const STORAGE_KEY = "dashboard-widget-visibility";
/** The card order from Arrange. Absent means the default order. */
const ORDER_STORAGE_KEY = "dashboard-widget-order";

function saveOrder(order: readonly ArrangeableWidget[]) {
  try {
    // The default is never written, so a later change to the default reaches
    // everyone who never arranged their cards.
    if (isDefaultWidgetOrder(order)) localStorage.removeItem(ORDER_STORAGE_KEY);
    else localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

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
  const [order, setOrder] = useState<ArrangeableWidget[]>([...DEFAULT_WIDGET_ORDER]);
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
    }
    // Read separately, so a corrupt order cannot cost the visibility settings.
    try {
      const storedOrder = localStorage.getItem(ORDER_STORAGE_KEY);
      const parsed = storedOrder ? sanitizeWidgetOrder(JSON.parse(storedOrder)) : null;
      if (parsed) setOrder(parsed);
    } catch {
      /* ignore */
    } finally {
      setHydrated(true);
    }
  }, []);

  /** Put `active` where `over` is (a drop in Arrange). */
  const moveWidget = useCallback((active: ArrangeableWidget, over: ArrangeableWidget) => {
    setOrder((prev) => {
      const next = moveInOrder(prev, active, over);
      saveOrder(next);
      return next;
    });
  }, []);

  /** Back to the default order. Which widgets are shown is Customize's, and stays. */
  const resetOrder = useCallback(() => {
    const next = [...DEFAULT_WIDGET_ORDER];
    saveOrder(next);
    setOrder(next);
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

  return {
    visible,
    toggle,
    reset,
    order,
    moveWidget,
    resetOrder,
    customOrder: !isDefaultWidgetOrder(order),
    hydrated,
  };
}
