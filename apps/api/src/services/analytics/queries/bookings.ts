import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import { bucketSeries } from "./buckets.js";
import {
  monthlyCountRow,
  serviceTypeCountRow,
  bookingConversionRow,
  dayOfWeekRow,
  bookingKpisRow,
  totalCountRow,
} from "../schemas.js";

/**
 * Archived bookings are excluded from every count here, matching what the
 * Bookings page shows by default. Before this the Jobs tab on /reports excluded
 * archived rows and the Bookings tab did not, so one page applied two rules and
 * booking totals exceeded the list page after any bulk archive.
 */
const NOT_ARCHIVED = sql`AND archived_at IS NULL`;

/** Booking volume per bucket with generate_series zero-fill, clamped to [from, to]. */
export async function getBookingVolumeTrend(
  db: DbClient,
  params: DateRangeParams,
  from = params.rangeFrom,
  to = params.rangeTo,
) {
  const { tenantId, granularity } = params;
  const b = bucketSeries(granularity, from, to);
  const rows = await db.execute(sql`
    SELECT
      ${b.key} AS month,
      ${b.label} AS month_label,
      COUNT(bk.id)::text AS count
    FROM ${b.series}
    LEFT JOIN bookings bk
      ON bk.tenant_id = ${tenantId}
      AND bk.archived_at IS NULL
      AND bk.booking_date >= m.bucket
      AND bk.booking_date < m.bucket + ${b.step}
      AND bk.booking_date >= ${from}::date
      AND bk.booking_date <= ${to}::date
    GROUP BY m.bucket
    ORDER BY m.bucket
  `);
  return z.array(monthlyCountRow).parse(rows);
}

/** Bookings grouped by service type. */
export async function getBookingsByServiceType(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT service_type, COUNT(*)::text AS count
    FROM bookings
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND booking_date >= ${rangeFrom}::date
      AND booking_date <= ${rangeTo}::date
    GROUP BY service_type
    ORDER BY COUNT(*) DESC
  `);
  return z.array(serviceTypeCountRow).parse(rows);
}

/** Booking → job conversion rate. */
export async function getBookingConversionRate(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(j.id)::text AS converted
    FROM bookings b
    LEFT JOIN jobs j
      ON j.booking_id = b.id
     AND j.tenant_id = ${tenantId}
     AND j.archived_at IS NULL
    WHERE b.tenant_id = ${tenantId}
      AND b.archived_at IS NULL
      AND b.booking_date >= ${rangeFrom}::date
      AND b.booking_date <= ${rangeTo}::date
  `);
  return z.array(bookingConversionRow).parse(rows);
}

/** Bookings by day of week (0=Sun..6=Sat). */
export async function getBookingsByDayOfWeek(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM booking_date)::text AS day_index,
      COUNT(*)::text AS count
    FROM bookings
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND booking_date >= ${rangeFrom}::date
      AND booking_date <= ${rangeTo}::date
    GROUP BY 1
    ORDER BY 1
  `);
  return z.array(dayOfWeekRow).parse(rows);
}

/** Booking KPIs (total + pending) for date range. */
export async function getBookingKpis(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::text AS pending
    FROM bookings
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND booking_date >= ${rangeFrom}::date
      AND booking_date <= ${rangeTo}::date
  `);
  return z.array(bookingKpisRow).parse(rows);
}

/** Booking count for a date range. */
export async function getBookingCount(
  db: DbClient,
  tenantId: string,
  from: string,
  to: string,
) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM bookings
    WHERE tenant_id = ${tenantId}
      ${NOT_ARCHIVED}
      AND booking_date >= ${from}::date
      AND booking_date <= ${to}::date
  `);
  return z.array(totalCountRow).parse(rows);
}
