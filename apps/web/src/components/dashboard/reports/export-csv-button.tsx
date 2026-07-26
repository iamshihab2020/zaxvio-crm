"use client";

import { IconDownload } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { ReportSectionResponse } from "@hvac-saas/types";

type Cell = string | number;
type Row = Cell[];

interface ExportCsvButtonProps {
  report: ReportSectionResponse | null;
}

const SECTION_TITLES: Record<ReportSectionResponse["section"], string> = {
  revenue: "Revenue Report",
  jobs: "Jobs Report",
  customers: "Customers Report",
  "quotes-invoices": "Quotes & Invoices Report",
  bookings: "Bookings Report",
};

export function ExportCsvButton({ report }: ExportCsvButtonProps) {
  const handleExport = () => {
    if (!report) return;

    const rows = buildCsvRows(report);
    if (!rows.length) return;

    const csv = rows.map((r) => r.map(escapeCell).join(",")).join("\r\n");
    // Excel on Windows assumes the system codepage without a UTF-8 BOM, which
    // turns "Café" into "CafÃ©" in exported customer names.
    const blob = new Blob(["﻿", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // The range is in the filename: exporting Q1 and then Q2 on the same day
    // used to produce two files called `report-revenue-2026-07-27.csv`, which
    // the browser silently disambiguated as "(1)".
    a.download = `${report.section}-report-${report.range.from}_to_${report.range.to}.csv`;
    // Firefox will not follow a click on a detached anchor.
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoking synchronously can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-8 gap-1.5 font-body text-xs"
      onClick={handleExport}
      disabled={!report}
      title={
        report
          ? `Export the full ${SECTION_TITLES[report.section].toLowerCase()} as CSV`
          : undefined
      }
    >
      <IconDownload className="h-3.5 w-3.5" />
      Export
    </Button>
  );
}

/** Leading characters a spreadsheet treats as the start of a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * RFC-4180 quoting *plus* CSV-injection defence.
 *
 * A cell beginning `=`, `+`, `-`, `@`, TAB or CR is evaluated as a formula by
 * Excel, Sheets and LibreOffice — `=cmd|'/c calc'!A1` is the classic payload.
 * Exported cells include customer names, and the public booking portal accepts
 * a name from an unauthenticated visitor which the booking→customer flow
 * persists, so the string reaching this function is not necessarily the
 * tenant's own. Prefixing with an apostrophe neutralises it; spreadsheets do
 * not display the apostrophe.
 *
 * Numbers bypass the guard entirely — a negative amount must stay numeric, and
 * a `number` can never carry a payload.
 */
function escapeCell(val: Cell | null | undefined): string {
  if (typeof val === "number") {
    return Number.isFinite(val) ? String(val) : "";
  }
  const s = val == null ? "" : String(val);
  const risky = FORMULA_LEAD.test(s);
  const body = risky ? `'${s}` : s;
  if (risky || /[",\r\n]/.test(body)) {
    return `"${body.replace(/"/g, '""')}"`;
  }
  return body;
}

/** Blank spacer between datasets. */
const GAP: Row = [];

function section(title: string, header: Row, body: Row[]): Row[] {
  return [GAP, [title], header, ...body];
}

/**
 * Every dataset the tab renders, not a sample of two.
 *
 * The previous version emitted two datasets per section — a user exporting
 * "the revenue report" silently lost revenue-by-service-type,
 * revenue-by-payment-method, the avg-job-value trend and the collection rate.
 */
function buildCsvRows(report: ReportSectionResponse): Row[] {
  const rows: Row[] = [
    [SECTION_TITLES[report.section]],
    ["Period", `${report.range.from} to ${report.range.to}`],
    [
      "Compared with",
      `${report.compareRange.from} to ${report.compareRange.to}`,
    ],
    ["Grouped by", report.granularity],
  ];

  switch (report.section) {
    case "revenue": {
      const d = report.data;
      rows.push(
        ...section(
          "Revenue Trend",
          ["Period", "Revenue (Current)", "Comparison Period", "Revenue (Previous)"],
          d.revenueTrend.map((p) => [
            p.monthLabel,
            p.current,
            p.previousLabel ?? "",
            p.previous ?? "",
          ]),
        ),
        ...section(
          "Revenue by Service Type",
          ["Service Type", "Revenue"],
          d.revenueByServiceType.map((r) => [r.label, r.amount]),
        ),
        ...section(
          "Revenue by Payment Method",
          ["Payment Method", "Revenue"],
          d.revenueByPaymentMethod.map((r) => [r.label, r.amount]),
        ),
        ...section(
          "Average Job Value",
          ["Period", "Avg Job Value (Booked)"],
          d.avgJobValueTrend.map((r) => [r.monthLabel, r.avgValue]),
        ),
        ...section(
          "Collection Rate",
          ["Metric", "Value"],
          [
            ["Total Invoiced", d.collectionRate.totalInvoiced],
            ["Total Collected", d.collectionRate.totalCollected],
            ["Collection Rate (%)", d.collectionRate.rate],
          ],
        ),
        ...section(
          "Top Customers by Revenue",
          ["Customer", "Revenue", "Jobs"],
          d.topCustomersByRevenue.map((c) => [c.name, c.revenue, c.jobCount]),
        ),
        ...section(
          "Summary",
          ["Metric", "Current", "Previous"],
          [
            ["Total Revenue (collected)", d.kpis.totalRevenue, d.kpis.previousRevenue],
            ["Avg Job Value (booked)", d.kpis.avgJobValue, d.kpis.previousAvgJobValue],
          ],
        ),
      );
      return rows;
    }
    case "jobs": {
      const d = report.data;
      rows.push(
        ...section(
          "Job Volume",
          ["Period", "Jobs"],
          d.jobVolumeTrend.map((p) => [p.monthLabel, p.count]),
        ),
        ...section(
          "Jobs by Status",
          ["Status", "Count"],
          d.jobsByStatus.map((s) => [s.label, s.count]),
        ),
        ...section(
          "Jobs by Priority",
          ["Priority", "Count"],
          d.jobsByPriority.map((s) => [s.label, s.count]),
        ),
        ...section(
          "Jobs by Service Type",
          ["Service Type", "Count"],
          d.jobsByServiceType.map((s) => [s.label, s.count]),
        ),
        ...section(
          "Pipeline Distribution",
          ["Stage", "Count"],
          d.pipelineDistribution.map((s) => [s.stageLabel, s.count]),
        ),
        ...section(
          "Summary",
          ["Metric", "Value"],
          [
            ["Total Jobs", d.kpis.totalJobs],
            ["Previous Period Jobs", d.kpis.previousJobs],
            ["Completed", d.kpis.completedJobs],
            ["Cancelled", d.kpis.cancelledJobs],
            ["Completion Rate (%)", d.kpis.completionRate],
            ["Avg Completion (days)", d.avgCompletionDays],
          ],
        ),
      );
      return rows;
    }
    case "customers": {
      const d = report.data;
      rows.push(
        ...section(
          "New Customers",
          ["Period", "New Customers"],
          d.newCustomersTrend.map((p) => [p.monthLabel, p.count]),
        ),
        ...section(
          "Active vs Inactive",
          ["Segment", "Customers"],
          [
            ["Active (job in last 90 days)", d.activeVsInactive.active],
            ["Inactive", d.activeVsInactive.inactive],
          ],
        ),
        ...section(
          "Repeat vs One-Time",
          ["Segment", "Customers"],
          [
            ["Repeat (2+ jobs)", d.repeatVsOneTime.repeat],
            ["One-Time", d.repeatVsOneTime.oneTime],
          ],
        ),
        ...section(
          "Top Customers by Job Count",
          ["Customer", "Jobs", "Total Spent"],
          d.topCustomersByJobCount.map((c) => [c.name, c.jobCount, c.totalSpent]),
        ),
        ...section(
          "Summary",
          ["Metric", "Value"],
          [
            ["Total Customers", d.kpis.totalCustomers],
            ["New This Period", d.kpis.newInPeriod],
            ["New Previous Period", d.kpis.previousNewInPeriod],
            ["Growth Rate (%)", d.growthRate.rate],
          ],
        ),
      );
      return rows;
    }
    case "quotes-invoices": {
      const d = report.data;
      rows.push(
        ...section(
          "Quote Conversion Funnel",
          ["Quote Status", "Count", "Value"],
          d.quoteConversionFunnel.map((q) => [q.label, q.count, q.value]),
        ),
        ...section(
          "Invoice Status Distribution",
          ["Invoice Status", "Count"],
          d.invoiceStatusDistribution.map((s) => [s.label, s.count]),
        ),
        ...section(
          "Invoice Aging",
          ["Bucket", "Invoices", "Amount"],
          d.invoiceAgingDetail.map((b) => [b.label, b.count, b.amount]),
        ),
        ...section(
          "Overdue Invoices",
          ["Period", "Overdue Invoices"],
          d.overdueInvoiceTrend.map((p) => [p.monthLabel, p.count]),
        ),
        ...section(
          "Summary",
          ["Metric", "Current", "Previous"],
          [
            ["Total Quotes", d.quoteKpis.totalQuotes, d.quoteKpis.previousQuotes],
            ["Quote Value", d.quoteKpis.totalValue, ""],
            [
              "Quote Conversion (%)",
              d.quoteKpis.conversionRate,
              d.quoteKpis.previousConversionRate,
            ],
            ["Total Invoiced", d.invoiceKpis.totalInvoiced, ""],
            ["Total Collected", d.invoiceKpis.totalCollected, ""],
            [
              "Collection Rate (%)",
              d.invoiceKpis.collectionRate,
              d.invoiceKpis.previousCollectionRate,
            ],
            ["Avg Days to Payment", d.avgDaysToPayment, ""],
          ],
        ),
      );
      return rows;
    }
    case "bookings": {
      const d = report.data;
      rows.push(
        ...section(
          "Booking Volume",
          ["Period", "Bookings"],
          d.bookingVolumeTrend.map((p) => [p.monthLabel, p.count]),
        ),
        ...section(
          "Bookings by Service Type",
          ["Service Type", "Count"],
          d.bookingsByServiceType.map((s) => [s.label, s.count]),
        ),
        ...section(
          "Bookings by Day of Week",
          ["Day", "Bookings"],
          d.bookingsByDayOfWeek.map((s) => [s.day, s.count]),
        ),
        ...section(
          "Summary",
          ["Metric", "Value"],
          [
            ["Total Bookings", d.kpis.totalBookings],
            ["Previous Period Bookings", d.kpis.previousBookings],
            ["Pending", d.kpis.pendingBookings],
            ["Converted to Jobs", d.bookingConversionRate.converted],
            ["Conversion Rate (%)", d.bookingConversionRate.rate],
          ],
        ),
      );
      return rows;
    }
    default: {
      const exhaustive: never = report;
      throw new Error(`Unhandled report section: ${String(exhaustive)}`);
    }
  }
}
