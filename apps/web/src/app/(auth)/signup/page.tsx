"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signUp, authClient } from "@/lib/auth-client";
import { initializeTenant } from "@/actions/tenants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Logo } from "@/components/logo";
import { AuthShell } from "@/components/auth-shell";

function SignupForm() {
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Sign Up — Zaxvio";
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 1. Create the user account
      const { data, error: authError } = await signUp.email({
        email,
        password,
        name,
      });

      if (authError) {
        setError(authError.message ?? "Failed to create account");
        return;
      }

      if (data?.user) {
        if (inviteId) {
          // Invitation flow: accept the invitation instead of creating an org
          const acceptResult = await authClient.organization.acceptInvitation({
            invitationId: inviteId,
          });
          if (acceptResult.error) {
            setError(acceptResult.error.message ?? "Failed to accept invitation");
            return;
          }
          // Set the invited org as active
          if (acceptResult.data?.member?.organizationId) {
            await authClient.organization.setActive({
              organizationId: acceptResult.data.member.organizationId,
            });
          }
        } else {
          // Normal flow: create organization (tenant)
          const orgResult = await authClient.organization.create({
            name: businessName,
            slug: businessName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
          });

          if (orgResult.error) {
            setError(orgResult.error.message ?? "Failed to create organization");
            return;
          }

          // Set the org as active (so session has activeOrganizationId)
          await authClient.organization.setActive({
            organizationId: orgResult.data.id,
          });

          // Initialize tenant (fallback in case afterCreate hook failed)
          const tenantResult = await initializeTenant();
          if (!tenantResult.success) {
            setError(
              tenantResult.error ?? "Failed to set up your account. Please try again.",
            );
            return;
          }
        }
      }

      // Set role cookie for middleware (new signups are always regular users)
      document.cookie = `x-user-role=user; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;

      // Hard navigation — back button can't return to signup
      window.location.replace("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="space-y-6">
        {/* Logo (mobile only) */}
        <div className="flex items-center justify-center md:hidden">
          <Logo size="md" />
        </div>

        {/* Header */}
        <div className="space-y-1 text-center">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {inviteId ? "Join your team" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {inviteId ? "Create an account to accept your invitation" : "Start your 14-day free trial"}
          </p>
        </div>

        {/* Google button (UI only) */}
        <Button
          type="button"
          disabled
          variant="outline"
          className="w-full gap-3 rounded-lg py-2.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or continue with email
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <IconEyeOff size={16} stroke={1.5} />
                ) : (
                  <IconEye size={16} stroke={1.5} />
                )}
              </Button>
            </div>
          </div>

          {!inviteId && (
            <div className="space-y-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                type="text"
                placeholder="Acme HVAC Services"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                required
              />
            </div>
          )}

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-brand transition-colors hover:text-brand/80"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

// useSearchParams() forces client-side bailout — without a Suspense boundary
// `next build` fails to prerender this route (matches the /login pattern).
export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
