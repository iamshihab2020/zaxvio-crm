import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env from monorepo root
config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "../../supabase/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
