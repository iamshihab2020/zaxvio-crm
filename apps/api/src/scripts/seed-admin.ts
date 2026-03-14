import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import { auth } from "../lib/auth.js";
import { closeDb } from "@hvac-saas/database";
import postgres from "postgres";

async function seedAdmin() {
  const email = process.env.ADMIN_SEED_EMAIL;
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!email || !password) {
    console.error(
      "ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD must be set in .env",
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("ADMIN_SEED_PASSWORD must be at least 8 characters");
    process.exit(1);
  }

  // Direct SQL connection for simple role updates (avoids drizzle-orm version conflicts)
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  try {
    // Sign up the admin user via Better Auth
    const result = await auth.api.signUpEmail({
      body: {
        email,
        password,
        name: "Super Admin",
      },
    });

    if (!result?.user) {
      console.log(`Signup returned no user for: ${email}`);
      await sql.end();
      await closeDb();
      process.exit(0);
    }

    // Set role to admin directly in DB (seed script runs without a session)
    await sql`UPDATE "user" SET role = 'admin' WHERE id = ${result.user.id}`;

    console.log(`Admin user created: ${result.user.email} (${result.user.id})`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Handle "user already exists" gracefully — ensure admin role is set
    if (message.includes("already") || message.includes("exists")) {
      await sql`UPDATE "user" SET role = 'admin' WHERE email = ${email}`;
      console.log(`Admin user already exists — ensured admin role: ${email}`);
    } else {
      console.error("Seed failed:", err);
      await sql.end();
      await closeDb();
      process.exit(1);
    }
  }

  await sql.end();

  await closeDb();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
