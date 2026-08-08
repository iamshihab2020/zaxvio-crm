import { NextResponse } from "next/server";
import { API_URL } from "@/lib/api-url";

/**
 * RFC 8058 one-click unsubscribe.
 *
 * Gmail renders an "Unsubscribe" control beside the sender name when a message
 * carries `List-Unsubscribe` **and** `List-Unsubscribe-Post`. Clicking it makes
 * the *mail provider* POST here — no browser, no page, nobody to read a
 * response body.
 *
 * This lives on the web origin rather than pointing the header straight at the
 * API so that every URL in an email shares one public host: the footer link the
 * reader clicks and the header the provider posts to are the same domain the
 * message was sent from, which is what a receiving provider expects to see.
 *
 * It forwards to the API and returns 204 either way. A mail provider retries a
 * 4xx and there is nothing on its side to fix; the failure that would matter is
 * a valid unsubscribe that does not take effect, and that is the API's to get
 * right.
 */

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  try {
    await fetch(
      `${API_URL}/public/unsubscribe/${encodeURIComponent(token)}/one-click`,
      {
        method: "POST",
        // Echoing the form body a provider sends is pointless — it is the
        // constant `List-Unsubscribe=One-Click` and carries nothing the token
        // does not — but the header keeps the request well-formed for anything
        // in between that inspects it.
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "List-Unsubscribe=One-Click",
        cache: "no-store",
      },
    );
  } catch {
    // Swallowed deliberately. See above: there is no useful thing to tell a
    // mail provider, and a 5xx here invites a retry storm from a sender we do
    // not control.
  }

  return new NextResponse(null, { status: 204 });
}
