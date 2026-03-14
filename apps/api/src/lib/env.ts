import { config } from "dotenv";
import { resolve } from "path";
import { z } from "zod";

// Load .env from monorepo root (same pattern as packages/database/drizzle.config.ts)
config({ path: resolve(import.meta.dirname, "../../../../.env") });

const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default("http://localhost:4000"),

  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  ADMIN_JWT_SECRET: z.string().min(1, "ADMIN_JWT_SECRET is required"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
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
