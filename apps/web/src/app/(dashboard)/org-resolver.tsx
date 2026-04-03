"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { initializeTenant } from "@/actions/tenants";

export function OrgResolver() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const resolve = useCallback(async () => {
    setError(null);
    try {
      const orgsResult = await authClient.organization.list();
      const orgs = orgsResult.data;

      if (orgs && orgs.length > 0) {
        await authClient.organization.setActive({
          organizationId: orgs[0].id,
        });

        // Ensure tenant row exists (fallback if afterCreate hook failed)
        const tenantResult = await initializeTenant();
        if (!tenantResult.success) {
          setError(
            tenantResult.error ??
              "Failed to initialize your workspace. Please try again.",
          );
          return;
        }

        router.refresh();
      } else {
        // No orgs found — show error instead of redirecting to signup
        // (user may have had their org deleted, or be an admin who shouldn't be here)
        setError(
          "No workspace found for your account. If you believe this is an error, please contact support or sign in with a different account.",
        );
      }
    } catch {
      setError(
        "Could not connect to the server. Please check your connection and try again.",
      );
    }
  }, [router]);

  useEffect(() => {
    resolve();
  }, [resolve]);

  async function handleRetry() {
    setRetrying(true);
    await resolve();
    setRetrying(false);
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-sm space-y-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={handleRetry}
              disabled={retrying}
              className="bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {retrying ? "Retrying..." : "Try again"}
            </Button>
            <a
              href="/login"
              className="text-sm text-muted-foreground underline transition-colors hover:text-foreground"
            >
              Sign in again
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-8">
        <div className="space-y-3">
          <div className="mx-auto h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="mx-auto h-4 w-48 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-full animate-pulse rounded bg-muted" />
          <div className="h-10 w-3/4 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
