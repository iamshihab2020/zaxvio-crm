/**
 * Helpers for turning user-typed search text into a safe `LIKE`/`ILIKE` pattern.
 *
 * Without escaping, the metacharacters are operators rather than characters: a
 * search for `%` matched every row instead of the ones containing a percent sign,
 * and `_` matched any single character (CUST-16). `escapeLike` lived as a private
 * function inside `routes/jobs/index.ts` and was never carried to the other list
 * endpoints — it lives here now so there is one copy to get right.
 */

/**
 * Escape LIKE/ILIKE wildcards so user input is matched literally.
 *
 * The backslash must be escaped **first**, otherwise the backslashes this
 * function introduces get escaped again on the second and third passes.
 */
export function escapeLike(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

/** `%escaped%` — the containment pattern every list endpoint uses. */
export function containsPattern(str: string): string {
  return `%${escapeLike(str)}%`;
}
