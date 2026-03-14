import { config } from "dotenv";
import { resolve } from "path";

// Load .env from monorepo root
config({ path: resolve(import.meta.dirname, "../../../../.env") });

import bcrypt from "bcryptjs";
import { getDb, closeDb, adminUsers } from "@hvac-saas/database";

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

  const passwordHash = await bcrypt.hash(password, 12);
  const db = getDb();

  const result = await db
    .insert(adminUsers)
    .values({
      email,
      passwordHash,
      role: "super_admin",
      fullName: "Super Admin",
    })
    .onConflictDoNothing({ target: adminUsers.email })
    .returning({ id: adminUsers.id, email: adminUsers.email });

  if (result.length > 0) {
    console.log(`Admin user created: ${result[0].email} (${result[0].id})`);
  } else {
    console.log(`Admin user already exists (skipped): ${email}`);
  }

  await closeDb();
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
