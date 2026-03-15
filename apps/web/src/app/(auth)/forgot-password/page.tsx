"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconMailCheck } from "@tabler/icons-react";
import { Logo } from "@/components/logo";
import { AuthShell } from "@/components/auth-shell";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    document.title = "Forgot Password — Zaxvio";
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forget-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "Something went wrong");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Network error. Please try again.");
    }

    setLoading(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <div className="space-y-6 text-center">
          {/* Logo (mobile only) */}
          <div className="flex items-center justify-center md:hidden">
            <Logo size="md" />
          </div>

          {/* Success icon */}
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10">
              <IconMailCheck size={28} className="text-brand" stroke={1.5} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-bold tracking-tight">
              Check your email
            </h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we sent a
              password reset link.
            </p>
          </div>

          <Link href="/login" className="block">
            <Button
              variant="outline"
              className="w-full"
            >
              Back to sign in
            </Button>
          </Link>
        </div>
      </AuthShell>
    );
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
            Reset your password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

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

          <Button
            type="submit"
            className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
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
