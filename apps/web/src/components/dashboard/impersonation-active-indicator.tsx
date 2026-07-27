"use client";

import { useEffect, useState } from "react";
import { IconHeadset } from "@tabler/icons-react";
import { getActiveImpersonationViewer } from "@/actions/tenants";
import { useEventStream } from "@/hooks/use-event-stream";

export function ImpersonationActiveIndicator() {
  const [adminName, setAdminName] = useState<string | null>(null);

  // Check for an already-active viewer on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await getActiveImpersonationViewer();
      if (data?.active && data.viewer && mounted) {
        setAdminName(data.viewer.adminName);
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  // Live updates. Note this previously subscribed to an "impersonation-indicator"
  // channel that nothing ever published to, so it never fired; the API publishes
  // these on the "impersonation" channel.
  useEventStream<{ approved?: boolean }>("impersonation", "response", (payload) => {
    if (payload?.approved) {
      // Admin was just granted access — show indicator
      setAdminName("Support");
    }
  });

  useEventStream("impersonation", "exit", () => {
    setAdminName(null);
  });

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
