import { z } from "zod";

/**
 * Schemas for the public unsubscribe surface ([[api-rules]] §6 — no route
 * without one, and this one is unauthenticated, which makes it the least
 * optional case rather than the most).
 */

/**
 * `<uuid>.<base64url-hmac>`.
 *
 * Bounded, and the shape is checked before the route ever touches the database:
 * the token is the only input this endpoint takes, from anyone on the internet,
 * and a Zod refusal is cheaper than a query. The upper bound is generous
 * relative to the real length (36 + 1 + 43 = 80) because a signature-format
 * change should not have to be a schema change too.
 */
export const unsubscribeTokenParam = z.object({
  token: z
    .string()
    .min(38)
    .max(256)
    .regex(
      /^[0-9a-fA-F-]{36}\.[A-Za-z0-9_-]+$/,
      "Not a valid unsubscribe link",
    ),
});
