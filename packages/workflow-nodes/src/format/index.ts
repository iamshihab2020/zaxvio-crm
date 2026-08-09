/**
 * Value formatting for interpolated variables.
 *
 * **Format by declaration, never by shape.** A `VariableDef` says
 * `format: "phone"`; nothing here sniffs a value and guesses. The reference
 * implementation guessed, and rendered a ten-digit Google Ads campaign id as
 * `(123) 456-7890` (A-09).
 *
 * ## Why this lives in the package rather than in an app
 *
 * The engine runs in `apps/api` and the variable picker runs in `apps/web`, and
 * they must render a value identically — the sample the author sees in the
 * picker is a promise about what the email will say. An app cannot import from
 * another app, so a formatter in either one means two copies, and this codebase
 * has already paid for that: four phone formatters with two different
 * behaviours, of which one truncated at ten digits and silently destroyed every
 * international number (CUST-08/31).
 *
 * `formatPhoneDisplay` is *the* implementation now; `apps/web/src/lib/phone.ts`
 * re-exports it and keeps only the input-handling half, which is browser-only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Phone
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pretty-print for display.
 *
 * NANP grouping **only when the number unambiguously is one** — ten digits, or
 * eleven starting with 1, and no `+` prefix. Everything else is returned as
 * entered, which is correct for a platform that is not US-only and beats
 * bending a UK number into an American shape.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const value = String(phone).trim();
  const digits = value.replace(/\D/g, "");

  if (!value.startsWith("+")) {
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith("1")) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
  }
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Money
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `"1250.00"` → `$1,250.00`.
 *
 * Takes the decimal **string** Drizzle returns for a `numeric` column. Parsing
 * to a float for display is safe; parsing to a float for *arithmetic* is not,
 * which is why comparisons go through `services/costing/money.ts` in integer
 * cents instead — a margin is a difference of two sums, so float error there is
 * doubled.
 */
export function formatMoney(
  value: string | number | null | undefined,
  currency = "USD",
): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(n);
}

/** `0.0825` → `8.25%`. Tax rates are stored as fractions, not percentages. */
export function formatPercent(
  value: string | number | null | undefined,
  fractionDigits = 2,
): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return `${(n * 100).toFixed(fractionDigits).replace(/\.?0+$/, "")}%`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dates and times
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * A `date` column (`YYYY-MM-DD`) → `Aug 8, 2026`.
 *
 * Anchored at **UTC noon** and rendered in UTC. `new Date("2026-08-01")` is UTC
 * midnight rendered in the process zone, so it prints 31 July anywhere west of
 * UTC — the bug QUO-10 fixed, where the emailed quote and the customer portal
 * printed different dates for the same field.
 *
 * A `date` column has no time and therefore no timezone; converting one into a
 * zone is the mistake, not the fix.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * A `timestamptz` → `Aug 8, 2026 3:30 PM CDT`.
 *
 * **The abbreviation is not decoration.** wf-05 §5.5: a reminder that says
 * "3:30 PM" and a reminder that says "3:30 PM CDT" are different products, and
 * the first one gets somebody to a job at the wrong hour. Nothing in
 * `lib/timezone.ts` emitted one, which is why this exists.
 *
 * The zone is the **workflow's**, never the server's. Two bugs in this repo
 * came from the alternative: the E-05 completion email stamped the server's
 * date (02:30 UTC is 1 August in Chicago and 2 August in UTC), and the calendar
 * rendered in the browser's zone rather than the tenant's (BOOK-30).
 */
export function formatDateTime(
  value: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timezone),
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(d);
}

/**
 * A `time` column (`HH:MM:SS`) → `9:00 AM CDT`.
 *
 * A bare `time` has no date, so there is no instant to convert — it is already
 * wall-clock time in the tenant's zone, which is how the scheduler stores it.
 * The abbreviation is appended rather than derived by conversion, because
 * converting would silently shift the hour.
 *
 * `onDate` exists for the case where the abbreviation genuinely differs: CDT in
 * August and CST in January, from the same stored `09:00:00`. Pass the job's
 * scheduled date and the label follows it.
 */
export function formatTimeOnly(
  value: string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
  onDate?: string | null,
): string {
  if (!value) return "";
  const [rawHour, rawMinute] = String(value).split(":");
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";

  const suffix = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  const clock = `${display}:${String(minute).padStart(2, "0")} ${suffix}`;

  const abbreviation = zoneAbbreviation(timezone, onDate);
  return abbreviation ? `${clock} ${abbreviation}` : clock;
}

/**
 * `CDT` / `CST` / `GMT+5:30` for a zone on a given date.
 *
 * Anchored at UTC noon on the supplied date so a DST boundary resolves the way
 * a human would read it. Falls back to today when no date is given, which is
 * right for "what time is it now" and wrong for a date six months out — hence
 * the parameter.
 */
export function zoneAbbreviation(
  timezone: string = DEFAULT_TIMEZONE,
  onDate?: string | null,
): string {
  const anchor = onDate
    ? new Date(`${String(onDate).slice(0, 10)}T12:00:00Z`)
    : new Date();
  if (Number.isNaN(anchor.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timezone),
    timeZoneName: "short",
  }).formatToParts(anchor);

  return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
}

/** `en-US` weekday name in a zone — `Saturday`. */
export function formatDayOfWeek(
  value: Date | string | null | undefined,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const d = toDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: safeZone(timezone),
    weekday: "long",
  }).format(d);
}

// ─────────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `maintenance` → `Maintenance`, `credit_card` → `Credit Card`.
 *
 * Enum values reach a customer's inbox verbatim otherwise. "Your maintenance
 * visit" is a sentence; "Your maintenance_contract visit" is a leaked column.
 */
export function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return String(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** An array for a template — `a, b, c`. Objects fall back to JSON. */
export function formatList(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      item === null || item === undefined
        ? ""
        : typeof item === "object"
          ? JSON.stringify(item)
          : String(item),
    )
    .filter(Boolean)
    .join(", ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * An unknown IANA zone makes `Intl.DateTimeFormat` **throw**, and a workflow's
 * timezone is a stored string that a bad import or an old row could have got
 * wrong. Falling back beats failing a run over a label.
 */
function safeZone(timezone: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return timezone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}
