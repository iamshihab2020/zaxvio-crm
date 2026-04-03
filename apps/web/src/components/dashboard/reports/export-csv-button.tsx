"use client";

import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { ReportSection } from "@hvac-saas/types";

interface ExportCsvButtonProps {
  section: ReportSection;
  data: unknown | null;
}

export function ExportCsvButton({ section, data }: ExportCsvButtonProps) {
  const handleExport = () => {
    if (!data) return;

    const rows = buildCsvRows(section, data);
    if (!rows.length) return;

    const csv = rows.map((r) => r.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${section}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 font-body text-xs"
      onClick={handleExport}
      disabled={!data}
    >
      <IconDownload className="h-3.5 w-3.5" />
      Export
    </Button>
  );
}

function escapeCell(val: string | number): string {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCsvRows(section: ReportSection, data: any): (string | number)[][] {
  switch (section) {
    case "revenue": {
      const rows: (string | number)[][] = [["Month", "Revenue (Current)", "Revenue (Previous)"]];
      for (const p of data.revenueTrend ?? []) {
        rows.push([p.monthLabel, p.current, p.previous]);
      }
      rows.push([]);
      rows.push(["Customer", "Revenue", "Jobs"]);
      for (const c of data.topCustomersByRevenue ?? []) {
        rows.push([c.name, c.revenue, c.jobCount]);
      }
      return rows;
    }
    case "jobs": {
      const rows: (string | number)[][] = [["Month", "Job Count"]];
      for (const p of data.jobVolumeTrend ?? []) {
        rows.push([p.monthLabel, p.count]);
      }
      rows.push([]);
      rows.push(["Status", "Count"]);
      for (const s of data.jobsByStatus ?? []) {
        rows.push([s.label, s.count]);
      }
      return rows;
    }
    case "customers": {
      const rows: (string | number)[][] = [["Month", "New Customers"]];
      for (const p of data.newCustomersTrend ?? []) {
        rows.push([p.monthLabel, p.count]);
      }
      rows.push([]);
      rows.push(["Customer", "Jobs", "Total Spent"]);
      for (const c of data.topCustomersByJobCount ?? []) {
        rows.push([c.name, c.jobCount, c.totalSpent]);
      }
      return rows;
    }
    case "quotes-invoices": {
      const rows: (string | number)[][] = [["Quote Status", "Count", "Value"]];
      for (const q of data.quoteConversionFunnel ?? []) {
        rows.push([q.label, q.count, q.value]);
      }
      rows.push([]);
      rows.push(["Invoice Status", "Count"]);
      for (const s of data.invoiceStatusDistribution ?? []) {
        rows.push([s.label, s.count]);
      }
      return rows;
    }
    case "bookings": {
      const rows: (string | number)[][] = [["Month", "Bookings"]];
      for (const p of data.bookingVolumeTrend ?? []) {
        rows.push([p.monthLabel, p.count]);
      }
      rows.push([]);
      rows.push(["Service Type", "Count"]);
      for (const s of data.bookingsByServiceType ?? []) {
        rows.push([s.label, s.count]);
      }
      return rows;
    }
    default:
      return [];
  }
}
