import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";

// adminClient() is kept for the user/session field inference it provides (notably
// `user.role`, which the login page reads). Its *endpoints* are dead: the API 404s
// everything under /api/auth/admin/* on purpose — those routes authorize on
// `role === "admin"` alone and know nothing about our adminTier model, so they
// bypassed the tier gate, the owner check and admin_audit_log. See the comment in
// apps/api/src/server.ts. Admin work goes through the API's own /admin/* routes.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  plugins: [organizationClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
