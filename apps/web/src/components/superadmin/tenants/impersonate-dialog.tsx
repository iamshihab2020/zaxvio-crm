"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconEye,
  IconEyeOff,
  IconLoader2,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import {
  startImpersonation,
  requestVisibleImpersonation,
  cancelImpersonationRequest,
} from "@/actions/admin";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Mode = "ghost" | "visible";
type Phase = "form" | "waiting" | "rejected";

export function ImpersonateDialog({
  tenantId,
  tenantName,
  open,
  onOpenChange,
  onSuccess,
}: {
  tenantId: string;
  tenantName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<Mode>("ghost");
  const [phase, setPhase] = useState<Phase>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(
    null,
  );
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Cleanup channel on unmount or dialog close
  useEffect(() => {
    if (!open) {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
      setPhase("form");
      setError(null);
      setPendingSessionId(null);
    }
  }, [open]);

  const handleGhostSubmit = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await startImpersonation(
      tenantId,
      reason.trim(),
    );

    if (apiError || !data) {
      setError(apiError ?? "Failed to start impersonation");
      setLoading(false);
      return;
    }

    const maxAge = 2 * 60 * 60;
    document.cookie = `x-impersonation-id=${data.sessionId}; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = `x-user-role=impersonating; path=/; max-age=${maxAge}; samesite=lax`;
    window.location.replace("/dashboard");
  };

  const handleVisibleSubmit = async () => {
    setLoading(true);
    setError(null);

    const { data, error: apiError } = await requestVisibleImpersonation(
      tenantId,
      reason.trim(),
    );

    if (apiError || !data) {
      setError(apiError ?? "Failed to send request");
      setLoading(false);
      return;
    }

    setPendingSessionId(data.sessionId);
    setPhase("waiting");
    setLoading(false);

    // Subscribe to realtime channel for response
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`impersonation:${tenantId}`)
      .on("broadcast", { event: "response" }, ({ payload }) => {
        if (payload?.sessionId !== data.sessionId) return;

        if (payload.approved) {
          // Tenant approved — set cookies and redirect
          const maxAge = 2 * 60 * 60;
          document.cookie = `x-impersonation-id=${data.sessionId}; path=/; max-age=${maxAge}; samesite=lax`;
          document.cookie = `x-user-role=impersonating; path=/; max-age=${maxAge}; samesite=lax`;
          channel.unsubscribe();
          window.location.replace("/dashboard");
        } else {
          // Tenant rejected
          setPhase("rejected");
          channel.unsubscribe();
        }
      })
      .subscribe();

    channelRef.current = channel;
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required for impersonation");
      return;
    }

    if (mode === "ghost") {
      await handleGhostSubmit();
    } else {
      await handleVisibleSubmit();
    }
  };

  const handleCancel = async () => {
    if (pendingSessionId) {
      await cancelImpersonationRequest(pendingSessionId);
    }
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    onOpenChange(false);
  };

  // ── Waiting phase UI ────────────────────────────────────
  if (phase === "waiting") {
    return (
      <Dialog open={open} onOpenChange={() => handleCancel()}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
              <IconLoader2 className="h-6 w-6 animate-spin text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1 text-center">
              <p className="font-heading text-base font-semibold">
                Waiting for approval
              </p>
              <p className="font-body text-sm text-muted-foreground">
                Request sent to <strong>{tenantName}</strong>. They need to
                accept before you can proceed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} className="w-full">
              Cancel Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Rejected phase UI ───────────────────────────────────
  if (phase === "rejected") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <IconX className="h-6 w-6 text-destructive" />
            </div>
            <div className="space-y-1 text-center">
              <p className="font-heading text-base font-semibold">
                Request Denied
              </p>
              <p className="font-body text-sm text-muted-foreground">
                <strong>{tenantName}</strong> declined the impersonation
                request.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPhase("form");
                onOpenChange(false);
              }}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Form phase UI (default) ─────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconEye className="h-5 w-5 text-admin-accent" />
            Impersonate Tenant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Mode selector */}
          <div className="space-y-2">
            <Label className="font-body text-sm">Impersonation Mode</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("ghost")}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                  mode === "ghost"
                    ? "border-admin-accent bg-admin-accent/10"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <IconEyeOff
                  className={`h-4 w-4 ${mode === "ghost" ? "text-admin-accent" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="font-body text-sm font-medium">Ghost</p>
                  <p className="font-body text-xs text-muted-foreground">
                    Silent access
                  </p>
                </div>
                {mode === "ghost" && (
                  <IconCheck className="ml-auto h-4 w-4 text-admin-accent" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setMode("visible")}
                className={`flex items-center gap-2 rounded-lg border p-3 text-left transition-colors ${
                  mode === "visible"
                    ? "border-admin-accent bg-admin-accent/10"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <IconEye
                  className={`h-4 w-4 ${mode === "visible" ? "text-admin-accent" : "text-muted-foreground"}`}
                />
                <div>
                  <p className="font-body text-sm font-medium">Visible</p>
                  <p className="font-body text-xs text-muted-foreground">
                    With consent
                  </p>
                </div>
                {mode === "visible" && (
                  <IconCheck className="ml-auto h-4 w-4 text-admin-accent" />
                )}
              </button>
            </div>
          </div>

          {/* Info banner */}
          <div
            className={`rounded-md border p-3 ${
              mode === "ghost"
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
            }`}
          >
            <p
              className={`text-sm font-body ${
                mode === "ghost"
                  ? "text-amber-800 dark:text-amber-200"
                  : "text-blue-800 dark:text-blue-200"
              }`}
            >
              {mode === "ghost" ? (
                <>
                  You will access <strong>{tenantName}</strong>&apos;s dashboard
                  silently. The tenant will not be notified.
                </>
              ) : (
                <>
                  A permission request will be sent to{" "}
                  <strong>{tenantName}</strong>. They must approve before you can
                  access their account.
                </>
              )}
            </p>
          </div>

          {/* Reason field */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="font-body text-sm">
              Reason for impersonation{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer support ticket #123 — user can't see their invoices"
              className="font-body min-h-[80px]"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive font-body">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !reason.trim()}
            className="bg-admin-accent hover:bg-admin-accent/90 text-white"
          >
            {loading
              ? "Starting..."
              : mode === "ghost"
                ? "Start Impersonation"
                : "Send Request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
