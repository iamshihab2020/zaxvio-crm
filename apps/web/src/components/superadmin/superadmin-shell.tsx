"use client";

import { cn } from "@/lib/utils";
import { useSuperadminSidebar } from "./superadmin-sidebar-provider";

export function SuperadminShell({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSuperadminSidebar();

  return (
    <div
      className={cn(
        "min-w-0 flex-1 transition-[padding-left] duration-300 ease-in-out lg:pl-[var(--sidebar-w)]",
        // The rail's width, published for the content and for the fixed navbar
        // inside it, which offsets itself with `left: var(--sidebar-w)`. The
        // rail only exists from `lg`; below it the sidebar is a drawer that
        // overlays the page, so the variable is 0 and the content takes the
        // whole viewport. Same name as the tenant shell's, so anything shared
        // that centres on the content area works in both. The width is chosen
        // by a ternary between two whole class names, not by interpolating the
        // value into one, because Tailwind only generates classes it can read
        // as literal strings.
        "[--sidebar-w:0px]",
        isCollapsed ? "lg:[--sidebar-w:4rem]" : "lg:[--sidebar-w:15rem]",
      )}
    >
      {children}
    </div>
  );
}
