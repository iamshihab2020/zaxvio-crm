// ── Report section types ──

export type ReportSection =
  | "revenue"
  | "jobs"
  | "customers"
  | "quotes-invoices"
  | "bookings";

/** Bucket size for every trend on the page. */
export type ReportGranularity = "day" | "week" | "month";

export interface ReportRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

// ── Shared primitives ──

export interface ReportTrendPoint {
  /** Bucket key: `YYYY-MM` for month buckets, `YYYY-MM-DD` for day/week. */
  month: string;
  monthLabel: string;
}

export interface ReportCategoryItem {
  key: string;
  label: string;
  count: number;
}

// ── Revenue ──

export interface RevenueReportData {
  revenueTrend: (ReportTrendPoint & {
    current: number;
    /**
     * The matching bucket of the comparison period, or `null` when there is no
     * counterpart. Null rather than 0 so the chart breaks the line instead of
     * drawing a false "revenue fell to zero".
     */
    previous: number | null;
    /** Label of the bucket `previous` came from, e.g. "Feb 2026". */
    previousLabel: string | null;
  })[];
  revenueByServiceType: { serviceType: string; label: string; amount: number }[];
  revenueByPaymentMethod: {
    method: string;
    label: string;
    amount: number;
  }[];
  avgJobValueTrend: (ReportTrendPoint & { avgValue: number })[];
  collectionRate: {
    totalInvoiced: number;
    totalCollected: number;
    rate: number;
  };
  topCustomersByRevenue: {
    id: string;
    name: string;
    revenue: number;
    jobCount: number;
  }[];
  kpis: {
    totalRevenue: number;
    previousRevenue: number;
    avgJobValue: number;
    previousAvgJobValue: number;
  };
}

// ── Jobs ──

export interface JobReportData {
  jobVolumeTrend: (ReportTrendPoint & { count: number })[];
  jobsByStatus: {
    status: string;
    label: string;
    count: number;
    color: string;
  }[];
  jobsByPriority: { priority: string; label: string; count: number }[];
  jobsByServiceType: { serviceType: string; label: string; count: number }[];
  avgCompletionDays: number;
  pipelineDistribution: {
    stageLabel: string;
    stageColor: string;
    count: number;
  }[];
  kpis: {
    totalJobs: number;
    previousJobs: number;
    completedJobs: number;
    cancelledJobs: number;
    completionRate: number;
  };
}

// ── Customers ──

export interface CustomerReportData {
  newCustomersTrend: (ReportTrendPoint & { count: number })[];
  growthRate: { current: number; previous: number; rate: number };
  activeVsInactive: { active: number; inactive: number };
  topCustomersByJobCount: {
    id: string;
    name: string;
    jobCount: number;
    totalSpent: number;
  }[];
  repeatVsOneTime: { repeat: number; oneTime: number };
  kpis: {
    totalCustomers: number;
    newInPeriod: number;
    previousNewInPeriod: number;
  };
}

// ── Quotes & Invoices ──

export interface QuoteInvoiceReportData {
  quoteConversionFunnel: {
    status: string;
    label: string;
    count: number;
    value: number;
  }[];
  invoiceStatusDistribution: {
    status: string;
    label: string;
    count: number;
  }[];
  invoiceAgingDetail: {
    bucket: string;
    label: string;
    count: number;
    amount: number;
  }[];
  avgDaysToPayment: number;
  overdueInvoiceTrend: (ReportTrendPoint & { count: number })[];
  quoteKpis: {
    totalQuotes: number;
    previousQuotes: number;
    totalValue: number;
    conversionRate: number;
    previousConversionRate: number;
  };
  invoiceKpis: {
    totalInvoiced: number;
    totalCollected: number;
    collectionRate: number;
    previousCollectionRate: number;
  };
}

// ── Bookings ──

export interface BookingReportData {
  bookingVolumeTrend: (ReportTrendPoint & { count: number })[];
  bookingsByServiceType: {
    serviceType: string;
    label: string;
    count: number;
  }[];
  bookingConversionRate: {
    totalBookings: number;
    converted: number;
    rate: number;
  };
  bookingsByDayOfWeek: { day: string; dayIndex: number; count: number }[];
  kpis: {
    totalBookings: number;
    previousBookings: number;
    pendingBookings: number;
    conversionRate: number;
  };
}

// ── Union response ──

/**
 * Every response echoes back what the server actually resolved. `range` is
 * authoritative: the browser cannot compute month-to-date in the tenant's
 * timezone, so the picker renders what came back rather than what it guessed.
 */
export interface ReportEnvelopeMeta {
  range: ReportRange;
  /** Window the "previous period" series and KPI deltas were measured over. */
  compareRange: ReportRange;
  granularity: ReportGranularity;
}

/**
 * Discriminated on `section`, so `switch (res.section)` narrows `res.data` to
 * the right shape with no casts. The client also uses the discriminant to check
 * that a cached payload belongs to the tab currently being rendered.
 */
export type ReportSectionResponse =
  | (ReportEnvelopeMeta & { section: "revenue"; data: RevenueReportData })
  | (ReportEnvelopeMeta & { section: "jobs"; data: JobReportData })
  | (ReportEnvelopeMeta & { section: "customers"; data: CustomerReportData })
  | (ReportEnvelopeMeta & {
      section: "quotes-invoices";
      data: QuoteInvoiceReportData;
    })
  | (ReportEnvelopeMeta & { section: "bookings"; data: BookingReportData });

/** The payload type for one section, e.g. `ReportDataFor<"jobs">`. */
export type ReportDataFor<S extends ReportSection> = Extract<
  ReportSectionResponse,
  { section: S }
>["data"];
