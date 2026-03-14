import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
  return data as {
    session: { id: string; userId: string; activeOrganizationId: string | null };
    user: { id: string; email: string; name: string; role: string | null };
  } | null;
}
