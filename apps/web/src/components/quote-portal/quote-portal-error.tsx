"use client";

import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/**
 * The portal's "we couldn't load this" state.
 *
 * QUO-07. Every failure used to render Next's 404 page — "Estimate Not Found" —
 * including a 500 and a network error, because `getPublicQuote` collapsed all
 * three into `{data: null}`. On a page whose whole job is to make a stranger
 * trust the document in front of them, "not found" is the worst available lie:
 * it reads as withdrawn. A genuine 404 still gets `notFound()`; this is for
 * everything else.
 */
export function QuotePortalError({ message }: { message?: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        role="alert"
        className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <IconPlugConnectedX className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
        <h1 className="mt-4 font-heading text-lg font-semibold text-foreground">
          We couldn&rsquo;t load your estimate
        </h1>
        <p className="mt-2 text-sm text-muted-foreground font-body">
          {message ?? "Something went wrong on our end."} Your estimate is still
          valid — please try again, or contact the business directly.
        </p>
        <Button
          variant="outline"
          className="mt-5 cursor-pointer"
          onClick={() => window.location.reload()}
        >
          <IconRefresh className="mr-1.5 h-4 w-4" />
          Try again
        </Button>
      </div>
    </div>
  );
}
