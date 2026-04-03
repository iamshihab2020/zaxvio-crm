"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, subMonths, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  IconCash,
  IconBriefcase,
  IconUsers,
  IconFileDescription,
  IconCalendarPlus,
} from "@tabler/icons-react";
import type {
  ReportSection,
  RevenueReportData,
  JobReportData,
  CustomerReportData,
  QuoteInvoiceReportData,
  BookingReportData,
} from "@hvac-saas/types";
import { getReportStats } from "@/actions/reports";
import { DateRangePicker, type DatePreset } from "@/components/ui/date-range-picker";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ReportsSkeleton,
  ReportsTabSkeleton,
} from "@/components/dashboard/reports/reports-skeleton";
import { ExportCsvButton } from "@/components/dashboard/reports/export-csv-button";
import { RevenueTab } from "@/components/dashboard/reports/revenue-tab";
import { JobsTab } from "@/components/dashboard/reports/jobs-tab";
import { CustomersTab } from "@/components/dashboard/reports/customers-tab";
import { QuotesInvoicesTab } from "@/components/dashboard/reports/quotes-invoices-tab";
import { BookingsTab } from "@/components/dashboard/reports/bookings-tab";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

const TABS: { value: ReportSection; label: string; icon: typeof IconCash }[] = [
  { value: "revenue", label: "Revenue", icon: IconCash },
  { value: "jobs", label: "Jobs", icon: IconBriefcase },
  { value: "customers", label: "Customers", icon: IconUsers },
  { value: "quotes-invoices", label: "Quotes & Invoices", icon: IconFileDescription },
  { value: "bookings", label: "Bookings", icon: IconCalendarPlus },
];

const EXTRA_PRESETS: DatePreset[] = [
  {
    label: "Last 12 months",
    getValue: () => ({ from: subYears(new Date(), 1), to: new Date() }),
  },
  {
    label: "All time",
    getValue: () => ({ from: new Date(2020, 0, 1), to: new Date() }),
  },
];

type TabDataMap = {
  revenue: RevenueReportData | null;
  jobs: JobReportData | null;
  customers: CustomerReportData | null;
  "quotes-invoices": QuoteInvoiceReportData | null;
  bookings: BookingReportData | null;
};

export function ReportsPageClient() {
  const [activeTab, setActiveTab] = useState<ReportSection>("revenue");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subMonths(new Date(), 3),
    to: new Date(),
  });
  const [tabData, setTabData] = useState<TabDataMap>({
    revenue: null,
    jobs: null,
    customers: null,
    "quotes-invoices": null,
    bookings: null,
  });
  const [tabLoading, setTabLoading] = useState<Record<ReportSection, boolean>>({
    revenue: false,
    jobs: false,
    customers: false,
    "quotes-invoices": false,
    bookings: false,
  });
  const [initialLoading, setInitialLoading] = useState(true);

  // Track which date range each tab was fetched for
  const tabDateRef = useRef<Record<ReportSection, string>>({
    revenue: "",
    jobs: "",
    customers: "",
    "quotes-invoices": "",
    bookings: "",
  });

  const dateKey = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "";
    return `${format(dateRange.from, "yyyy-MM-dd")}_${format(dateRange.to, "yyyy-MM-dd")}`;
  }, [dateRange]);

  const fetchSection = useCallback(
    async (section: ReportSection) => {
      if (!dateRange?.from || !dateRange?.to) return;

      // Skip if already fetched for this date range
      if (tabDateRef.current[section] === dateKey && tabData[section]) return;

      setTabLoading((prev) => ({ ...prev, [section]: true }));

      const { data, error } = await getReportStats({
        section,
        from: format(dateRange.from, "yyyy-MM-dd"),
        to: format(dateRange.to, "yyyy-MM-dd"),
      });

      if (error) {
        toast.error(error);
      } else {
        setTabData((prev) => ({ ...prev, [section]: data }));
        tabDateRef.current[section] = dateKey;
      }

      setTabLoading((prev) => ({ ...prev, [section]: false }));
      setInitialLoading(false);
    },
    [dateRange, dateKey, tabData],
  );

  // Fetch active tab on mount and when tab changes
  useEffect(() => {
    fetchSection(activeTab);
  }, [activeTab, fetchSection]);

  // When date range changes, invalidate all tabs and fetch active
  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      setDateRange(range);
      // Invalidate all cached data
      tabDateRef.current = {
        revenue: "",
        jobs: "",
        customers: "",
        "quotes-invoices": "",
        bookings: "",
      };
      setTabData({
        revenue: null,
        jobs: null,
        customers: null,
        "quotes-invoices": null,
        bookings: null,
      });
    },
    [],
  );

  if (initialLoading && !tabData[activeTab]) {
    return (
      <section className="p-6">
        <ReportsSkeleton />
      </section>
    );
  }

  return (
    <section className="p-6">
      <Fade inView inViewOnce delay={0}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Reports & Analytics
          </h1>
          <div className="flex items-center gap-2">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              extraPresets={EXTRA_PRESETS}
            />
            <ExportCsvButton section={activeTab} data={tabData[activeTab]} />
          </div>
        </div>
      </Fade>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportSection)}
      >
        <Fade inView inViewOnce delay={80}>
          <TabsList className="mb-4">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Fade>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            {tabLoading[tab.value] ? (
              <ReportsTabSkeleton />
            ) : (
              <Fade inView inViewOnce key={`${tab.value}-${dateKey}`} delay={0}>
                {renderTabContent(tab.value, tabData)}
              </Fade>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

function renderTabContent(section: ReportSection, tabData: TabDataMap) {
  switch (section) {
    case "revenue":
      return tabData.revenue ? (
        <RevenueTab data={tabData.revenue} />
      ) : (
        <EmptyTabState />
      );
    case "jobs":
      return tabData.jobs ? (
        <JobsTab data={tabData.jobs} />
      ) : (
        <EmptyTabState />
      );
    case "customers":
      return tabData.customers ? (
        <CustomersTab data={tabData.customers} />
      ) : (
        <EmptyTabState />
      );
    case "quotes-invoices":
      return tabData["quotes-invoices"] ? (
        <QuotesInvoicesTab data={tabData["quotes-invoices"]} />
      ) : (
        <EmptyTabState />
      );
    case "bookings":
      return tabData.bookings ? (
        <BookingsTab data={tabData.bookings} />
      ) : (
        <EmptyTabState />
      );
  }
}

function EmptyTabState() {
  return (
    <div className="flex h-64 items-center justify-center">
      <p className="font-body text-sm text-muted-foreground">
        No data available for this period.
      </p>
    </div>
  );
}
