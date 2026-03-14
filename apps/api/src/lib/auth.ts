import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@hvac-saas/database";
import { env } from "./env.js";

// Better Auth gets its own dedicated connection with prepare: false
// This avoids issues with Supabase's transaction pooler
const authConnection = postgres(env.DATABASE_URL, { prepare: false });
const authDb = drizzle(authConnection, { schema });

export const auth = betterAuth({
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      organization: schema.organization,
      member: schema.member,
      invitation: schema.invitation,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.API_BASE_URL,
  basePath: "/api/auth",
  trustedOrigins: [env.FRONTEND_URL],
  emailAndPassword: {
    enabled: true,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  user: {
    additionalFields: {
      phone: {
        type: "string",
        required: false,
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
    }),
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),
  ],
});
