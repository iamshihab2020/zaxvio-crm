"use client";

import { useSidebar } from "./sidebar-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className="flex-1 transition-[padding-left] duration-300 ease-in-out"
      style={{ paddingLeft: isCollapsed ? "4rem" : "15rem" }}
    >
      {children}
    </div>
  );
}
