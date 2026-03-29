"use client";

import { useEffect, useState, useRef } from "react";
import { IconHeadset } from "@tabler/icons-react";
import { getActiveImpersonationViewer, getTenant } from "@/actions/tenants";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function ImpersonationActiveIndicator() {
  const [adminName, setAdminName] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      // Check for active viewer on mount
      const { data } = await getActiveImpersonationViewer();
      if (data?.active && data.viewer && mounted) {
        setAdminName(data.viewer.adminName);
      }

      // Subscribe to channel for live updates
      const { data: tenant } = await getTenant();
      if (!tenant?.id || !mounted) return;

      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`impersonation-indicator:${tenant.id}`)
        .on("broadcast", { event: "response" }, ({ payload }) => {
          if (!mounted) return;
          if (payload?.approved) {
            // Admin was just granted access — show indicator
            setAdminName("Support");
          }
        })
        .on("broadcast", { event: "exit" }, () => {
          if (!mounted) return;
          setAdminName(null);
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

  if (!adminName) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 flex h-8 items-center justify-center gap-2 bg-blue-600 text-white">
      <IconHeadset className="h-3.5 w-3.5" />
      <span className="font-body text-xs">
        Support team is currently assisting with your account
      </span>
    </div>
  );
}
