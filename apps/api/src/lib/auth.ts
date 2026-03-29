import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@hvac-saas/database";
import { getDb } from "@hvac-saas/database";
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
      maxAge: 2 * 60, // 2 minutes
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
      organizationCreation: {
        afterCreate: async ({
          organization: org,
          member: _member,
          user: creator,
        }: {
          organization: { id: string; name: string; slug: string | null };
          member: unknown;
          user: { name: string; email: string };
        }) => {
          try {
            const db = getDb();

            const trialEnd = new Date(
              Date.now() + 14 * 24 * 60 * 60 * 1000,
            );

            // Use org.id as fallback slug to guarantee uniqueness
            const slug = org.slug || `org-${org.id}`;

            await db.transaction(async (tx) => {
              // Create tenant row linked to the new organization
              // onConflictDoNothing guards against slug collisions
              const result = await tx
                .insert(schema.tenants)
                .values({
                  organizationId: org.id,
                  businessName: org.name,
                  ownerName: creator.name ?? "Owner",
                  email: creator.email ?? "",
                  slug,
                  trialEndsAt: trialEnd,
                })
                .onConflictDoNothing()
                .returning();

              // If row was inserted, create subscription + default pipeline stages
              if (result.length > 0) {
                await tx.insert(schema.tenantSubscriptions).values({
                  tenantId: result[0].id,
                  status: "trialing",
                  currentPeriodStart: new Date(),
                  currentPeriodEnd: trialEnd,
                });

                await tx.insert(schema.jobPipelineStages).values([
                  { tenantId: result[0].id, name: "scheduled", label: "Scheduled", color: "blue", sortOrder: 0, isDefault: true },
                  { tenantId: result[0].id, name: "in_progress", label: "In Progress", color: "brand", sortOrder: 1, isDefault: true },
                  { tenantId: result[0].id, name: "completed", label: "Completed", color: "green", sortOrder: 2, isDefault: true },
                  { tenantId: result[0].id, name: "cancelled", label: "Cancelled", color: "gray", sortOrder: 3, isDefault: true },
                ]);
              }
            });
          } catch (err) {
            console.error(
              "[auth] Failed to create tenant for org:",
              org.id,
              err,
            );
          }
        },
      },
    }),
    admin({
      defaultRole: "user",
      adminRole: "admin",
    }),
  ],
});
