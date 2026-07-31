"use client";

import { useSidebar } from "./sidebar-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div
      className="flex-1 min-w-0 transition-[padding-left] duration-300 ease-in-out"
      style={
        {
          paddingLeft: isCollapsed ? "4rem" : "14rem",
          // Published so descendants can centre themselves on the CONTENT area
          // rather than the viewport. A `position: fixed` element resolves
          // `left: 50%` against the viewport, which ignores the sidebar and
          // lands half its width to the left of where the reader is looking.
          // Custom properties inherit through the DOM regardless of
          // positioning, so a fixed descendant still sees this.
          "--sidebar-w": isCollapsed ? "4rem" : "14rem",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
