"use client";

import { useEffect, useState, useRef } from "react";
import { IconShieldCheck, IconUserCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  respondToImpersonation,
  getPendingImpersonationRequest,
  getTenant,
} from "@/actions/tenants";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface ImpersonationRequest {
  sessionId: string;
  adminName: string;
  reason: string;
}

export function ImpersonationRequestListener() {
  const [request, setRequest] = useState<ImpersonationRequest | null>(null);
  const [responding, setResponding] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // 1. Get tenant ID for channel subscription
      const { data: tenant } = await getTenant();
      if (!tenant?.id || !mounted) return;

      // 2. Check for any pending requests on page load (recovery)
      const { data: pendingData } = await getPendingImpersonationRequest();
      if (pendingData?.pending && pendingData.request && mounted) {
        setRequest(pendingData.request);
      }

      // 3. Subscribe to realtime channel
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`impersonation:${tenant.id}`)
        .on("broadcast", { event: "request" }, ({ payload }) => {
          if (!mounted) return;
          setRequest({
            sessionId: payload.sessionId,
            adminName: payload.adminName ?? "Admin",
            reason: payload.reason ?? "",
          });
        })
        .on("broadcast", { event: "exit" }, () => {
          if (!mounted) return;
          toast.info("Admin support session has ended", {
            description: "Your account access has been restored to normal.",
          });
        })
        .on("broadcast", { event: "cancel" }, () => {
          if (!mounted) return;
          setRequest(null);
        })
        .subscribe();

      channelRef.current = channel;
    }

    void init();

    return () => {
      mounted = false;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, []);

  const handleRespond = async (approved: boolean) => {
    if (!request) return;
    setResponding(true);

    await respondToImpersonation(request.sessionId, approved);

    setRequest(null);
    setResponding(false);

    if (approved) {
      toast.success("Access granted", {
        description: "The support admin can now view your account.",
      });
    }
  };

  return (
    <Dialog
      open={!!request}
      onOpenChange={(open) => {
        if (!open && !responding) setRequest(null);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <IconShieldCheck className="h-5 w-5 text-blue-500" />
            Support Access Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
            <IconUserCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-body text-sm font-medium text-blue-900 dark:text-blue-100">
                {request?.adminName ?? "Admin"} is requesting access
              </p>
              <p className="mt-1 font-body text-sm text-blue-700 dark:text-blue-300">
                {request?.reason}
              </p>
            </div>
          </div>

          <p className="font-body text-xs text-muted-foreground">
            If you grant access, the support team will be able to view and
            interact with your account to help resolve your issue. All actions
            are logged.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleRespond(false)}
            disabled={responding}
          >
            Decline
          </Button>
          <Button
            onClick={() => handleRespond(true)}
            disabled={responding}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {responding ? "Granting..." : "Grant Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
