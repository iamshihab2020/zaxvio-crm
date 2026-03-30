"use client";

import { useSuperadminSidebar } from "./superadmin-sidebar-provider";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSuperadminSidebar();

  return (
    <div
      className="flex-1 min-w-0 transition-[padding-left] duration-300 ease-in-out"
      style={{ paddingLeft: isCollapsed ? "4rem" : "15rem" }}
    >
      {children}
    </div>
  );
}
