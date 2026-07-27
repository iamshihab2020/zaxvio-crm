import { z } from "zod";
import { boundedText, idParam, paginationQuery } from "./common.js";

// ── Params ────────────────────────────────────────────────────────────────────

export { idParam };

export const noteIdParam = z.object({
  id: z.string().uuid(),
  noteId: z.string().uuid(),
});

export const tagIdParam = z.object({
  id: z.string().uuid(),
  tagId: z.string().uuid(),
});

// ── Field primitives ──────────────────────────────────────────────────────────
//
// Customer fields are rendered into invoice/quote PDFs and interpolated into
// customer-facing emails, so they are the *primary* source of untrusted text on
// the platform — and they were the one domain that never got the treatment
// `tenants` got in DF-TEN-01..12 and bookings got via `boundedText`. Every field
// below is bounded; `email` is actually validated; `phone` is normalised here so
// it cannot depend on which UI control the caller used. (CUST-07/08/09)

/**
 * Optional free text: `""` normalises to `null`.
 *
 * `POST` did `email || null` and `PATCH` assigned the raw value, so clearing a
 * field through the edit dialog stored `''` while creating it empty stored NULL,
 * and the stats query had to special-case `!= ''` to compensate (CUST-11). Doing
 * it in the schema means both verbs get it, and every future verb does too.
 */
function optionalText(max: number) {
  return boundedText(max)
    .transform((v) => {
      const trimmed = v.trim();
      return trimmed.length === 0 ? null : trimmed;
    })
    .nullable()
    .optional();
}

/** Required, trimmed, bounded. */
function requiredText(max: number) {
  return boundedText(max)
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, "Required");
}

/**
 * Email — validated, lowercased, `""` → null.
 *
 * `z.string().optional()` accepted `"nope"`, which then reached the mailer and
 * every PDF. Lowercasing matters because the public booking portal links a
 * submission to an existing customer by case-insensitive email match; storing a
 * canonical form makes that match and the duplicate check (CUST-28) agree.
 */
export const customerEmail = z
  .string()
  .max(320, "Too long (max 320 characters)")
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => v.length === 0 || z.string().email().safeParse(v).success, {
    message: "Not a valid email address",
  })
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

/**
 * Phone — stored as typed, minus formatting noise.
 *
 * Deliberately NOT reformatted to `(555) 123-4567`. The old client helper
 * truncated at ten digits, so `+44 20 7946 0958` was stored as `4420794609` — a
 * number that dials nothing — and the inline header editor saved the *formatted*
 * string while the dialog saved digits, leaving two representations in one column
 * that the search could not both match (CUST-07/08).
 *
 * We keep a leading `+` and the digits, drop everything else, and let the UI
 * format for display. That is lossless for every numbering plan.
 */
export const customerPhone = z
  .string()
  .max(32, "Too long (max 32 characters)")
  .transform((v) => {
    const trimmed = v.trim();
    if (trimmed.length === 0) return "";
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return digits.length === 0 ? "" : `${hasPlus ? "+" : ""}${digits}`;
  })
  .refine((v) => v.length === 0 || v.replace(/\D/g, "").length >= 4, {
    message: "Not enough digits to be a phone number",
  })
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional();

// ── Querystrings ──────────────────────────────────────────────────────────────

export const customerListQuery = paginationQuery.extend({
  sortBy: z.enum(["createdAt", "firstName", "lastName", "email"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  /** Filter to customers carrying this tag — the reason tags exist (CUST-12). */
  tagId: z.string().uuid().optional(),
});

export const duplicateCheckQuery = z.object({
  email: z.string().max(320),
  excludeId: z.string().uuid().optional(),
});

// ── Bodies ────────────────────────────────────────────────────────────────────

export const createCustomerBody = z.object({
  firstName: requiredText(120),
  lastName: requiredText(120),
  email: customerEmail,
  phone: customerPhone,
  address: optionalText(300),
  city: optionalText(120),
  state: optionalText(120),
  zipCode: optionalText(32),
  notes: optionalText(5000),
});

export const updateCustomerBody = z.object({
  firstName: requiredText(120).optional(),
  lastName: requiredText(120).optional(),
  email: customerEmail,
  phone: customerPhone,
  address: optionalText(300),
  city: optionalText(120),
  state: optionalText(120),
  zipCode: optionalText(32),
  notes: optionalText(5000),
});

export const assignTagBody = z.object({
  tagId: z.string().uuid(),
});

export const createNoteBody = z.object({
  content: boundedText(5000).trim().min(1),
});

export const updateNoteBody = z.object({
  content: boundedText(5000).trim().min(1),
});
