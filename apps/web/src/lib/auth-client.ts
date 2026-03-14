import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  plugins: [organizationClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
