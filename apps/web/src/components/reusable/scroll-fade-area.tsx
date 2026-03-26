"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IconChevronDown } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ScrollFadeAreaProps {
  children: ReactNode;
  className?: string;
}

/**
 * ScrollArea wrapper that shows a bottom fade gradient + chevron
 * when there is more content below the visible area.
 * Fades out once the user scrolls to the bottom.
 */
export function ScrollFadeArea({ children, className }: ScrollFadeAreaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const viewport = root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    function check() {
      if (!viewport) return;
      const { scrollTop, scrollHeight, clientHeight } = viewport;
      setCanScrollDown(scrollHeight - scrollTop - clientHeight > 8);
    }

    check();
    viewport.addEventListener("scroll", check, { passive: true });

    // Re-check when content might change size
    const observer = new ResizeObserver(check);
    observer.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={cn("relative min-h-0 flex-1", className)}>
      <ScrollArea ref={rootRef} className="h-full">
        {children}
      </ScrollArea>

      {/* Bottom fade gradient + chevron indicator */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center transition-opacity duration-200",
          canScrollDown ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="h-8 w-full bg-gradient-to-t from-card to-transparent" />
        <div className="absolute bottom-0 animate-bounce">
          <IconChevronDown className="h-4 w-4 text-brand" />
        </div>
      </div>
    </div>
  );
}
