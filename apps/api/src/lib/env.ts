import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load .env from monorepo root (same pattern as packages/database/drizzle.config.ts)
config({ path: resolve(import.meta.dirname, "../../../../.env") });

/**
 * Domains that ship in .env.example. Reaching production with one of these
 * means email silently 403s at Resend, so we surface it at boot instead.
 */
const PLACEHOLDER_DOMAINS = ["yourdomain.com", "your-verified-domain.com", "example.com"];

export function isPlaceholderEmail(address: string | undefined): boolean {
  if (!address) return false;
  const domain = address.split("@")[1]?.toLowerCase();
  return domain !== undefined && PLACEHOLDER_DOMAINS.includes(domain);
}

/**
 * `KEY=` in a .env file arrives as `""`, not `undefined`, so a bare
 * `.optional()` would reject a deliberately blank optional var. Treat blank
 * as unset — .env.example ships these keys empty.
 */
function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

const envSchema = z
  .object({
    // Server
    PORT: z.coerce.number().default(4000),
    API_BASE_URL: z.string().default("http://localhost:4000"),
    FRONTEND_URL: z.string().default("http://localhost:3000"),

    // Database
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // Better Auth
    BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

    // Cloudflare R2 (object storage — replaced Supabase Storage, see ADR-001).
    // Optional so the API still boots before credentials exist; storage calls
    // then throw a clear error and the startup banner flags it.
    R2_ACCOUNT_ID: optionalString(z.string().min(1)),
    R2_ACCESS_KEY_ID: optionalString(z.string().min(1)),
    R2_SECRET_ACCESS_KEY: optionalString(z.string().min(1)),
    R2_PUBLIC_BUCKET: optionalString(z.string().min(1)),
    R2_PRIVATE_BUCKET: optionalString(z.string().min(1)),
    R2_PUBLIC_URL: optionalString(z.string().url()),

    // Resend (email) — optional as a whole; sending no-ops when unset
    RESEND_API_KEY: optionalString(z.string().min(1)),
    RESEND_FROM_EMAIL: optionalString(
      z.string().email("RESEND_FROM_EMAIL must be a valid email address"),
    ),

    // Seed (optional — only needed by seed script)
    ADMIN_SEED_EMAIL: optionalString(z.string().email()),
    ADMIN_SEED_PASSWORD: optionalString(z.string().min(1)),
  })
  .superRefine((value, ctx) => {
    // A sender is only meaningful once Resend is actually enabled — but once it
    // is, a missing sender would fail on every send instead of at boot.
    if (value.RESEND_API_KEY && !value.RESEND_FROM_EMAIL) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_FROM_EMAIL"],
        message: "RESEND_FROM_EMAIL is required when RESEND_API_KEY is set",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
