"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { authClient, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { AuthShell } from "@/components/auth-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { IconCheck, IconX, IconMailForward } from "@tabler/icons-react";

export default function InviteAcceptPage() {
  const params = useParams();
  const { data: session, isPending: sessionLoading } = useSession();
  const invitationId = params.id as string;

  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isLoggedIn = !sessionLoading && !!session?.user;

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to accept invitation.");
        setAccepting(false);
        return;
      }
      // Set the org as active
      if (result.data?.member?.organizationId) {
        await authClient.organization.setActive({
          organizationId: result.data.member.organizationId,
        });
      }
      setSuccess(true);
      setTimeout(() => {
        window.location.replace("/dashboard");
      }, 1500);
    } catch {
      setError("Something went wrong. Please try again.");
      setAccepting(false);
    }
  }

  async function handleReject() {
    setAccepting(true);
    try {
      await authClient.organization.rejectInvitation({ invitationId });
      window.location.replace("/");
    } catch {
      setError("Failed to decline invitation.");
      setAccepting(false);
    }
  }

  if (sessionLoading) {
    return (
      <AuthShell>
        <div className="space-y-6">
          <div className="flex items-center justify-center md:hidden">
            <Logo size="md" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-8 w-48 mx-auto" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        <div className="flex items-center justify-center md:hidden">
          <Logo size="md" />
        </div>

        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            Team Invitation
          </h1>
        </div>

        {success && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/40 p-6">
            <IconCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              You've joined the team!
            </p>
            <p className="text-xs text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        )}

        {!success && (
          <div className="space-y-6">
            {/* Invitation card */}
            <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-light">
                <IconMailForward className="h-6 w-6 text-brand" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                You've been invited to join a team on Zaxvio.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            {isLoggedIn ? (
              <div className="space-y-3">
                <Button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
                >
                  <IconCheck className="mr-2 h-4 w-4" />
                  {accepting ? "Accepting..." : "Accept Invitation"}
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={accepting}
                  variant="outline"
                  className="w-full"
                >
                  <IconX className="mr-2 h-4 w-4" />
                  Decline
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground text-center">
                  Sign in or create an account to accept this invitation.
                </p>
                <Link href={`/login?invite=${invitationId}`}>
                  <Button className="w-full bg-brand text-brand-foreground hover:bg-brand/90">
                    Sign in to accept
                  </Button>
                </Link>
                <Link href={`/signup?invite=${invitationId}`}>
                  <Button variant="outline" className="w-full">
                    Create an account
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </AuthShell>
  );
}
