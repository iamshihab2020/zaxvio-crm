import { z } from "zod";

// ── Revenue ──

export const revenueTrendRow = z.object({
  month: z.string(),
  month_label: z.string(),
  amount: z.string(),
});

export const revenueByServiceTypeRow = z.object({
  service_type: z.string(),
  amount: z.string(),
});

export const revenueByPaymentMethodRow = z.object({
  method: z.string(),
  amount: z.string(),
});

export const avgJobValueRow = z.object({
  month: z.string(),
  month_label: z.string(),
  avg_value: z.string(),
});

export const collectionRateRow = z.object({
  invoiced: z.string(),
  collected: z.string(),
});

export const topCustomerRevenueRow = z.object({
  id: z.string(),
  name: z.string(),
  revenue: z.string(),
  job_count: z.string(),
});

export const totalAmountRow = z.object({
  amount: z.string(),
});

// ── Jobs ──

export const monthlyCountRow = z.object({
  month: z.string(),
  month_label: z.string(),
  count: z.string(),
});

export const statusCountRow = z.object({
  status: z.string(),
  count: z.string(),
});

export const priorityCountRow = z.object({
  priority: z.string(),
  count: z.string(),
});

export const serviceTypeCountRow = z.object({
  service_type: z.string(),
  count: z.string(),
});

export const avgDaysRow = z.object({
  avg_days: z.string(),
});

export const pipelineRow = z.object({
  stage_label: z.string(),
  stage_color: z.string(),
  count: z.string(),
});

export const jobKpisRow = z.object({
  total: z.string(),
  completed: z.string(),
  cancelled: z.string(),
});

export const totalCountRow = z.object({
  total: z.string(),
});

export const jobsTodayRow = z.object({
  total: z.string(),
  emergency: z.string(),
});

// ── Customers ──

export const activeInactiveRow = z.object({
  active: z.string(),
  inactive: z.string(),
});

export const topCustomerJobsRow = z.object({
  id: z.string(),
  name: z.string(),
  job_count: z.string(),
  total_spent: z.string(),
});

export const repeatOneTimeRow = z.object({
  repeat_count: z.string(),
  onetime_count: z.string(),
});

export const retentionTrendRow = z.object({
  month: z.string(),
  month_label: z.string(),
  repeat_count: z.string(),
  total_count: z.string(),
});

export const upcomingEventRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  event_date: z.string(),
  start_time: z.string().nullable(),
  end_time: z.string().nullable(),
  contact_name: z.string().nullable(),
  address: z.string().nullable(),
  color: z.string().nullable(),
});

export const upcomingJobRow = z.object({
  id: z.string(),
  job_number: z.string(),
  title: z.string().nullable(),
  customer_name: z.string().nullable(),
  address: z.string().nullable(),
  service_type: z.string().nullable(),
  priority: z.string().nullable(),
  scheduled_date: z.string().nullable(),
  scheduled_start: z.string().nullable(),
  scheduled_end: z.string().nullable(),
});

export const upcomingBookingRow = z.object({
  id: z.string(),
  customer_name: z.string(),
  service_type: z.string().nullable(),
  booking_date: z.string(),
  preferred_time: z.string().nullable(),
  address: z.string().nullable(),
  description: z.string().nullable(),
});

// ── Quotes & Invoices ──

export const quoteFunnelRow = z.object({
  status: z.string(),
  count: z.string(),
  value: z.string(),
});

export const agingBucketRow = z.object({
  bucket: z.string(),
  count: z.string(),
  amount: z.string(),
});

export const quoteKpisRow = z.object({
  total: z.string(),
  total_value: z.string(),
  accepted: z.string(),
});

export const quoteKpisPrevRow = z.object({
  total: z.string(),
  accepted: z.string(),
});

export const overdueInvoiceRow = z.object({
  total: z.string(),
  amount: z.string(),
});

// ── Bookings ──

export const bookingConversionRow = z.object({
  total: z.string(),
  converted: z.string(),
});

export const dayOfWeekRow = z.object({
  day_index: z.string(),
  count: z.string(),
});

export const bookingKpisRow = z.object({
  total: z.string(),
  pending: z.string(),
});

// ── Dashboard-only ──

export const activityRow = z.object({
  id: z.string(),
  type: z.string(),
  action: z.string(),
  description: z.string(),
  entity_id: z.string(),
  entity_label: z.string(),
  created_at: z.string(),
});

export const todayJobRow = z.object({
  id: z.string(),
  job_number: z.string(),
  customer_name: z.string(),
  scheduled_start: z.string().nullable(),
  scheduled_end: z.string().nullable(),
  status: z.string(),
  priority: z.string(),
  service_type: z.string(),
});

export const dashboardPipelineRow = z.object({
  stage_name: z.string(),
  stage_label: z.string(),
  stage_color: z.string(),
  job_count: z.string(),
});

export const quoteSummaryRow = z.object({
  total_quotes: z.string(),
  accepted: z.string(),
  declined: z.string(),
  pending: z.string(),
});
