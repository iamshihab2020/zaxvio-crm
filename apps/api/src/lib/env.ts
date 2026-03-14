import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load .env from monorepo root (same pattern as packages/database/drizzle.config.ts)
config({ path: resolve(import.meta.dirname, "../../../../.env") });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default("http://localhost:4000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  // Supabase (Storage + Realtime only)
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Seed (optional — only needed by seed script)
  ADMIN_SEED_EMAIL: z.string().email().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
