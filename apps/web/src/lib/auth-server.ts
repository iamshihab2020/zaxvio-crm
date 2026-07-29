import { cookies } from "next/headers";

import { API_URL } from "./api-url";

/**
 * Get the current session from the API, server-side.
 * Forwards cookies from the incoming request to the Fastify API.
 */
export async function getServerSession() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const res = await fetch(`${API_URL}/api/auth/get-session`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();

  // Validate response shape — return null for malformed/empty responses
  if (
    !data ||
    typeof data !== "object" ||
    !data.session?.userId ||
    !data.user?.id
  ) {
    return null;
  }

  return data as {
    session: { id: string; userId: string; activeOrganizationId: string | null };
    user: { id: string; email: string; name: string; role: string | null };
  };
}
