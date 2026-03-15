"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function OrgResolver() {
  const router = useRouter();
  const [error, setError] = useState(false);

  useEffect(() => {
    async function resolve() {
      try {
        const orgsResult = await authClient.organization.list();
        const orgs = orgsResult.data;

        if (orgs && orgs.length > 0) {
          await authClient.organization.setActive({
            organizationId: orgs[0].id,
          });
          router.refresh();
        } else {
          router.replace("/signup");
        }
      } catch {
        setError(true);
      }
    }

    resolve();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Something went wrong. Please{" "}
          <a href="/login" className="text-brand underline">
            sign in again
          </a>
          .
        </p>
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
