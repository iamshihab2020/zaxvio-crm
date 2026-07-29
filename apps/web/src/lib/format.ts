export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCurrencyPrecise(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * A money figure from a `numeric` column, which arrives as a string.
 *
 * The invoice table and the PDF each hand-rolled `` `$${num.toFixed(2)}` ``, so
 * a four-figure invoice read `$1234.50` on a customer-facing document — no
 * thousands separator (INV-39). Negative values keep the minus sign rather than
 * `toLocaleString`'s parentheses, because a negative balance means a credit and
 * accounting parentheses read as a loss.
 */
export function formatMoney(value: string | number | null | undefined): string {
  const num = typeof value === "number" ? value : parseFloat(value ?? "0");
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = Math.abs(safe).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return safe < 0 ? `−${formatted}` : formatted;
}

/**
 * Render a `date` column (`YYYY-MM-DD`) without the UTC-midnight day shift.
 *
 * `new Date("2026-07-29")` is UTC midnight, which `toLocaleDateString` then
 * renders in the browser's zone — so anywhere west of UTC every invoice date,
 * every due date and every payment date showed the previous day (INV-19).
 * Anchoring at noon UTC and formatting in UTC removes both halves of the shift.
 *
 * Use this for `date` columns only. Timestamps carry their own instant and
 * should be rendered in the tenant's zone via `lib/tenant-time.ts`.
 */
export function formatDateOnly(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "—";
  const d = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
