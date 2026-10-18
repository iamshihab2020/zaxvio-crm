"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FilterOption {
  value: string;
  label: string;
}

interface StatusFilterTabsProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /**
   * On phones the track spans its row and the options share it equally, so a
   * row of short labels (1D / 1W / 1M …) is a full-width control with roughly
   * 44px targets instead of a small pill hugging the left edge. From `sm` it
   * is the usual content-sized track.
   */
  fullWidthOnMobile?: boolean;
}

export function StatusFilterTabs({
  options,
  value,
  onChange,
  className,
  fullWidthOnMobile = false,
}: StatusFilterTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const updateIndicator = useCallback(() => {
    const activeTab = tabRefs.current.get(value);
    const container = containerRef.current;
    if (activeTab && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeTab.getBoundingClientRect();
      setIndicator({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    } else {
      // `value` can match no option (the dashboard's revenue range is null
      // once a custom date range is picked). Without this the pill stayed
      // parked on the last tab that matched and kept claiming it was selected.
      setIndicator(null);
    }
  }, [value]);

  useEffect(() => {
    updateIndicator();
  }, [updateIndicator]);

  // In a list page's header (`ListToolbar`) the tabs sit in a row that scrolls
  // sideways on a phone, so a tab chosen by a link (`?status=overdue`) can start
  // off-screen with nothing saying which one is selected. Only that row is
  // scrolled: `scrollIntoView` would move the page as well. The jump is instant,
  // so there is no motion for reduced-motion users to opt out of.
  useEffect(() => {
    const tab = tabRefs.current.get(value);
    const scroller = containerRef.current?.parentElement;
    if (!tab || !scroller || scroller.scrollWidth <= scroller.clientWidth) return;
    const tabRect = tab.getBoundingClientRect();
    const scrollerRect = scroller.getBoundingClientRect();
    const margin = 16;
    if (tabRect.left < scrollerRect.left + margin) {
      scroller.scrollBy({ left: tabRect.left - scrollerRect.left - margin });
    } else if (tabRect.right > scrollerRect.right - margin) {
      scroller.scrollBy({ left: tabRect.right - scrollerRect.right + margin });
    }
  }, [value]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      updateIndicator();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [updateIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        // `shrink-0`: the track is as wide as its labels or it is wrong. A
        // parent that is too narrow scrolls it (ListToolbar) or wraps around it;
        // squeezing it would clip the last label.
        "relative shrink-0 items-center gap-0.5 rounded-full bg-muted/60 p-1",
        // `flex` and `inline-flex` are both `display`, so the choice is made
        // here rather than layered, where one would silently cancel the other.
        fullWidthOnMobile ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex",
        className,
      )}
    >
      {indicator && (
        // Left and width are animated because the pill has to grow and shrink to
        // each label; it is absolute, so nothing around it reflows. The system
        // curve, not `ease-in-out`, which starts slowly and reads as lag after a
        // click. Reduced motion gets the move without the slide.
        <div
          className="absolute rounded-full bg-brand transition-[left,width] duration-[var(--dur-arrive)] ease-[var(--ease-out)] motion-reduce:transition-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            top: 4,
            bottom: 4,
          }}
        />
      )}
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <Button
            key={opt.value}
            ref={(el) => {
              if (el) {
                tabRefs.current.set(opt.value, el);
              } else {
                tabRefs.current.delete(opt.value);
              }
            }}
            variant="ghost"
            size="sm"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative z-10 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium font-body h-auto transition-colors duration-200",
              // 36px + the track's 4px padding is the 44px thumb target; `sm`
              // returns to the compact pointer size. Tabs that don't span the
              // row still get 32px + 8px = a 40px track on a phone.
              fullWidthOnMobile
                ? "min-h-9 flex-1 sm:min-h-0 sm:flex-none"
                : "min-h-8 sm:min-h-0",
              isActive
                ? "text-brand-foreground hover:bg-transparent hover:text-brand-foreground"
                : "text-muted-foreground hover:bg-transparent hover:text-foreground",
            )}
          >
            {opt.label}
          </Button>
        );
      })}
    </div>
  );
}
