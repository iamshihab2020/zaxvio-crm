"use client";

import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-provider";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed, animated } = useSidebar();

  return (
    <div
      className={cn(
        // Follows the rail's width in step. Off until `animated`, so a saved
        // collapsed state is applied without sliding the page on every load.
        "min-w-0 flex-1 lg:pl-[var(--sidebar-w)]",
        animated && "transition-[padding-left] duration-300 ease-in-out",
        // Published so descendants can centre themselves on the CONTENT area
        // rather than the viewport. A `position: fixed` element resolves
        // `left: 50%` against the viewport, which ignores the sidebar and
        // lands half its width to the left of where the reader is looking.
        // Custom properties inherit through the DOM regardless of
        // positioning, so a fixed descendant still sees this.
        //
        // The rail only exists from `lg`; below it the sidebar is a drawer
        // that overlays the page, so the content takes the whole viewport and
        // the variable is 0. The width is chosen by a ternary between two whole
        // class names, not by interpolating the value into one, because
        // Tailwind only generates classes it can read as literal strings.
        "[--sidebar-w:0px]",
        isCollapsed ? "lg:[--sidebar-w:4rem]" : "lg:[--sidebar-w:14rem]",
      )}
    >
      {children}
    </div>
  );
}
