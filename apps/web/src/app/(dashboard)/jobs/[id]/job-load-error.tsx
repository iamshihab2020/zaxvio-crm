"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LoadErrorState } from "@/components/reusable/load-error-state";

/**
 * Client shim so a server component can render `LoadErrorState`, which needs an
 * `onRetry` handler. Retrying re-runs the server component's own fetch.
 */
export function JobLoadError({ message }: { message: string | null }) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <div className="p-4 sm:p-6">
      <LoadErrorState
        title="Couldn't load this job"
        message={message}
        isRetrying={isRetrying}
        onRetry={() => startTransition(() => router.refresh())}
      />
    </div>
  );
}
