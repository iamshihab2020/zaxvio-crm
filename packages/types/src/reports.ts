// ── Report section types ──

export type ReportSection =
  | "revenue"
  | "jobs"
  | "customers"
  | "quotes-invoices"
  | "bookings";

// ── Shared primitives ──

export interface ReportTrendPoint {
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
    previous: number;
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

export type ReportSectionResponse =
  | { section: "revenue"; data: RevenueReportData }
  | { section: "jobs"; data: JobReportData }
  | { section: "customers"; data: CustomerReportData }
  | { section: "quotes-invoices"; data: QuoteInvoiceReportData }
  | { section: "bookings"; data: BookingReportData };
