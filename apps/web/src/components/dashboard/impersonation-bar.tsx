"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { IconShieldCheck, IconArrowLeft, IconClock } from "@tabler/icons-react";
import { getActiveImpersonation, endImpersonation } from "@/actions/admin";

interface ImpersonationSession {
  id: string;
  tenantId: string;
  tenantName: string;
  mode: string;
  expiresAt: string;
}

export function ImpersonationBar() {
  const [session, setSession] = useState<ImpersonationSession | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await getActiveImpersonation();
      if (data?.active && data.session) {
        setSession(data.session);
      }
    }
    void load();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!session?.expiresAt) return;

    function updateTimer() {
      const remaining = new Date(session!.expiresAt).getTime() - Date.now();
      if (remaining <= 0) {
        document.cookie = "x-impersonation-id=; path=/; max-age=0";
        document.cookie = `x-user-role=admin; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
        window.location.replace("/superadmin/dashboard");
        return;
      }
      const hrs = Math.floor(remaining / 3600000);
      const mins = Math.floor((remaining % 3600000) / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(
        hrs > 0
          ? `${hrs}h ${mins.toString().padStart(2, "0")}m`
          : `${mins}m ${secs.toString().padStart(2, "0")}s`,
      );
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session?.expiresAt]);

  const handleExit = async () => {
    if (!session) return;
    setEnding(true);

    const { error } = await endImpersonation(session.id);
    if (error) {
      setEnding(false);
      return;
    }

    document.cookie = "x-impersonation-id=; path=/; max-age=0";
    document.cookie = `x-user-role=admin; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
    window.location.replace(`/superadmin/tenants/${session.tenantId}`);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex h-10 items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 px-5">
      {/* Left — live indicator + tenant name */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center rounded-md bg-amber-500/20 p-1">
          <IconShieldCheck className="h-4 w-4 text-amber-400" />
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="font-body text-[13px] text-amber-200/80">
            Viewing as
          </span>
          <span className="font-heading text-[13px] font-semibold text-amber-100">
            {session?.tenantName ?? "..."}
          </span>
          {session?.mode === "visible" && (
            <span className="rounded bg-amber-500/25 px-1.5 py-0.5 font-body text-[10px] font-medium uppercase tracking-wider text-amber-300">
              Visible
            </span>
          )}
        </div>
      </div>

      {/* Right — timer + exit */}
      <div className="flex items-center gap-3">
        {timeLeft && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5">
            <IconClock className="h-3 w-3 text-amber-400/70" />
            <span className="font-body text-xs tabular-nums text-amber-300/90">
              {timeLeft}
            </span>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExit}
          disabled={ending}
          className="border-amber-500/30 bg-amber-500/10 font-body text-xs font-medium text-amber-200 hover:border-amber-400/50 hover:bg-amber-500/20 hover:text-amber-100"
        >
          <IconArrowLeft className="h-3 w-3" />
          {ending ? "Returning..." : "Back to Admin"}
        </Button>
      </div>
    </div>
  );
}
