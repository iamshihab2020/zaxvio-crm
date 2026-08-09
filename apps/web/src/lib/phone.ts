/**
 * Phone number handling — one copy, because there were four.
 *
 * `customer-dialog.tsx`, `customer-picker.tsx`, `customer-table.tsx` and
 * `customer-detail-header.tsx` each had their own, with two different behaviours,
 * and two real bugs fell out of that (CUST-31):
 *
 *  - The input formatter truncated at ten digits, so `+44 20 7946 0958` was typed
 *    in and `4420794609` came out — a number that dials nothing. Silent, because
 *    the field looked like it accepted the input (CUST-08).
 *  - The dialog stored bare digits and the inline header editor stored the
 *    *formatted* string, so one column held two representations and the search,
 *    which matches the raw column, could never match both (CUST-07).
 *
 * The rule now: **format for display, never for storage.** `normalizePhone` is
 * what goes to the API — it keeps every digit and an optional leading `+`, which
 * is lossless for every numbering plan. The API applies the same normalisation in
 * `schemas/customers.ts` so it holds regardless of caller.
 */

/**
 * **`formatPhoneDisplay` now lives in `@hvac-saas/workflow-nodes/format`** and is
 * re-exported here so no component import had to change.
 *
 * It moved because the workflow engine renders `{{customer.phone}}` in
 * `apps/api`, and an app cannot import from another app — leaving it here would
 * have meant a fifth copy in the exact place a fifth copy is least affordable,
 * since the picker's sample value is a promise about what the email will say.
 *
 * What stays here is the input half: `normalizePhone` and `formatPhoneInput`
 * exist to serve a keystroke in a browser and have no business in a server-side
 * template renderer.
 */
export { formatPhoneDisplay } from "@hvac-saas/workflow-nodes";

/** Digits (and a leading `+`) only — what gets stored. Lossless. */
export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return "";
  return `${hasPlus ? "+" : ""}${digits}`;
}

/**
 * Progressive formatting as the user types.
 *
 * Only kicks in for what looks like a NANP number and, crucially, **never drops
 * a digit** — once past ten, the raw input is returned untouched so international
 * numbers can be typed straight through.
 */
export function formatPhoneInput(value: string): string {
  if (value.trim().startsWith("+")) return value;

  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** `tel:` href — always the normalised form. */
export function phoneHref(phone: string | null | undefined): string {
  return `tel:${normalizePhone(phone ?? "")}`;
}
