"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoadErrorState } from "@/components/reusable/load-error-state";

/**
 * Client shim so the server component can render `LoadErrorState`, which needs
 * an `onRetry` handler. Retrying re-runs the server component's own fetch.
 *
 * Mirrors `jobs/[id]/job-load-error.tsx` — the jobs audit added it on
 * 2026-07-29 and the change was not carried across (INV-11).
 */
export function InvoiceLoadError({ message }: { message: string | null }) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <div className="p-4 sm:p-6">
      <LoadErrorState
        title="Couldn't load this invoice"
        message={message}
        isRetrying={isRetrying}
        onRetry={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}
