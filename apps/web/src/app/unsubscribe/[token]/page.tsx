import type { Metadata } from "next";
import { getUnsubscribeTarget } from "@/actions/public-unsubscribe";
import { UnsubscribeClient } from "./unsubscribe-client";

interface UnsubscribePageProps {
  params: Promise<{ token: string }>;
}

/**
 * A tokenised page carrying a (masked) address must never be indexed. The root
 * layout sets `robots: { index: true }`, and the public quote portal had to
 * override it for the same reason (QUO-31).
 */
export const metadata: Metadata = {
  title: "Unsubscribe",
  robots: { index: false, follow: false },
};

/**
 * The confirmation page.
 *
 * **This page does not unsubscribe anyone.** It renders who the link is for and
 * waits for a click. Gmail, Outlook and every corporate link scanner fetch URLs
 * in the background looking for malware, so a `GET` that opts someone out is a
 * `GET` that opts out people who never clicked — and they will not find out
 * until they wonder why the emails stopped.
 */
export default async function UnsubscribePage({ params }: UnsubscribePageProps) {
  const { token } = await params;
  const result = await getUnsubscribeTarget(token);

  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md">
        <UnsubscribeClient
          token={token}
          target={result.data}
          notFound={result.notFound}
          loadError={result.error}
        />
      </div>
    </main>
  );
}
