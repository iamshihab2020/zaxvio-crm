import { sql } from "@hvac-saas/database";
import { z } from "zod";
import type { DbClient, DateRangeParams } from "../types.js";
import {
  monthlyCountRow,
  serviceTypeCountRow,
  bookingConversionRow,
  dayOfWeekRow,
  bookingKpisRow,
  totalCountRow,
} from "../schemas.js";

/** Booking volume by month with generate_series zero-fill. */
export async function getBookingVolumeTrend(db: DbClient, params: DateRangeParams) {
  const { tenantId, rangeFrom, rangeTo } = params;
  const rows = await db.execute(sql`
    SELECT
      to_char(m.month, 'YYYY-MM') AS month,
      to_char(m.month, 'Mon YYYY') AS month_label,
      COUNT(b.id)::text AS count
    FROM generate_series(
      date_trunc('month', ${rangeFrom}::date),
      date_trunc('month', ${rangeTo}::date),
      INTERVAL '1 month'
    ) AS m(month)
    LEFT JOIN bookings b
      ON b.tenant_id = ${tenantId}
      AND b.booking_date >= m.month
      AND b.booking_date < m.month + INTERVAL '1 month'
    GROUP BY m.month
    ORDER BY m.month
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
    LEFT JOIN jobs j ON j.booking_id = b.id AND j.tenant_id = ${tenantId}
    WHERE b.tenant_id = ${tenantId}
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
      AND booking_date >= ${rangeFrom}::date
      AND booking_date <= ${rangeTo}::date
  `);
  return z.array(bookingKpisRow).parse(rows);
}

/** Pending booking count (always current). Shared with dashboard. */
export async function getPendingBookingCount(db: DbClient, tenantId: string) {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::text AS total
    FROM bookings
    WHERE tenant_id = ${tenantId}
      AND status = 'pending'
  `);
  return z.array(totalCountRow).parse(rows);
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
      AND booking_date >= ${from}::date
      AND booking_date <= ${to}::date
  `);
  return z.array(totalCountRow).parse(rows);
}
