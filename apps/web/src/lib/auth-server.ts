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

/**
 * Get the current user's role inside their active organization, server-side.
 *
 * This is deliberately *not* the same thing as `session.user.role`, which is the
 * platform role (`admin` | null). This one is the Better Auth organization
 * membership role — `owner` | `admin` | `member` — and it is what gates
 * org-scoped UI such as the Settings sidebar.
 *
 * It has to be resolved on the server. Fetching it from the browser means the
 * first HTML paint cannot know it, so any nav that hides items behind it ships
 * incomplete and then reflows when the fetch lands — see the comment on
 * `SettingsNav`.
 *
 * `get-active-member-role` rather than `get-active-member`: it returns just
 * `{ role }` instead of the whole membership row, and callers only ever wanted
 * the role.
 *
 * Returns `null` when there is no active organization, when the user is not a
 * member of it (both are ordinary states during impersonation), or when the
 * request fails. Callers must treat `null` as "no elevated access" — never as
 * "still loading" — because this function does not resolve twice.
 */
export async function getServerOrgRole(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  try {
    const res = await fetch(
      `${API_URL}/api/auth/organization/get-active-member-role`,
      {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      },
    );

    if (!res.ok) return null;

    const data = await res.json();

    return typeof data?.role === "string" ? data.role : null;
  } catch {
    return null;
  }
}
