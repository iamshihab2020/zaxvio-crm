"use client";

import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface LoadErrorStateProps {
  /** Headline, e.g. "Couldn't load your reports". */
  title: string;
  message?: string | null;
  onRetry: () => void;
  isRetrying?: boolean;
}

/**
 * Whole-page failure state with an in-place retry.
 *
 * The distinction this component exists to preserve: *failed* is not *empty*.
 * A page that renders "No data available for this period" after a 500 tells a
 * contractor they earned nothing this quarter. Anything that can fail must be
 * able to say so.
 *
 * Shared by /dashboard and /reports.
 */
export function LoadErrorState({
  title,
  message,
  onRetry,
  isRetrying = false,
}: LoadErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/10 p-10 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <IconPlugConnectedX className="h-6 w-6 text-muted-foreground" aria-hidden />
      </div>
      <h2 className="mt-4 font-heading text-lg font-semibold text-foreground">
        {title}
      </h2>
      <p className="mt-1 max-w-sm text-sm font-body text-muted-foreground">
        {message ?? "Something went wrong while fetching your data."}
      </p>
      <Button onClick={onRetry} disabled={isRetrying} className="mt-5 gap-2">
        <IconRefresh className={isRetrying ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        {isRetrying ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}
